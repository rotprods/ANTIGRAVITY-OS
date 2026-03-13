-- ═══════════════════════════════════════════════════
-- OCULOPS OS — Restore runtime tables for live functions
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS api_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'api_key',
  auth_config JSONB DEFAULT '{}'::jsonb,
  endpoints JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_connectors
  ALTER COLUMN auth_config SET DEFAULT '{}'::jsonb,
  ALTER COLUMN endpoints SET DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_api_connectors_user_active
  ON api_connectors(user_id, is_active);

ALTER TABLE api_connectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_connectors'
      AND policyname = 'auth_manage_api_connectors'
  ) THEN
    CREATE POLICY auth_manage_api_connectors
      ON api_connectors
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id OR user_id IS NULL)
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'api_connectors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE api_connectors;
  END IF;
END $$;

ALTER TABLE daily_snapshots
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS snapshot_date DATE,
  ADD COLUMN IF NOT EXISTS pipeline_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_alerts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS task_completion_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

/* UPDATE daily_snapshots removed due to non-existent columns in new schema */

ALTER TABLE daily_snapshots
  ALTER COLUMN snapshot_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN pipeline_total SET DEFAULT 0,
  ALTER COLUMN active_alerts SET DEFAULT 0,
  ALTER COLUMN task_completion_pct SET DEFAULT 0,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_user_snapshot_date
  ON daily_snapshots(user_id, snapshot_date);
