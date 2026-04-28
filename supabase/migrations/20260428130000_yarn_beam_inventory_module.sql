-- ============================================================
-- MIGRATION: Module 2 — Yarn + Beam Inventory
-- Tracks yarn lots, stock movements, beam cards, and order-level
-- yarn requirement snapshots generated from the estimator.
-- ============================================================

-- ============================================================
-- 1. YARN LOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS yarn_lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  supplier TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  yarn_type TEXT NOT NULL,
  denier_count TEXT NOT NULL,
  filament_material TEXT NOT NULL,
  received_kg NUMERIC(12,3) NOT NULL CHECK (received_kg >= 0),
  received_cones INTEGER NOT NULL DEFAULT 0 CHECK (received_cones >= 0),
  rate_per_kg NUMERIC(12,2) NOT NULL CHECK (rate_per_kg >= 0),
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (gst_percent >= 0 AND gst_percent <= 100),
  total_cost NUMERIC(14,2) NOT NULL CHECK (total_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yarn_lots_org_date
  ON yarn_lots(org_id, bill_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yarn_lots_org_bill
  ON yarn_lots(org_id, bill_no);

-- ============================================================
-- 2. BEAM CARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS beam_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  beam_no TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  quality_label TEXT NOT NULL,
  beam_ends INTEGER NOT NULL DEFAULT 0 CHECK (beam_ends >= 0),
  tape_length_m NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tape_length_m >= 0),
  expected_metres NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (expected_metres >= 0),
  actual_beam_weight_kg NUMERIC(12,3) CHECK (actual_beam_weight_kg IS NULL OR actual_beam_weight_kg >= 0),
  sizing_vendor TEXT,
  sizing_bill_no TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT beam_cards_org_beam_no_unique UNIQUE (org_id, beam_no)
);

CREATE INDEX IF NOT EXISTS idx_beam_cards_org_created
  ON beam_cards(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beam_cards_org_order
  ON beam_cards(org_id, order_id);

-- ============================================================
-- 3. ORDER YARN REQUIREMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS order_yarn_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  quote_id UUID REFERENCES estimator_quotes(id) ON DELETE SET NULL,
  warp_required_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (warp_required_kg >= 0),
  weft_required_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (weft_required_kg >= 0),
  total_required_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (total_required_kg >= 0),
  estimated_beams INTEGER CHECK (estimated_beams IS NULL OR estimated_beams >= 0),
  requirement_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_yarn_requirements_order_id_unique UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_yarn_requirements_org_order
  ON order_yarn_requirements(org_id, order_id);

-- ============================================================
-- 4. YARN MOVEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS yarn_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  yarn_lot_id UUID REFERENCES yarn_lots(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  beam_card_id UUID REFERENCES beam_cards(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN (
      'purchase',
      'issue_to_warping',
      'issue_to_sizing',
      'issue_to_loom_weft',
      'return_leftover',
      'adjustment'
    )
  ),
  adjustment_mode TEXT CHECK (
    adjustment_mode IS NULL OR adjustment_mode IN ('add', 'subtract')
  ),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  cones INTEGER NOT NULL DEFAULT 0 CHECK (cones >= 0),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT yarn_movements_adjustment_mode_required
    CHECK (
      (movement_type = 'adjustment' AND adjustment_mode IS NOT NULL)
      OR
      (movement_type <> 'adjustment' AND adjustment_mode IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_yarn_movements_org_date
  ON yarn_movements(org_id, movement_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yarn_movements_org_lot
  ON yarn_movements(org_id, yarn_lot_id);

CREATE INDEX IF NOT EXISTS idx_yarn_movements_org_order
  ON yarn_movements(org_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yarn_movements_org_beam
  ON yarn_movements(org_id, beam_card_id)
  WHERE beam_card_id IS NOT NULL;

-- ============================================================
-- 5. BEAM CARD LOTS (aggregated usage per beam)
-- ============================================================

CREATE TABLE IF NOT EXISTS beam_card_lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  beam_card_id UUID REFERENCES beam_cards(id) ON DELETE CASCADE NOT NULL,
  yarn_lot_id UUID REFERENCES yarn_lots(id) ON DELETE CASCADE NOT NULL,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('warp', 'weft')),
  issued_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (issued_kg >= 0),
  issued_cones INTEGER NOT NULL DEFAULT 0 CHECK (issued_cones >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT beam_card_lots_unique_usage UNIQUE (beam_card_id, yarn_lot_id, usage_type)
);

CREATE INDEX IF NOT EXISTS idx_beam_card_lots_org_beam
  ON beam_card_lots(org_id, beam_card_id);

CREATE INDEX IF NOT EXISTS idx_beam_card_lots_org_lot
  ON beam_card_lots(org_id, yarn_lot_id);

-- ============================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_yarn_lots_updated_at ON yarn_lots;
CREATE TRIGGER trg_yarn_lots_updated_at
  BEFORE UPDATE ON yarn_lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_beam_cards_updated_at ON beam_cards;
CREATE TRIGGER trg_beam_cards_updated_at
  BEFORE UPDATE ON beam_cards
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_order_yarn_requirements_updated_at ON order_yarn_requirements;
CREATE TRIGGER trg_order_yarn_requirements_updated_at
  BEFORE UPDATE ON order_yarn_requirements
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_beam_card_lots_updated_at ON beam_card_lots;
CREATE TRIGGER trg_beam_card_lots_updated_at
  BEFORE UPDATE ON beam_card_lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 7. RLS
-- ============================================================

ALTER TABLE yarn_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE beam_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_yarn_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE yarn_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE beam_card_lots ENABLE ROW LEVEL SECURITY;

-- Yarn lots
CREATE POLICY "Tenant Isolation Select Yarn Lots V2" ON yarn_lots
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Owners Manage Yarn Lots V2" ON yarn_lots
  FOR ALL
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- Beam cards
CREATE POLICY "Tenant Isolation Select Beam Cards" ON beam_cards
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Org Members Insert Beam Cards" ON beam_cards
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Org Members Update Beam Cards" ON beam_cards
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Owners Delete Beam Cards" ON beam_cards
  FOR DELETE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- Order yarn requirements
CREATE POLICY "Tenant Isolation Select Order Yarn Requirements" ON order_yarn_requirements
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Owners Manage Order Yarn Requirements" ON order_yarn_requirements
  FOR ALL
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- Yarn movements
CREATE POLICY "Tenant Isolation Select Yarn Movements" ON yarn_movements
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Org Members Insert Yarn Movements" ON yarn_movements
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Org Members Update Yarn Movements" ON yarn_movements
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Owners Delete Yarn Movements" ON yarn_movements
  FOR DELETE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- Beam card lots
CREATE POLICY "Tenant Isolation Select Beam Card Lots" ON beam_card_lots
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "Org Members Insert Beam Card Lots" ON beam_card_lots
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Org Members Update Beam Card Lots" ON beam_card_lots
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Owners Delete Beam Card Lots" ON beam_card_lots
  FOR DELETE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- ============================================================
-- 8. STOCK + VARIANCE VIEWS
-- ============================================================

DROP VIEW IF EXISTS yarn_lot_stock_summary;
CREATE OR REPLACE VIEW yarn_lot_stock_summary AS
SELECT
  yl.id,
  yl.org_id,
  yl.supplier,
  yl.bill_no,
  yl.bill_date,
  yl.yarn_type,
  yl.denier_count,
  yl.filament_material,
  yl.received_kg,
  yl.received_cones,
  yl.rate_per_kg,
  yl.gst_percent,
  yl.total_cost,
  yl.notes,
  yl.created_at,
  yl.updated_at,
  (
    yl.received_kg
    + COALESCE(SUM(
      CASE
        WHEN ym.movement_type = 'return_leftover' THEN ym.quantity_kg
        WHEN ym.movement_type = 'adjustment' AND ym.adjustment_mode = 'add' THEN ym.quantity_kg
        WHEN ym.movement_type IN ('issue_to_warping', 'issue_to_sizing', 'issue_to_loom_weft') THEN -ym.quantity_kg
        WHEN ym.movement_type = 'adjustment' AND ym.adjustment_mode = 'subtract' THEN -ym.quantity_kg
        ELSE 0
      END
    ), 0)
  )::NUMERIC(12,3) AS available_kg,
  (
    yl.received_cones
    + COALESCE(SUM(
      CASE
        WHEN ym.movement_type = 'return_leftover' THEN ym.cones
        WHEN ym.movement_type = 'adjustment' AND ym.adjustment_mode = 'add' THEN ym.cones
        WHEN ym.movement_type IN ('issue_to_warping', 'issue_to_sizing', 'issue_to_loom_weft') THEN -ym.cones
        WHEN ym.movement_type = 'adjustment' AND ym.adjustment_mode = 'subtract' THEN -ym.cones
        ELSE 0
      END
    ), 0)
  )::INTEGER AS available_cones
FROM yarn_lots yl
LEFT JOIN yarn_movements ym
  ON ym.yarn_lot_id = yl.id
 AND ym.org_id = yl.org_id
GROUP BY yl.id;

DROP VIEW IF EXISTS order_yarn_variance_summary;
CREATE OR REPLACE VIEW order_yarn_variance_summary AS
SELECT
  oyr.id,
  oyr.org_id,
  oyr.order_id,
  oyr.quote_id,
  o.party_name,
  COALESCE(o.quality_label, 'Unlabelled') AS quality_label,
  o.total_target_meters,
  o.status AS order_status,
  oyr.warp_required_kg,
  oyr.weft_required_kg,
  oyr.total_required_kg,
  oyr.estimated_beams,
  oyr.requirement_snapshot,
  COALESCE(SUM(CASE WHEN ym.movement_type IN ('issue_to_warping', 'issue_to_sizing') THEN ym.quantity_kg ELSE 0 END), 0)::NUMERIC(12,3) AS warp_issued_kg,
  COALESCE(SUM(CASE WHEN ym.movement_type = 'issue_to_loom_weft' THEN ym.quantity_kg ELSE 0 END), 0)::NUMERIC(12,3) AS weft_issued_kg,
  COALESCE(SUM(CASE WHEN ym.movement_type IN ('issue_to_warping', 'issue_to_sizing', 'issue_to_loom_weft') THEN ym.quantity_kg ELSE 0 END), 0)::NUMERIC(12,3) AS total_issued_kg,
  COALESCE(SUM(CASE WHEN ym.movement_type = 'return_leftover' THEN ym.quantity_kg ELSE 0 END), 0)::NUMERIC(12,3) AS leftover_kg,
  (
    COALESCE(SUM(CASE WHEN ym.movement_type IN ('issue_to_warping', 'issue_to_sizing', 'issue_to_loom_weft') THEN ym.quantity_kg ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ym.movement_type = 'return_leftover' THEN ym.quantity_kg ELSE 0 END), 0)
  )::NUMERIC(12,3) AS net_consumed_kg,
  (
    (
      COALESCE(SUM(CASE WHEN ym.movement_type IN ('issue_to_warping', 'issue_to_sizing', 'issue_to_loom_weft') THEN ym.quantity_kg ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN ym.movement_type = 'return_leftover' THEN ym.quantity_kg ELSE 0 END), 0)
    )
    - oyr.total_required_kg
  )::NUMERIC(12,3) AS variance_kg,
  oyr.created_at,
  oyr.updated_at
FROM order_yarn_requirements oyr
JOIN orders o
  ON o.id = oyr.order_id
LEFT JOIN yarn_movements ym
  ON ym.order_id = oyr.order_id
 AND ym.org_id = oyr.org_id
GROUP BY oyr.id, oyr.org_id, oyr.order_id, oyr.quote_id, o.party_name, o.quality_label,
         o.total_target_meters, o.status, oyr.warp_required_kg, oyr.weft_required_kg,
         oyr.total_required_kg, oyr.estimated_beams, oyr.requirement_snapshot, oyr.created_at, oyr.updated_at;

-- ============================================================
-- 9. AUDIT TRIGGERS
-- ============================================================

CREATE TRIGGER audit_yarn_lots
  AFTER INSERT OR UPDATE OR DELETE ON yarn_lots
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_beam_cards
  AFTER INSERT OR UPDATE OR DELETE ON beam_cards
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_order_yarn_requirements
  AFTER INSERT OR UPDATE OR DELETE ON order_yarn_requirements
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_yarn_movements
  AFTER INSERT OR UPDATE OR DELETE ON yarn_movements
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_beam_card_lots
  AFTER INSERT OR UPDATE OR DELETE ON beam_card_lots
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
