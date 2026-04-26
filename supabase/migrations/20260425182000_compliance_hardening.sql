-- ============================================================
-- MIGRATION: Compliance Hardening (Proof & Security)
-- ============================================================

-- 1. Add resolution_proof_url to grievances
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS resolution_proof_url TEXT;
COMMENT ON COLUMN grievances.resolution_proof_url IS 'URL to the uploaded proof of resolution (PDF/Screenshot) as required by DPB audits.';

-- 2. Create Storage Bucket for Compliance Proofs
-- Note: This is usually done via Supabase Dashboard or API, 
-- but we can include the SQL for policies if the bucket exists.
-- We will assume the bucket 'compliance_proofs' is created.

-- 3. RLS for Compliance Proofs (Admin only)
-- Storage policies are in the 'storage' schema.
-- (Assuming bucket 'compliance_proofs' exists)
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('compliance_proofs', 'compliance_proofs', false);

CREATE POLICY "Admins manage compliance proofs" ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'compliance_proofs' AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
*/
