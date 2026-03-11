-- ═══════════════════════════════════════════════════
-- OCULOPS — Knowledge pgvector Extension
-- Adds vector embeddings to knowledge_entries for semantic search
-- ═══════════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding column (1536 dimensions = OpenAI text-embedding-3-small)
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS date TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Index for fast similarity search (IVFFlat — good for < 1M rows)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
  ON knowledge_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Semantic search function: returns knowledge entries ranked by cosine similarity
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  type text,
  tags text[],
  source text,
  date text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.title,
    ke.content,
    ke.type,
    ke.tags,
    ke.source,
    ke.date,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_entries ke
  WHERE
    ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
    AND (filter_type IS NULL OR ke.type = filter_type)
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION match_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge TO anon;
