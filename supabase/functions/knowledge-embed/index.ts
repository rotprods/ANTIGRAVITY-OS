import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";

/**
 * OCULOPS Knowledge Embed
 *
 * Generates vector embeddings for knowledge entries using OpenAI.
 * Supports:
 *   - POST /embed     — embed a single entry (by id or text)
 *   - POST /search    — semantic search across knowledge vault
 *   - POST /batch     — embed all entries missing embeddings
 *
 * Uses text-embedding-3-small (1536 dims, $0.02/1M tokens)
 */

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const EMBED_MODEL = "text-embedding-3-small";

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      input: text.slice(0, 8000), // token safety
      model: EMBED_MODEL,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

function supabaseHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
  };
}

async function embedEntry(entryId: string): Promise<{ id: string; embedded: boolean }> {
  // Fetch entry
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_entries?id=eq.${entryId}&select=id,title,content,type,tags`,
    { headers: supabaseHeaders() },
  );
  const entries = await res.json();
  if (!entries?.length) throw new Error(`Entry ${entryId} not found`);

  const entry = entries[0];
  const text = [
    entry.title,
    entry.type ? `[${entry.type}]` : "",
    entry.content || "",
    (entry.tags || []).join(", "),
  ].filter(Boolean).join("\n");

  const embedding = await generateEmbedding(text);

  // Update entry with embedding
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_entries?id=eq.${entryId}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ embedding: JSON.stringify(embedding) }),
    },
  );

  return { id: entryId, embedded: updateRes.ok };
}

async function semanticSearch(
  query: string,
  matchCount = 10,
  threshold = 0.7,
  filterType: string | null = null,
): Promise<unknown[]> {
  const queryEmbedding = await generateEmbedding(query);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_knowledge`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: matchCount,
      filter_type: filterType,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Semantic search failed: ${res.status} ${err}`);
  }

  return await res.json();
}

async function batchEmbed(): Promise<{ total: number; embedded: number; errors: number }> {
  // Fetch entries without embeddings
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_entries?embedding=is.null&select=id,title,content,type,tags&limit=50`,
    { headers: supabaseHeaders() },
  );
  const entries = await res.json();
  if (!entries?.length) return { total: 0, embedded: 0, errors: 0 };

  let embedded = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      await embedEntry(entry.id);
      embedded++;
    } catch (err) {
      console.error(`Failed to embed ${entry.id}:`, err);
      errors++;
    }
  }

  return { total: entries.length, embedded, errors };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "embed";

    const body = await readJson<{
      id?: string;
      query?: string;
      text?: string;
      match_count?: number;
      threshold?: number;
      filter_type?: string;
    }>(req);

    if (!OPENAI_KEY) {
      return errorResponse("OPENAI_API_KEY not configured", 500);
    }

    switch (action) {
      case "search": {
        if (!body.query) return errorResponse("query is required", 400);
        const results = await semanticSearch(
          body.query,
          body.match_count || 10,
          body.threshold || 0.7,
          body.filter_type || null,
        );
        return jsonResponse({ ok: true, results, count: results.length });
      }

      case "batch": {
        const result = await batchEmbed();
        return jsonResponse({ ok: true, ...result });
      }

      case "embed":
      default: {
        if (!body.id) return errorResponse("id is required", 400);
        const result = await embedEntry(body.id);
        return jsonResponse({ ok: true, ...result });
      }
    }
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Embedding failed",
      500,
    );
  }
});
