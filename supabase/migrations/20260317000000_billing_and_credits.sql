-- ═══════════════════════════════════════════════════════════════════════════════
-- OCULOPS Credit System — Billing & Usage Tracking
-- Migration: 20260317000000_billing_and_credits.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Pricing Tiers ──────────────────────────────────────────────────────────────
-- Configurable cost table for different AI models and actions.
-- 1 credit = $0.01 USD equivalent.

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,                -- 'openai', 'anthropic', 'google', 'internal'
  model TEXT NOT NULL,                   -- 'gpt-4o', 'claude-3.5-sonnet', 'gemini-2.0-flash'
  action_type TEXT NOT NULL DEFAULT 'chat', -- 'chat', 'embedding', 'image', 'tts', 'web_search', 'api_call'
  cost_per_1k_input NUMERIC NOT NULL DEFAULT 0,    -- credits per 1K input tokens
  cost_per_1k_output NUMERIC NOT NULL DEFAULT 0,   -- credits per 1K output tokens
  cost_fixed NUMERIC NOT NULL DEFAULT 0,            -- fixed cost per invocation (for non-token actions)
  platform_margin_pct NUMERIC NOT NULL DEFAULT 20,  -- % markup over raw API cost
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_name TEXT,                     -- human-friendly name for UI
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model, action_type)
);

-- Seed initial pricing (based on March 2026 API costs × 1.2 margin)
INSERT INTO pricing_tiers (provider, model, action_type, cost_per_1k_input, cost_per_1k_output, display_name) VALUES
  ('openai',    'gpt-4o',               'chat', 0.30, 1.20, 'GPT-4o'),
  ('openai',    'gpt-4o-mini',          'chat', 0.02, 0.08, 'GPT-4o Mini'),
  ('openai',    'o3-mini',              'chat', 0.13, 0.55, 'o3-mini'),
  ('anthropic', 'claude-3.5-sonnet',    'chat', 0.36, 1.80, 'Claude 3.5 Sonnet'),
  ('anthropic', 'claude-3.5-haiku',     'chat', 0.10, 0.50, 'Claude 3.5 Haiku'),
  ('google',    'gemini-2.0-flash',     'chat', 0.01, 0.04, 'Gemini 2.0 Flash'),
  ('internal',  'web_search',           'web_search', 0, 0, 'Web Search'),
  ('internal',  'api_call',             'api_call', 0, 0, 'API Call')
ON CONFLICT (provider, model, action_type) DO NOTHING;

-- Set fixed costs for non-token-based actions
UPDATE pricing_tiers SET cost_fixed = 0.5  WHERE model = 'web_search';
UPDATE pricing_tiers SET cost_fixed = 0.2  WHERE model = 'api_call';


-- ─── Credit Balances ────────────────────────────────────────────────────────────
-- One row per org. Tracks available credits + lifetime spend.

CREATE TABLE IF NOT EXISTS credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  available_credits NUMERIC NOT NULL DEFAULT 100,  -- start with 100 free credits
  lifetime_credits_purchased NUMERIC NOT NULL DEFAULT 0,
  lifetime_credits_spent NUMERIC NOT NULL DEFAULT 0,
  lifetime_credits_bonus NUMERIC NOT NULL DEFAULT 100, -- initial free grant
  billing_mode TEXT NOT NULL DEFAULT 'managed' CHECK (billing_mode IN ('managed', 'developer')),
  low_balance_alert_threshold NUMERIC NOT NULL DEFAULT 10,
  last_top_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);


-- ─── Usage Logs ─────────────────────────────────────────────────────────────────
-- Every AI action gets logged. This is the billing source-of-truth.

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  agent_code TEXT,                       -- 'sentinel', 'oracle', 'copilot', etc.
  provider TEXT NOT NULL,                -- 'openai', 'anthropic', 'internal'
  model TEXT NOT NULL,                   -- 'gpt-4o', 'claude-3.5-sonnet'
  action_type TEXT NOT NULL DEFAULT 'chat',
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  total_tokens INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  credits_charged NUMERIC NOT NULL DEFAULT 0,
  raw_api_cost_usd NUMERIC DEFAULT 0,   -- actual cost to platform (for P&L tracking)
  used_custom_key BOOLEAN NOT NULL DEFAULT false,  -- true = developer mode, no credit charge
  metadata JSONB DEFAULT '{}',           -- extra info (skill used, goal, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard queries (usage by org, by day)
CREATE INDEX IF NOT EXISTS idx_usage_logs_org_created ON usage_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_agent ON usage_logs(agent_code, created_at DESC);


-- ─── Developer Mode: Custom API Keys ───────────────────────────────────────────
-- Encrypted storage for user-provided API keys.

CREATE TABLE IF NOT EXISTS custom_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                -- 'openai', 'anthropic', 'google'
  encrypted_key TEXT NOT NULL,           -- AES-256-GCM encrypted via Supabase Vault
  key_hint TEXT,                         -- last 4 chars, e.g. '...sk-abc1234' for UI display
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);


-- ─── RLS Policies ───────────────────────────────────────────────────────────────

ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Pricing tiers: readable by everyone (it's public pricing info)
CREATE POLICY "pricing_tiers_public_read" ON pricing_tiers
  FOR SELECT USING (true);

-- Credit balances: org members can read their org's balance
CREATE POLICY "credit_balances_org_read" ON credit_balances
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Usage logs: org members can read their org's usage
CREATE POLICY "usage_logs_org_read" ON usage_logs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Custom API keys: only org admins can manage
CREATE POLICY "custom_api_keys_org_admin_all" ON custom_api_keys
  FOR ALL USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );


-- ─── Helper RPCs ────────────────────────────────────────────────────────────────

-- Check if org has enough credits for an action
CREATE OR REPLACE FUNCTION check_credits(p_org_id UUID, p_amount NUMERIC DEFAULT 1)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT available_credits >= p_amount FROM credit_balances WHERE org_id = p_org_id),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Deduct credits atomically (called by billing engine after successful API call)
CREATE OR REPLACE FUNCTION deduct_credits(p_org_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE credit_balances
  SET available_credits = available_credits - p_amount,
      lifetime_credits_spent = lifetime_credits_spent + p_amount,
      updated_at = now()
  WHERE org_id = p_org_id AND available_credits >= p_amount
  RETURNING available_credits INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient credits for org %', p_org_id;
  END IF;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add credits (for purchases, bonuses, etc.)
CREATE OR REPLACE FUNCTION add_credits(p_org_id UUID, p_amount NUMERIC, p_is_purchase BOOLEAN DEFAULT true)
RETURNS NUMERIC AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  INSERT INTO credit_balances (org_id, available_credits, lifetime_credits_purchased, lifetime_credits_bonus)
  VALUES (
    p_org_id,
    p_amount,
    CASE WHEN p_is_purchase THEN p_amount ELSE 0 END,
    CASE WHEN p_is_purchase THEN 0 ELSE p_amount END
  )
  ON CONFLICT (org_id) DO UPDATE SET
    available_credits = credit_balances.available_credits + p_amount,
    lifetime_credits_purchased = credit_balances.lifetime_credits_purchased +
      CASE WHEN p_is_purchase THEN p_amount ELSE 0 END,
    lifetime_credits_bonus = credit_balances.lifetime_credits_bonus +
      CASE WHEN p_is_purchase THEN 0 ELSE p_amount END,
    last_top_up_at = now(),
    updated_at = now()
  RETURNING available_credits INTO v_new_balance;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create credit balance for new orgs (100 free credits)
CREATE OR REPLACE FUNCTION auto_create_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO credit_balances (org_id, available_credits, lifetime_credits_bonus)
  VALUES (NEW.id, 100, 100)
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_auto_credit_balance
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION auto_create_credit_balance();
