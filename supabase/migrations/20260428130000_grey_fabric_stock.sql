-- ============================================================
-- MIGRATION: Grey Fabric Stock + Package Dispatch
-- Adds package-level saleable stock, package dispatch lines,
-- receipt-linked claims, and owner/supervisor stock controls.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1. ORDER → PARTY LINK
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id) ON DELETE SET NULL;

UPDATE orders o
SET party_id = p.id
FROM parties p
WHERE o.party_id IS NULL
  AND p.org_id = o.org_id
  AND lower(trim(p.name)) = lower(trim(o.party_name));

CREATE INDEX IF NOT EXISTS idx_orders_party_id
  ON orders(party_id)
  WHERE party_id IS NOT NULL;

-- ============================================================
-- 2. FABRIC PACKAGES
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS fabric_package_no_seq;

CREATE TABLE IF NOT EXISTS fabric_packages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  parent_package_id    UUID REFERENCES fabric_packages(id) ON DELETE SET NULL,
  package_no           TEXT NOT NULL,
  package_type         TEXT NOT NULL DEFAULT 'bulk'
                         CHECK (package_type IN ('roll','bale','package','bulk')),
  units_count          INTEGER NOT NULL DEFAULT 1 CHECK (units_count > 0),
  metres               NUMERIC(10,2) NOT NULL CHECK (metres > 0),
  grade                TEXT NOT NULL DEFAULT 'A',
  inspection_status    TEXT NOT NULL DEFAULT 'pending'
                         CHECK (inspection_status IN ('pending','pass','minor_defect','reject')),
  stock_state          TEXT NOT NULL DEFAULT 'uninspected'
                         CHECK (stock_state IN ('uninspected','ready','reserved','dispatched','claimed','returned')),
  location             TEXT NOT NULL DEFAULT 'Grey Floor',
  inspection_notes     TEXT,
  inspection_photo_url TEXT,
  source_date          DATE,
  source_shift         TEXT CHECK (source_shift IS NULL OR source_shift IN ('day','night')),
  source_reference     TEXT,
  correction_note      TEXT,
  inspected_at         TIMESTAMPTZ,
  inspected_by         UUID REFERENCES auth.users(id),
  corrected_at         TIMESTAMPTZ,
  corrected_by         UUID REFERENCES auth.users(id),
  created_by           UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fabric_packages_org_package_no
  ON fabric_packages(org_id, lower(package_no));

CREATE INDEX IF NOT EXISTS idx_fabric_packages_org_state
  ON fabric_packages(org_id, stock_state, inspection_status);

CREATE INDEX IF NOT EXISTS idx_fabric_packages_order_id
  ON fabric_packages(order_id, stock_state);

CREATE OR REPLACE FUNCTION assign_fabric_package_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.package_no IS NULL OR btrim(NEW.package_no) = '' THEN
    NEW.package_no := 'GF-' || lpad(nextval('fabric_package_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_fabric_package_no ON fabric_packages;
CREATE TRIGGER trg_assign_fabric_package_no
  BEFORE INSERT ON fabric_packages
  FOR EACH ROW EXECUTE FUNCTION assign_fabric_package_no();

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fabric_packages_updated_at ON fabric_packages;
CREATE TRIGGER trg_fabric_packages_updated_at
  BEFORE UPDATE ON fabric_packages
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 3. DISPATCH PACKAGE LINES
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_package_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dispatch_id          UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  package_id           UUID NOT NULL REFERENCES fabric_packages(id) ON DELETE RESTRICT,
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  package_no           TEXT NOT NULL,
  package_type         TEXT NOT NULL,
  units_count          INTEGER NOT NULL DEFAULT 1,
  grade                TEXT NOT NULL DEFAULT 'A',
  inspection_status    TEXT NOT NULL DEFAULT 'pending',
  location_snapshot    TEXT,
  qty_meters_sent      NUMERIC(10,2) NOT NULL CHECK (qty_meters_sent > 0),
  qty_meters_received  NUMERIC(10,2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_package_lines_dispatch_package
  ON dispatch_package_lines(dispatch_id, package_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_package_lines_dispatch_id
  ON dispatch_package_lines(dispatch_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_package_lines_package_id
  ON dispatch_package_lines(package_id);

-- ============================================================
-- 4. PARTY DISPATCH CLAIMS
-- ============================================================

CREATE TABLE IF NOT EXISTS party_dispatch_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  party_id          UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  dispatch_id       UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  package_id        UUID REFERENCES fabric_packages(id) ON DELETE SET NULL,
  package_line_id   UUID REFERENCES dispatch_package_lines(id) ON DELETE SET NULL,
  claim_type        TEXT NOT NULL DEFAULT 'shortage'
                      CHECK (claim_type IN ('shortage','return','quality_claim','other')),
  claim_status      TEXT NOT NULL DEFAULT 'open'
                      CHECK (claim_status IN ('open','resolved')),
  claim_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  shortage_meters   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shortage_meters >= 0),
  amount            NUMERIC(14,2) CHECK (amount IS NULL OR amount >= 0),
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_dispatch_claims_party_id
  ON party_dispatch_claims(party_id, claim_date DESC);

CREATE INDEX IF NOT EXISTS idx_party_dispatch_claims_dispatch_id
  ON party_dispatch_claims(dispatch_id)
  WHERE dispatch_id IS NOT NULL;

-- ============================================================
-- 5. PARTY LEDGER VIEW EXTENSION
-- ============================================================

CREATE OR REPLACE VIEW party_ledger_entries AS
SELECT
  p.org_id,
  p.id AS party_id,
  p.id AS source_id,
  'opening'::TEXT AS entry_type,
  p.created_at::DATE AS entry_date,
  'Opening Balance'::TEXT AS reference,
  NULL::TEXT AS notes,
  CASE WHEN p.opening_balance_type = 'receivable' THEN p.opening_balance ELSE 0 END AS debit_amount,
  CASE WHEN p.opening_balance_type = 'payable' THEN p.opening_balance ELSE 0 END AS credit_amount,
  p.created_at
FROM parties p
WHERE p.opening_balance > 0

UNION ALL

SELECT
  i.org_id,
  i.party_id,
  i.id AS source_id,
  'invoice'::TEXT AS entry_type,
  i.invoice_date AS entry_date,
  i.invoice_number AS reference,
  i.notes,
  i.net_amount AS debit_amount,
  0::NUMERIC(14,2) AS credit_amount,
  i.created_at
FROM party_invoices i
WHERE i.status <> 'cancelled'

UNION ALL

SELECT
  r.org_id,
  r.party_id,
  r.id AS source_id,
  'receipt'::TEXT AS entry_type,
  r.receipt_date AS entry_date,
  COALESCE(r.reference_no, initcap(r.method)) AS reference,
  r.notes,
  0::NUMERIC(14,2) AS debit_amount,
  r.amount AS credit_amount,
  r.created_at
FROM party_receipts r

UNION ALL

SELECT
  a.org_id,
  a.party_id,
  a.id AS source_id,
  'adjustment'::TEXT AS entry_type,
  a.adjustment_date AS entry_date,
  replace(initcap(a.adjustment_type), '_', ' ') AS reference,
  a.notes,
  CASE WHEN a.direction = 'debit_to_party' THEN a.amount ELSE 0 END AS debit_amount,
  CASE WHEN a.direction = 'credit_to_party' THEN a.amount ELSE 0 END AS credit_amount,
  a.created_at
FROM party_adjustments a

UNION ALL

SELECT
  c.org_id,
  c.party_id,
  c.id AS source_id,
  'dispatch_claim'::TEXT AS entry_type,
  c.claim_date AS entry_date,
  COALESCE('Dispatch #' || d.dispatch_number::TEXT || ' ' || replace(initcap(c.claim_type), '_', ' '), replace(initcap(c.claim_type), '_', ' ')) AS reference,
  CASE
    WHEN c.shortage_meters > 0
      THEN COALESCE(c.notes, '') || CASE WHEN c.notes IS NULL OR c.notes = '' THEN '' ELSE ' · ' END || c.shortage_meters::TEXT || ' m'
    ELSE c.notes
  END AS notes,
  0::NUMERIC(14,2) AS debit_amount,
  COALESCE(c.amount, 0)::NUMERIC(14,2) AS credit_amount,
  c.created_at
FROM party_dispatch_claims c
LEFT JOIN dispatches d ON d.id = c.dispatch_id;

-- ============================================================
-- 6. RLS
-- ============================================================

ALTER TABLE fabric_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_package_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_dispatch_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fabric_packages_org_select"
  ON fabric_packages FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "fabric_packages_org_insert"
  ON fabric_packages FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_packages_org_update"
  ON fabric_packages FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "dispatch_package_lines_org_select"
  ON dispatch_package_lines FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "dispatch_package_lines_org_insert"
  ON dispatch_package_lines FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "dispatch_package_lines_org_update"
  ON dispatch_package_lines FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_dispatch_claims_org_select"
  ON party_dispatch_claims FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "party_dispatch_claims_org_insert"
  ON party_dispatch_claims FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_dispatch_claims_owner_update"
  ON party_dispatch_claims FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- ============================================================
-- 7. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE fabric_packages;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_package_lines;

-- ============================================================
-- 8. RPC: CREATE PACKAGE-LEVEL DISPATCH
-- ============================================================

CREATE OR REPLACE FUNCTION create_fabric_dispatch(
  p_org_id UUID,
  p_order_id UUID,
  p_package_ids UUID[],
  p_notes TEXT,
  p_created_by UUID
)
RETURNS TABLE (
  dispatch_id UUID,
  dispatch_number INTEGER,
  qty_meters_sent NUMERIC,
  tracking_token TEXT,
  party_name TEXT,
  org_name TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dispatch_id UUID;
  v_dispatch_number INTEGER;
  v_total NUMERIC(10,2);
  v_package_count INTEGER;
  v_selected_count INTEGER;
  v_party_name TEXT;
  v_tracking_token TEXT;
  v_org_name TEXT;
  v_status TEXT;
BEGIN
  v_selected_count := COALESCE(array_length(p_package_ids, 1), 0);
  IF v_selected_count = 0 THEN
    RAISE EXCEPTION 'Select at least one package to dispatch';
  END IF;

  SELECT o.party_name, o.tracking_token, o.status, org.name
    INTO v_party_name, v_tracking_token, v_status, v_org_name
  FROM orders o
  JOIN organizations org ON org.id = o.org_id
  WHERE o.id = p_order_id
    AND o.org_id = p_org_id;

  IF v_tracking_token IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Cannot dispatch from a completed or cancelled order';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(fp.metres), 0)
    INTO v_package_count, v_total
  FROM fabric_packages fp
  WHERE fp.org_id = p_org_id
    AND fp.order_id = p_order_id
    AND fp.id = ANY(p_package_ids)
    AND fp.stock_state IN ('ready', 'reserved');

  IF v_package_count <> v_selected_count THEN
    RAISE EXCEPTION 'One or more selected packages are no longer ready to dispatch';
  END IF;

  SELECT next_dispatch_number(p_order_id)
    INTO v_dispatch_number;

  INSERT INTO dispatches (
    org_id,
    order_id,
    dispatch_number,
    qty_meters_sent,
    status,
    notes,
    dispatched_at,
    created_by
  ) VALUES (
    p_org_id,
    p_order_id,
    v_dispatch_number,
    v_total,
    'in_transit',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NOW(),
    p_created_by
  )
  RETURNING id INTO v_dispatch_id;

  INSERT INTO dispatch_package_lines (
    org_id,
    dispatch_id,
    package_id,
    order_id,
    package_no,
    package_type,
    units_count,
    grade,
    inspection_status,
    location_snapshot,
    qty_meters_sent
  )
  SELECT
    fp.org_id,
    v_dispatch_id,
    fp.id,
    fp.order_id,
    fp.package_no,
    fp.package_type,
    fp.units_count,
    fp.grade,
    fp.inspection_status,
    fp.location,
    fp.metres
  FROM fabric_packages fp
  WHERE fp.org_id = p_org_id
    AND fp.order_id = p_order_id
    AND fp.id = ANY(p_package_ids);

  UPDATE fabric_packages
  SET stock_state = 'dispatched',
      updated_at = NOW()
  WHERE org_id = p_org_id
    AND id = ANY(p_package_ids);

  RETURN QUERY
  SELECT
    v_dispatch_id,
    v_dispatch_number,
    v_total,
    v_tracking_token,
    v_party_name,
    COALESCE(v_org_name, 'Factory');
END;
$$;

GRANT EXECUTE ON FUNCTION create_fabric_dispatch(UUID, UUID, UUID[], TEXT, UUID) TO authenticated, service_role;

-- ============================================================
-- 9. RPC: CONFIRM RECEIPT + PACKAGE CLAIM SPLIT
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_fabric_dispatch_receipt(
  p_dispatch_id UUID,
  p_tracking_token TEXT,
  p_qty_received NUMERIC
)
RETURNS TABLE (
  qty_received NUMERIC,
  shortage_meters NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dispatch RECORD;
  v_order RECORD;
  v_received NUMERIC(10,2);
  v_remaining NUMERIC(10,2);
  v_line_received NUMERIC(10,2);
  v_line_shortage NUMERIC(10,2);
  v_shortage NUMERIC(10,2);
  v_party_id UUID;
  rec RECORD;
BEGIN
  SELECT d.id, d.org_id, d.order_id, d.status, d.qty_meters_sent
    INTO v_dispatch
  FROM dispatches d
  JOIN orders o ON o.id = d.order_id
  WHERE d.id = p_dispatch_id
    AND o.tracking_token = p_tracking_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tracking link';
  END IF;

  IF v_dispatch.status <> 'in_transit' THEN
    RAISE EXCEPTION 'This batch has already been confirmed';
  END IF;

  v_received := COALESCE(p_qty_received, v_dispatch.qty_meters_sent);
  IF v_received < 0 THEN
    RAISE EXCEPTION 'Enter a valid received quantity';
  END IF;
  IF v_received > v_dispatch.qty_meters_sent THEN
    RAISE EXCEPTION 'Received quantity cannot exceed the sent quantity';
  END IF;

  SELECT o.id, o.party_id, o.party_name
    INTO v_order
  FROM orders o
  WHERE o.id = v_dispatch.order_id;

  v_party_id := v_order.party_id;
  IF v_party_id IS NULL THEN
    SELECT p.id
      INTO v_party_id
    FROM parties p
    WHERE p.org_id = v_dispatch.org_id
      AND lower(trim(p.name)) = lower(trim(v_order.party_name))
    ORDER BY p.created_at
    LIMIT 1;
  END IF;

  UPDATE dispatches
  SET status = 'delivered',
      qty_meters_received = v_received,
      received_at = NOW()
  WHERE id = p_dispatch_id;

  v_remaining := v_received;

  FOR rec IN
    SELECT dpl.id, dpl.package_id, dpl.package_no, dpl.qty_meters_sent
    FROM dispatch_package_lines dpl
    WHERE dpl.dispatch_id = p_dispatch_id
    ORDER BY dpl.created_at, dpl.package_no
  LOOP
    v_line_received := LEAST(rec.qty_meters_sent, GREATEST(v_remaining, 0));
    v_line_shortage := rec.qty_meters_sent - v_line_received;

    UPDATE dispatch_package_lines
    SET qty_meters_received = v_line_received
    WHERE id = rec.id;

    UPDATE fabric_packages
    SET stock_state = CASE
        WHEN v_line_shortage > 0.01 THEN 'claimed'
        ELSE 'dispatched'
      END,
      updated_at = NOW()
    WHERE id = rec.package_id;

    IF v_line_shortage > 0.01 AND v_party_id IS NOT NULL THEN
      INSERT INTO party_dispatch_claims (
        org_id,
        party_id,
        order_id,
        dispatch_id,
        package_id,
        package_line_id,
        claim_type,
        claim_status,
        claim_date,
        shortage_meters,
        amount,
        notes,
        created_by
      ) VALUES (
        v_dispatch.org_id,
        v_party_id,
        v_dispatch.order_id,
        p_dispatch_id,
        rec.package_id,
        rec.id,
        'shortage',
        'open',
        CURRENT_DATE,
        v_line_shortage,
        NULL,
        'Short receipt on package ' || rec.package_no,
        NULL
      );
    END IF;

    v_remaining := GREATEST(v_remaining - rec.qty_meters_sent, 0);
  END LOOP;

  v_shortage := v_dispatch.qty_meters_sent - v_received;

  RETURN QUERY
  SELECT v_received, v_shortage;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_fabric_dispatch_receipt(UUID, TEXT, NUMERIC) TO authenticated, service_role;
