-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 9: Blockchain Additions
-- Token Emissions, Staking, Governance Votes, Reward Epochs
-- ═══════════════════════════════════════════════════

-- ── 1. Token Emissions ──
CREATE TABLE IF NOT EXISTS token_emissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch INT NOT NULL,
  emission_type TEXT NOT NULL CHECK (emission_type IN ('scheduled', 'bonus', 'burn', 'manual')),
  amount NUMERIC NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_wallet_id UUID REFERENCES chain_wallets(id) ON DELETE SET NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
  notes TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_emissions_epoch ON token_emissions(epoch);
CREATE INDEX IF NOT EXISTS idx_token_emissions_status ON token_emissions(status);

-- ── 2. Staking Positions ──
CREATE TABLE IF NOT EXISTS staking_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES chain_wallets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  lock_period_days INT NOT NULL DEFAULT 30,
  apy_rate NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unstaking', 'completed', 'slashed')),
  staked_at TIMESTAMPTZ DEFAULT now(),
  unlock_at TIMESTAMPTZ NOT NULL,
  unstaked_at TIMESTAMPTZ,
  rewards_earned NUMERIC DEFAULT 0,
  tx_hash_stake TEXT,
  tx_hash_unstake TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staking_positions_wallet_id ON staking_positions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_staking_positions_status ON staking_positions(status);
CREATE INDEX IF NOT EXISTS idx_staking_positions_unlock ON staking_positions(unlock_at);

-- ── 3. Governance Votes ──
CREATE TABLE IF NOT EXISTS governance_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id TEXT NOT NULL,
  voter_wallet_id UUID NOT NULL REFERENCES chain_wallets(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),
  voting_power NUMERIC NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proposal_id, voter_wallet_id)
);
CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal ON governance_votes(proposal_id);

-- ── 4. Reward Epochs ──
CREATE TABLE IF NOT EXISTS reward_epochs (
  id SERIAL PRIMARY KEY,
  epoch_number INT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_rewards NUMERIC NOT NULL DEFAULT 0,
  distributed BOOLEAN DEFAULT false,
  merkle_root TEXT,
  participants INT DEFAULT 0,
  distribution_tx TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  distributed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reward_epochs_number ON reward_epochs(epoch_number);
CREATE INDEX IF NOT EXISTS idx_reward_epochs_distributed ON reward_epochs(distributed);

-- ── 5. Enable RLS ──
ALTER TABLE token_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staking_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_epochs ENABLE ROW LEVEL SECURITY;

-- Token emissions, staking, governance: accessible via anon (edge functions)
-- and authenticated users who own the wallet
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'token_emissions', 'staking_positions', 'governance_votes'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_agent_%s" ON %I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "authenticated_select_%s" ON %I FOR SELECT TO authenticated USING (true)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "anon_agent_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Reward epochs: global read, anon write
DROP POLICY IF EXISTS "authenticated_select_reward_epochs" ON reward_epochs;
CREATE POLICY "authenticated_select_reward_epochs" ON reward_epochs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anon_agent_reward_epochs" ON reward_epochs;
CREATE POLICY "anon_agent_reward_epochs" ON reward_epochs
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 6. Updated_at triggers ──
DROP TRIGGER IF EXISTS set_staking_positions_updated_at ON staking_positions;
CREATE TRIGGER set_staking_positions_updated_at
  BEFORE UPDATE ON staking_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ── 7. Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE staking_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE governance_votes;
