-- ============================================================
-- MIGRATION: Loomi Estimator (Surat Logic)
-- ============================================================

-- 1. ESTIMATOR SETTINGS: Factory-wide defaults
CREATE TABLE IF NOT EXISTS estimator_settings (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    electricity_rate DECIMAL NOT NULL DEFAULT 7.5, -- ₹ per kWh
    factory_rent_per_day DECIMAL NOT NULL DEFAULT 0,
    admin_overhead_per_day DECIMAL NOT NULL DEFAULT 0, -- Salary of staff etc.
    avg_machine_efficiency DECIMAL NOT NULL DEFAULT 0.85,
    standard_wastage_percent DECIMAL NOT NULL DEFAULT 2.0,
    standard_shrinkage_percent DECIMAL NOT NULL DEFAULT 3.0,
    gst_rate DECIMAL NOT NULL DEFAULT 5.0,
    is_gst_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ESTIMATOR TEMPLATES: Reusable fabric technical specs
CREATE TABLE IF NOT EXISTS estimator_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    ppi INTEGER NOT NULL DEFAULT 60,
    yarn_denier INTEGER NOT NULL DEFAULT 75,
    gsm INTEGER NOT NULL DEFAULT 80,
    default_yarn_rate DECIMAL NOT NULL DEFAULT 140,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ESTIMATOR QUOTES: Snapshots for "Negotiation Dashboard" and Order conversion
CREATE TABLE IF NOT EXISTS estimator_quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    party_name TEXT NOT NULL,
    template_id UUID REFERENCES estimator_templates(id) ON DELETE SET NULL,
    
    -- Technical Specs (Snapshotted)
    ppi INTEGER NOT NULL,
    yarn_denier INTEGER NOT NULL,
    gsm INTEGER NOT NULL,
    
    -- Inputs
    meters DECIMAL NOT NULL,
    yarn_rate_per_kg DECIMAL NOT NULL,
    job_work_charges JSONB DEFAULT '[]'::jsonb, -- Array of {name: string, rate: number, shrinkage: number}
    
    -- Results
    landed_cost_per_meter DECIMAL NOT NULL,
    quote_price_per_meter DECIMAL NOT NULL,
    intended_margin_percent DECIMAL NOT NULL,
    
    -- Order Link (if converted)
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE estimator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimator_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimator_quotes ENABLE ROW LEVEL SECURITY;

-- Only owners can manage estimator data
CREATE POLICY "Owners Manage Estimator Settings" ON estimator_settings
    FOR ALL USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

CREATE POLICY "Owners Manage Estimator Templates" ON estimator_templates
    FOR ALL USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

CREATE POLICY "Owners Manage Estimator Quotes" ON estimator_quotes
    FOR ALL USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- Indices
CREATE INDEX IF NOT EXISTS idx_estimator_templates_org_id ON estimator_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_estimator_quotes_org_id ON estimator_quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_estimator_quotes_order_id ON estimator_quotes(order_id);
