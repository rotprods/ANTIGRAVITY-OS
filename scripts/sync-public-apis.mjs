#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildPublicApiCatalogSnapshot, slugify } from '../src/lib/publicApiCatalog.js';
import { PUBLIC_API_ADAPTER_TEMPLATES } from '../src/lib/publicApiConnectorTemplates.js';

const SOURCE_REPO = 'public-apis/public-apis';
const REPO_META_URL = `https://api.github.com/repos/${SOURCE_REPO}`;
const DEFAULT_README_RAW_URL = `https://raw.githubusercontent.com/${SOURCE_REPO}/master/README.md`;
const USER_AGENT = 'antigravity-os-public-api-sync/1.0';
const UPSERT_CHUNK_SIZE = 200;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SEED_OUTPUT_FILE = path.join(ROOT_DIR, 'src/data/publicApiCatalog.seed.json');
const PUBLIC_CATALOG_DIR = path.join(ROOT_DIR, 'public/public-api-catalog');
const PUBLIC_CATEGORIES_DIR = path.join(PUBLIC_CATALOG_DIR, 'categories');

function toPrettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function chunk(items, size = UPSERT_CHUNK_SIZE) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function getGitHubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
  return {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  } catch {
    // .env is optional
  }
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.json();
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.text();
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function replaceDirectoryContents(dir) {
  await ensureDir(dir);
  const entries = await fs.readdir(dir).catch(() => []);
  await Promise.all(entries.map(async (entry) => {
    await fs.rm(path.join(dir, entry), { recursive: true, force: true });
  }));
}

function buildShardPayload(snapshot) {
  const grouped = new Map();
  for (const entry of snapshot.entries || []) {
    const bucket = grouped.get(entry.category) || [];
    bucket.push(entry);
    grouped.set(entry.category, bucket);
  }

  const shards = [...grouped.entries()]
    .map(([category, entries]) => {
      const slug = slugify(category) || 'unknown-category';
      return {
        category,
        slug,
        count: entries.length,
        path: `./categories/${slug}.json`,
        entries,
      };
    })
    .sort((left, right) => left.category.localeCompare(right.category));

  return {
    index: {
      generated_at: snapshot.generated_at,
      source_repo: snapshot.source_repo,
      sync_run: snapshot.sync_run,
      stats: snapshot.stats,
      shards: shards.map(({ category, slug, count, path: shardPath }) => ({
        category,
        slug,
        count,
        path: shardPath,
      })),
    },
    full: {
      generated_at: snapshot.generated_at,
      source_repo: snapshot.source_repo,
      sync_run: snapshot.sync_run,
      stats: snapshot.stats,
      entries: snapshot.entries,
    },
    categoryFiles: shards.map(shard => ({
      path: path.join(PUBLIC_CATEGORIES_DIR, `${shard.slug}.json`),
      payload: {
        category: shard.category,
        slug: shard.slug,
        count: shard.count,
        entries: shard.entries,
      },
    })),
  };
}

async function writeCatalogArtifacts(snapshot) {
  await ensureDir(path.dirname(SEED_OUTPUT_FILE));
  await fs.writeFile(SEED_OUTPUT_FILE, toPrettyJson(snapshot), 'utf8');

  await replaceDirectoryContents(PUBLIC_CATEGORIES_DIR);
  const shardPayload = buildShardPayload(snapshot);

  await ensureDir(PUBLIC_CATALOG_DIR);
  await fs.writeFile(path.join(PUBLIC_CATALOG_DIR, 'index.json'), toPrettyJson(shardPayload.index), 'utf8');
  await fs.writeFile(path.join(PUBLIC_CATALOG_DIR, 'full.json'), toPrettyJson(shardPayload.full), 'utf8');

  for (const file of shardPayload.categoryFiles) {
    await fs.writeFile(file.path, toPrettyJson(file.payload), 'utf8');
  }

  return shardPayload.index.shards.length;
}

function normalizeError(error) {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
}

async function createSyncRun(supabase, snapshot, startedAt) {
  const { data, error } = await supabase
    .from('api_catalog_sync_runs')
    .insert({
      source_repo: snapshot.source_repo,
      default_branch: snapshot.sync_run.default_branch || 'master',
      repo_pushed_at: snapshot.sync_run.repo_pushed_at,
      readme_sha: snapshot.sync_run.readme_sha,
      entry_count: 0,
      category_count: 0,
      status: 'running',
      started_at: startedAt,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function completeSyncRun(supabase, runId, snapshot, status, errorMessage = null) {
  const payload = {
    source_repo: snapshot.source_repo,
    default_branch: snapshot.sync_run.default_branch || 'master',
    repo_pushed_at: snapshot.sync_run.repo_pushed_at,
    readme_sha: snapshot.sync_run.readme_sha,
    entry_count: snapshot.stats.entryCount,
    category_count: snapshot.stats.categoryCount,
    status,
    error: errorMessage,
    finished_at: new Date().toISOString(),
  };

  await supabase
    .from('api_catalog_sync_runs')
    .update(payload)
    .eq('id', runId);
}

async function syncToSupabase(snapshot, startedAt) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      skipped: true,
      reason: 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL missing',
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let runId = null;

  try {
    const run = await createSyncRun(supabase, snapshot, startedAt);
    runId = run.id;

    const { data: existingEntries, error: existingEntriesError } = await supabase
      .from('api_catalog_entries')
      .select('slug,first_seen_at')
      .limit(5000);

    if (existingEntriesError) throw existingEntriesError;

    const existingFirstSeen = new Map(
      (existingEntries || []).map(entry => [entry.slug, entry.first_seen_at || startedAt])
    );

    const now = new Date().toISOString();
    const nextEntries = snapshot.entries.map(entry => ({
      ...entry,
      first_seen_at: existingFirstSeen.get(entry.slug) || now,
      last_seen_at: now,
      sync_run_id: runId,
    }));

    for (const rows of chunk(nextEntries, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('api_catalog_entries')
        .upsert(rows, { onConflict: 'slug' });
      if (error) throw error;
    }

    const nextSlugs = new Set(nextEntries.map(entry => entry.slug));
    const missingSlugs = (existingEntries || [])
      .map(entry => entry.slug)
      .filter(slug => !nextSlugs.has(slug));

    for (const slugs of chunk(missingSlugs, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('api_catalog_entries')
        .update({ is_listed: false, sync_run_id: runId })
        .in('slug', slugs);
      if (error) throw error;
    }

    await completeSyncRun(supabase, runId, snapshot, 'completed', null);

    return {
      skipped: false,
      runId,
      upsertedEntries: nextEntries.length,
      delistedEntries: missingSlugs.length,
    };
  } catch (error) {
    if (runId) {
      await completeSyncRun(supabase, runId, snapshot, 'failed', normalizeError(error));
    }
    throw error;
  }
}

async function fetchSnapshot(startedAt) {
  const headers = getGitHubHeaders();
  const repoMeta = await fetchJson(REPO_META_URL, headers);
  const defaultBranch = repoMeta?.default_branch || 'master';
  const rawReadmeUrl = `https://raw.githubusercontent.com/${SOURCE_REPO}/${defaultBranch}/README.md`;
  const readme = await fetchText(rawReadmeUrl || DEFAULT_README_RAW_URL, headers);

  let readmeSha = null;
  try {
    const readmeMeta = await fetchJson(`${REPO_META_URL}/contents/README.md?ref=${encodeURIComponent(defaultBranch)}`, headers);
    readmeSha = readmeMeta?.sha || null;
  } catch {
    readmeSha = null;
  }

  const snapshot = buildPublicApiCatalogSnapshot({
    readme,
    repoMeta: {
      ...repoMeta,
      readme_sha: readmeSha,
    },
    templates: PUBLIC_API_ADAPTER_TEMPLATES,
    syncedAt: startedAt,
  });

  snapshot.sync_run.readme_sha = readmeSha || snapshot.sync_run.readme_sha;

  return snapshot;
}

async function main() {
  await loadEnvFile();
  const startedAt = new Date().toISOString();

  console.log(`[sync-public-apis] Fetching source from ${SOURCE_REPO} ...`);
  const snapshot = await fetchSnapshot(startedAt);

  const shardCount = await writeCatalogArtifacts(snapshot);
  console.log(`[sync-public-apis] Wrote seed + public shards (${snapshot.stats.entryCount} entries across ${shardCount} categories).`);

  const dbResult = await syncToSupabase(snapshot, startedAt);
  if (dbResult.skipped) {
    console.log(`[sync-public-apis] Supabase sync skipped: ${dbResult.reason}`);
  } else {
    console.log(
      `[sync-public-apis] Supabase sync completed: run=${dbResult.runId}, upserted=${dbResult.upsertedEntries}, delisted=${dbResult.delistedEntries}.`
    );
  }
}

main().catch((error) => {
  console.error('[sync-public-apis] failed:', normalizeError(error));
  process.exitCode = 1;
});
