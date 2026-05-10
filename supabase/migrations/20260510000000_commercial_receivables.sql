-- MIGRATION: Commercial Receivables and Payment Receipts
-- Makes Commercials the single source of truth for profit and lightweight payment/receivables tracking.

-- 1. RECEIVABLES TABLE
CREATE TABLE IF NOT EXISTS commercial_receivables (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type           TEXT NOT NULL CHECK (source_type IN ('fabric_stock_sale', 'market_run_sale', 'party_invoice')),
  source_id             UUID NOT NULL,
  source_date           DATE,
  order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
  dispatch_id           UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  party_name            TEXT NOT NULL,
  quality_label         TEXT NOT NULL,
  broker_name           TEXT,
  reference_label       TEXT,
  total_amount          NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  received_amount       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  balance_amount        NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - received_amount) STORED,
  payment_status        TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  credit_days           INTEGER,
  due_date              DATE,
  party_risk_status     TEXT CHECK (party_risk_status IN ('normal','watch','risky','blocked')),
  last_follow_up_at     TIMESTAMPTZ,
  next_follow_up_at     TIMESTAMPTZ,
  follow_up_note        TEXT,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_receivables_balance_valid CHECK (balance_amount >= 0),
  CONSTRAINT commercial_receivables_received_valid CHECK (received_amount <= total_amount),
  CONSTRAINT commercial_receivables_unique_source UNIQUE (org_id, source_type, source_id)
);

-- 2. PAYMENT RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS commercial_payment_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  receivable_id         UUID NOT NULL REFERENCES commercial_receivables(id) ON DELETE CASCADE,
  amount                NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode          TEXT CHECK (payment_mode IN ('cash','bank','upi','cheque','other')),
  reference_number      TEXT,
  cheque_number         TEXT,
  cheque_date           DATE,
  bank_name             TEXT,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_commercial_receivables_org_status ON commercial_receivables(org_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_commercial_receivables_org_due ON commercial_receivables(org_id, due_date);
CREATE INDEX IF NOT EXISTS idx_commercial_receivables_org_party ON commercial_receivables(org_id, party_name);
CREATE INDEX IF NOT EXISTS idx_commercial_receivables_org_broker ON commercial_receivables(org_id, broker_name);
CREATE INDEX IF NOT EXISTS idx_commercial_payment_receipts_date ON commercial_payment_receipts(org_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_commercial_payment_receipts_receivable ON commercial_payment_receipts(receivable_id);

-- 4. TRIGGERS
DROP TRIGGER IF EXISTS trg_commercial_receivables_updated_at ON commercial_receivables;
CREATE TRIGGER trg_commercial_receivables_updated_at
  BEFORE UPDATE ON commercial_receivables
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 5. RLS
ALTER TABLE commercial_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_receivables_owner_select"
  ON commercial_receivables FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "commercial_receivables_owner_insert"
  ON commercial_receivables FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "commercial_receivables_owner_update"
  ON commercial_receivables FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "commercial_payment_receipts_owner_select"
  ON commercial_payment_receipts FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "commercial_payment_receipts_owner_insert"
  ON commercial_payment_receipts FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
    AND EXISTS (
      SELECT 1 FROM commercial_receivables
      WHERE id = receivable_id AND org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- 6. ATOMIC PAYMENT RPC
CREATE OR REPLACE FUNCTION record_commercial_payment_v1(
  p_receivable_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_reference_number TEXT,
  p_cheque_number TEXT,
  p_cheque_date DATE,
  p_bank_name TEXT,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_current_received NUMERIC;
  v_total NUMERIC;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';
  
  -- Null and context validations
  IF v_org_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Missing organization or role context';
  END IF;

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can record payments';
  END IF;

  IF p_receivable_id IS NULL THEN
    RAISE EXCEPTION 'Receivable ID is required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Payment date is required';
  END IF;

  IF p_payment_mode IS NOT NULL AND p_payment_mode NOT IN ('cash','bank','upi','cheque','other') THEN
    RAISE EXCEPTION 'Invalid payment mode';
  END IF;

  -- Lock the receivable row
  SELECT received_amount, total_amount
    INTO v_current_received, v_total
  FROM commercial_receivables
  WHERE id = p_receivable_id AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receivable not found';
  END IF;

  IF v_current_received + p_amount > v_total THEN
    RAISE EXCEPTION 'Payment amount exceeds remaining balance';
  END IF;

  -- Insert receipt
  INSERT INTO commercial_payment_receipts (
    org_id,
    receivable_id,
    amount,
    payment_date,
    payment_mode,
    reference_number,
    cheque_number,
    cheque_date,
    bank_name,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    p_receivable_id,
    p_amount,
    p_payment_date,
    p_payment_mode,
    p_reference_number,
    p_cheque_number,
    p_cheque_date,
    p_bank_name,
    p_notes,
    auth.uid()
  );

  -- Update receivable
  UPDATE commercial_receivables
  SET 
    received_amount = received_amount + p_amount,
    payment_status = CASE 
      WHEN received_amount + p_amount = total_amount THEN 'paid'
      ELSE 'partial'
    END,
    updated_by = auth.uid()
  WHERE id = p_receivable_id;
END;
$$;

-- 7. BACKFILL (Idempotent)
-- Backfill fabric_stock_sales
INSERT INTO commercial_receivables (
  org_id, source_type, source_id, source_date, party_name, quality_label, total_amount, payment_status, created_by, order_id
)
SELECT 
  s.org_id, 
  'fabric_stock_sale', 
  s.id, 
  s.sale_date,
  COALESCE(o.party_name, 'Anonymous'),
  l.quality_label,
  s.revenue_amount,
  'unpaid',
  s.created_by,
  l.order_id
FROM fabric_stock_sales s
JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
LEFT JOIN orders o ON o.id = l.order_id
WHERE s.revenue_amount > 0
ON CONFLICT (org_id, source_type, source_id) DO NOTHING;

-- Backfill market_run_sales
INSERT INTO commercial_receivables (
  org_id, source_type, source_id, source_date, party_name, quality_label, total_amount, payment_status, created_by
)
SELECT 
  s.org_id, 
  'market_run_sale', 
  s.id, 
  s.sale_date,
  'Market Sale',
  COALESCE(mr.quality_label, mr.fabric_label, 'Unknown'),
  ROUND(s.meters_sold * s.price_per_meter, 2),
  'unpaid',
  s.created_by
FROM market_run_sales s
JOIN market_runs mr ON mr.id = s.market_run_id
WHERE s.meters_sold > 0 AND s.price_per_meter > 0
ON CONFLICT (org_id, source_type, source_id) DO NOTHING;

-- Backfill party_invoices
INSERT INTO commercial_receivables (
  org_id, source_type, source_id, source_date, party_name, quality_label, total_amount, payment_status, created_by, order_id
)
SELECT 
  i.org_id, 
  'party_invoice', 
  i.id, 
  i.invoice_date,
  p.name,
  COALESCE(o.quality_label, 'Invoice'),
  i.net_amount,
  CASE 
    WHEN i.status = 'paid' THEN 'paid'
    WHEN i.status = 'partial' THEN 'partial'
    ELSE 'unpaid'
  END,
  i.created_by,
  i.order_id
FROM party_invoices i
JOIN parties p ON p.id = i.party_id
LEFT JOIN orders o ON o.id = i.order_id
WHERE i.net_amount > 0 AND i.status <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM commercial_receivables cr
    WHERE cr.org_id = i.org_id AND cr.source_type = 'fabric_stock_sale' AND cr.order_id = i.order_id
  )
ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
