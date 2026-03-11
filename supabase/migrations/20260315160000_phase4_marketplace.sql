-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 4: Marketplace
-- Seller/Buyer Profiles, Listings, Orders, Reviews, Disputes
-- ═══════════════════════════════════════════════════

-- ── 1. Seller Profiles ──
CREATE TABLE IF NOT EXISTS seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  rating_avg NUMERIC DEFAULT 0,
  review_count INT DEFAULT 0,
  total_sales INT DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'banned')),
  verification JSONB DEFAULT '{}',
  wallet_id UUID REFERENCES chain_wallets(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_org_id ON seller_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON seller_profiles(status);

-- ── 2. Buyer Profiles ──
CREATE TABLE IF NOT EXISTS buyer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  rating_avg NUMERIC DEFAULT 0,
  review_count INT DEFAULT 0,
  total_purchases INT DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  wallet_id UUID REFERENCES chain_wallets(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_org_id ON buyer_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user_id ON buyer_profiles(user_id);

-- ── 3. Market Listings ──
CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT DEFAULT 'USD',
  price_model TEXT DEFAULT 'one_time' CHECK (price_model IN ('one_time', 'subscription', 'usage', 'free')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'sold_out', 'removed')),
  images JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  rating_avg NUMERIC DEFAULT 0,
  review_count INT DEFAULT 0,
  sales_count INT DEFAULT 0,
  license_type TEXT DEFAULT 'standard',
  deliverable JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_listings_org_id ON market_listings(org_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_seller_id ON market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_category ON market_listings(category);
CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings(status);
CREATE INDEX IF NOT EXISTS idx_market_listings_tags ON market_listings USING GIN (tags);

-- ── 4. Market Orders ──
CREATE TABLE IF NOT EXISTS market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  quantity INT DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'disputed')),
  payment_method TEXT,
  payment_ref TEXT,
  settlement_id UUID REFERENCES chain_settlements(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_orders_org_id ON market_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_market_orders_buyer_id ON market_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_market_orders_seller_id ON market_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_market_orders_status ON market_orders(status);

-- ── 5. Market Reviews ──
CREATE TABLE IF NOT EXISTS market_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES market_orders(id) ON DELETE CASCADE UNIQUE,
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  is_verified BOOLEAN DEFAULT true,
  seller_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_reviews_listing_id ON market_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_market_reviews_reviewer_id ON market_reviews(reviewer_id);

-- ── 6. Market Disputes ──
CREATE TABLE IF NOT EXISTS market_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES market_orders(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (reason IN ('not_delivered', 'not_as_described', 'quality', 'unauthorized', 'other')),
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved_buyer', 'resolved_seller', 'escalated', 'closed')),
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_disputes_order_id ON market_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_market_disputes_status ON market_disputes(status);

-- ── 7. Enable RLS + Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'seller_profiles', 'buyer_profiles', 'market_listings',
    'market_orders', 'market_reviews', 'market_disputes'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "org_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_insert_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_update_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_delete_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_agent_%s" ON %I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "org_select_%s" ON %I FOR SELECT TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "org_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "org_update_%s" ON %I FOR UPDATE TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL) WITH CHECK (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "org_delete_%s" ON %I FOR DELETE TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "anon_agent_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 8. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'seller_profiles', 'buyer_profiles', 'market_listings',
    'market_orders', 'market_reviews', 'market_disputes'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 9. Auto-set org_id triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'seller_profiles', 'buyer_profiles', 'market_listings',
    'market_orders', 'market_reviews', 'market_disputes'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;

-- ── 10. Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE market_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE market_disputes;
