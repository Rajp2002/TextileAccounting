-- ============================================================
-- MIGRATION: Party Ledger — Module 1
-- Digitizes the grey fabric party register: parties, bills,
-- receipts, claim/deduction adjustments, and ledger timeline.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1. PARTY MASTER
-- ============================================================

CREATE TABLE IF NOT EXISTS parties (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  party_type            TEXT NOT NULL DEFAULT 'trader'
                          CHECK (party_type IN ('trader','processor','broker','supplier','other')),
  phone                 TEXT,
  gstin                 TEXT,
  address               TEXT,
  broker_name           TEXT,
  default_credit_days   INTEGER NOT NULL DEFAULT 30 CHECK (default_credit_days BETWEEN 0 AND 365),
  credit_limit          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  opening_balance       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  opening_balance_type  TEXT NOT NULL DEFAULT 'receivable'
                          CHECK (opening_balance_type IN ('receivable','payable')),
  risk_note             TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_org_name_active
  ON parties(org_id, lower(name))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_parties_org_id
  ON parties(org_id);

CREATE INDEX IF NOT EXISTS idx_parties_org_active
  ON parties(org_id, is_active);

-- ============================================================
-- 2. PARTY INVOICES / BILLS
-- ============================================================

CREATE TABLE IF NOT EXISTS party_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  party_id        UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  total_meters    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_meters >= 0),
  rate_per_m      NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (rate_per_m >= 0),
  gross_amount    NUMERIC(14,2) NOT NULL CHECK (gross_amount >= 0),
  gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (gst_percent BETWEEN 0 AND 100),
  gst_amount      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  net_amount      NUMERIC(14,2) NOT NULL CHECK (net_amount >= 0),
  status          TEXT NOT NULL DEFAULT 'unpaid'
                    CHECK (status IN ('draft','unpaid','partial','paid','cancelled')),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT party_invoices_due_after_invoice CHECK (due_date >= invoice_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_party_invoices_org_number
  ON party_invoices(org_id, lower(invoice_number));

CREATE INDEX IF NOT EXISTS idx_party_invoices_party_id
  ON party_invoices(party_id);

CREATE INDEX IF NOT EXISTS idx_party_invoices_org_due
  ON party_invoices(org_id, due_date)
  WHERE status IN ('unpaid','partial');

CREATE INDEX IF NOT EXISTS idx_party_invoices_order_id
  ON party_invoices(order_id)
  WHERE order_id IS NOT NULL;

-- ============================================================
-- 3. RECEIPTS / PAYMENTS RECEIVED
-- ============================================================

CREATE TABLE IF NOT EXISTS party_receipts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  party_id       UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  invoice_id     UUID REFERENCES party_invoices(id) ON DELETE SET NULL,
  receipt_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method         TEXT NOT NULL DEFAULT 'cash'
                   CHECK (method IN ('cash','upi','bank','cheque','other')),
  reference_no   TEXT,
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_receipts_party_id
  ON party_receipts(party_id);

CREATE INDEX IF NOT EXISTS idx_party_receipts_invoice_id
  ON party_receipts(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_party_receipts_org_date
  ON party_receipts(org_id, receipt_date DESC);

-- ============================================================
-- 4. CLAIMS / SHORTAGE / RATE DIFFERENCE ADJUSTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS party_adjustments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  party_id          UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  invoice_id        UUID REFERENCES party_invoices(id) ON DELETE SET NULL,
  adjustment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type   TEXT NOT NULL DEFAULT 'other'
                      CHECK (adjustment_type IN ('shortage','quality_claim','rate_difference','discount','bad_debt','other')),
  direction         TEXT NOT NULL
                      CHECK (direction IN ('credit_to_party','debit_to_party')),
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_adjustments_party_id
  ON party_adjustments(party_id);

CREATE INDEX IF NOT EXISTS idx_party_adjustments_invoice_id
  ON party_adjustments(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_party_adjustments_org_date
  ON party_adjustments(org_id, adjustment_date DESC);

-- ============================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parties_updated_at ON parties;
CREATE TRIGGER trg_parties_updated_at
  BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_party_invoices_updated_at ON party_invoices;
CREATE TRIGGER trg_party_invoices_updated_at
  BEFORE UPDATE ON party_invoices
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 6. LEDGER TIMELINE VIEW
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
FROM party_adjustments a;

-- ============================================================
-- 7. RLS
-- ============================================================

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_adjustments ENABLE ROW LEVEL SECURITY;

-- Party names are useful context for dispatch/order work, so all org members can read them.
CREATE POLICY "parties_org_select"
  ON parties FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "parties_owner_insert"
  ON parties FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "parties_owner_update"
  ON parties FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "parties_owner_delete"
  ON parties FOR DELETE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_invoices_owner_select"
  ON party_invoices FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_invoices_owner_insert"
  ON party_invoices FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_invoices_owner_update"
  ON party_invoices FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_receipts_owner_select"
  ON party_receipts FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_receipts_owner_insert"
  ON party_receipts FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_adjustments_owner_select"
  ON party_adjustments FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "party_adjustments_owner_insert"
  ON party_adjustments FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );
