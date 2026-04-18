-- ============================================================
-- MIGRATION: Payroll V2 Schema Evolution (Part 2)
-- 1. Advance Types & Worker Advance Updates
-- 2. Payroll Adjustments (Inam & Kapaat)
-- 3. Settlement Snapshots (Employer Costs & Itemization)
-- 4. Supervisor Float Ledger
-- ============================================================

-- 1. ADVANCE TYPES & WORKER ADVANCE UPDATES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'advance_type') THEN
        CREATE TYPE advance_type AS ENUM ('kharchi', 'upaad', 'inam_advance');
    END IF;
END $$;

ALTER TABLE worker_advances 
    ADD COLUMN IF NOT EXISTS type advance_type DEFAULT 'upaad',
    ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cycle_start_date DATE;

-- Migrate existing advances (all historically 'upaad')
UPDATE worker_advances SET type = 'upaad' WHERE type IS NULL;

-- 2. PAYROLL ADJUSTMENTS (Inam & Kapaat)
CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) NOT NULL,
    worker_type TEXT NOT NULL CHECK (worker_type IN ('meter', 'fixed')),
    meter_worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
    fixed_worker_id BIGINT REFERENCES fixed_workers(id) ON DELETE SET NULL,
    
    category_id UUID REFERENCES payroll_adjustment_categories(id) ON DELETE SET NULL,
    cycle_start_date DATE NOT NULL,
    
    amount NUMERIC NOT NULL CHECK (amount > 0),
    description TEXT,
    
    settlement_id BIGINT REFERENCES payroll_settlements(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT adjustment_exactly_one_worker_fk CHECK (
        (meter_worker_id IS NOT NULL AND fixed_worker_id IS NULL) OR
        (meter_worker_id IS NULL AND fixed_worker_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_adjustments_worker_cycle 
    ON payroll_adjustments (org_id, cycle_start_date, meter_worker_id, fixed_worker_id);

-- Enable RLS
ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON payroll_adjustments
    FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Owners Manage Adjustments" ON payroll_adjustments
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- 3. SETTLEMENT SNAPSHOTS (Employer Costs & Itemization)
ALTER TABLE payroll_settlements
    ADD COLUMN IF NOT EXISTS cycle_start_date DATE,
    ADD COLUMN IF NOT EXISTS employer_pf NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS employer_esic NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS itemization_payload JSONB;

-- 4. SUPERVISOR FLOAT LEDGER
CREATE TABLE IF NOT EXISTS supervisor_float_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) NOT NULL,
    supervisor_id UUID REFERENCES profiles(id) NOT NULL,
    
    type TEXT NOT NULL CHECK (type IN ('refill', 'disbursement')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    
    worker_advance_id BIGINT REFERENCES worker_advances(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for derived balance calculations
CREATE INDEX IF NOT EXISTS idx_float_transactions_supervisor
    ON supervisor_float_transactions (org_id, supervisor_id, type);

-- Enable RLS
ALTER TABLE supervisor_float_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON supervisor_float_transactions
    FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Owners Manage All Floats" ON supervisor_float_transactions
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Supervisors View Own Transactions" ON supervisor_float_transactions
    FOR SELECT USING (
        supervisor_id = auth.uid()
    );
