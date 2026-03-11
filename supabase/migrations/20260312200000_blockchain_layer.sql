-- ============================================================
-- OCULOPS CHAIN — Blockchain Integration Schema
-- Migration: Add chain-related tables for token, settlements,
--            treasury, rewards, wallets, and audit trail
-- ============================================================

-- 1. Chain Wallets
CREATE TABLE IF NOT EXISTS public.chain_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID, -- references organizations if multi-tenancy
  address TEXT NOT NULL UNIQUE,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN (
    'user_custodial', 'org_custodial', 'treasury',
    'rewards_pool', 'user_external', 'org_multisig'
  )),
  label TEXT, -- human-readable name
  encrypted_private_key TEXT, -- AES-256-GCM encrypted, NULL for external
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chain_wallets_user ON public.chain_wallets(user_id);
CREATE INDEX idx_chain_wallets_address ON public.chain_wallets(address);

-- 2. Token Balances (cached from chain)
CREATE TABLE IF NOT EXISTS public.chain_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.chain_wallets(id) ON DELETE CASCADE NOT NULL,
  token_address TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wallet_id, token_address)
);

-- 3. Distribution Rules
CREATE TABLE IF NOT EXISTS public.distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- rules format: [{"role":"provider","pct":70},{"role":"platform","pct":20},{"role":"treasury","pct":10}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Settlements
CREATE TABLE IF NOT EXISTS public.chain_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  batch_id UUID,
  payer_wallet_id UUID REFERENCES public.chain_wallets(id),
  payee_wallet_id UUID REFERENCES public.chain_wallets(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'OCUL',
  status TEXT DEFAULT 'created' CHECK (status IN (
    'created', 'validated', 'batched', 'submitted',
    'confirmed', 'failed', 'expired', 'distributed'
  )),
  distribution_rule_id UUID REFERENCES public.distribution_rules(id),
  correlation_id TEXT, -- links to main OCULOPS records (deal, campaign, etc.)
  correlation_type TEXT, -- 'deal', 'campaign', 'reward', etc.
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chain_settlements_status ON public.chain_settlements(status);
CREATE INDEX idx_chain_settlements_batch ON public.chain_settlements(batch_id);
CREATE INDEX idx_chain_settlements_correlation ON public.chain_settlements(correlation_id);

-- 5. Settlement Batches
CREATE TABLE IF NOT EXISTS public.chain_settlement_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_hash TEXT UNIQUE,
  settlement_count INT NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'confirmed', 'failed'
  )),
  tx_hash TEXT,
  block_number BIGINT,
  gas_used NUMERIC,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Reward Events
CREATE TABLE IF NOT EXISTS public.chain_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.chain_wallets(id) NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  reason_ref_id UUID, -- reference to the entity that triggered the reward
  epoch INT NOT NULL,
  merkle_proof JSONB,
  claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chain_rewards_wallet ON public.chain_rewards(wallet_id);
CREATE INDEX idx_chain_rewards_epoch ON public.chain_rewards(epoch);

-- 7. Treasury Movements
CREATE TABLE IF NOT EXISTS public.chain_treasury_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet_id UUID REFERENCES public.chain_wallets(id),
  to_wallet_id UUID REFERENCES public.chain_wallets(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  approved_by TEXT[] DEFAULT '{}', -- array of approver addresses
  required_approvals INT DEFAULT 2,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'executed', 'rejected', 'cancelled'
  )),
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- 8. Chain Transactions (log of ALL onchain txs)
CREATE TABLE IF NOT EXISTS public.chain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  contract_address TEXT,
  function_name TEXT,
  args JSONB,
  value_wei NUMERIC DEFAULT 0,
  gas_used NUMERIC,
  gas_price NUMERIC,
  block_number BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'failed', 'reverted'
  )),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_chain_tx_hash ON public.chain_transactions(tx_hash);
CREATE INDEX idx_chain_tx_status ON public.chain_transactions(status);

-- 9. Contract Registry
CREATE TABLE IF NOT EXISTS public.chain_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  chain_id INT NOT NULL DEFAULT 1440002, -- XRPL EVM Sidechain Devnet
  chain_name TEXT DEFAULT 'xrpl-evm',
  abi JSONB NOT NULL DEFAULT '[]'::jsonb,
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  deployed_at TIMESTAMPTZ,
  deployer_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Chain Audit Log
CREATE TABLE IF NOT EXISTS public.chain_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id UUID, -- supabase user id
  actor_address TEXT, -- chain address
  details JSONB DEFAULT '{}'::jsonb,
  onchain_hash TEXT, -- stored onchain for verification
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chain_audit_event ON public.chain_audit_log(event_type);
CREATE INDEX idx_chain_audit_entity ON public.chain_audit_log(entity_type, entity_id);

-- 11. Chain Config (key-value store for chain settings)
CREATE TABLE IF NOT EXISTS public.chain_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed chain config defaults
INSERT INTO public.chain_config (key, value, description) VALUES
  ('chain_id', '1440002', 'Active chain ID (1440000=XRPL EVM Mainnet, 1440002=XRPL EVM Devnet)'),
  ('token_address', '""', 'OCUL token contract address'),
  ('treasury_address', '""', 'Treasury contract address'),
  ('settlement_address', '""', 'Settlement contract address'),
  ('rewards_address', '""', 'Rewards contract address'),
  ('settlement_batch_interval_minutes', '60', 'Minutes between settlement batch processing'),
  ('settlement_batch_threshold', '50', 'Min settlements to trigger immediate batch'),
  ('max_settlement_amount', '"100000"', 'Max OCUL per individual settlement'),
  ('rewards_epoch_days', '7', 'Days per reward epoch'),
  ('bridge_enabled', 'false', 'Whether chain bridge is active')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RLS Policies (dev-friendly)
-- ============================================================
ALTER TABLE public.chain_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_treasury_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_config ENABLE ROW LEVEL SECURITY;

-- Dev-friendly policies: allow anon read/write for development
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'chain_wallets', 'chain_balances', 'distribution_rules',
    'chain_settlements', 'chain_settlement_batches', 'chain_rewards',
    'chain_treasury_movements', 'chain_transactions', 'chain_contracts',
    'chain_audit_log', 'chain_config'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY "Allow anon read for dev" ON public.%I FOR SELECT TO anon USING (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Allow anon write for dev" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Allow authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- Realtime (enable on critical tables)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chain_settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chain_settlement_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chain_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chain_treasury_movements;
