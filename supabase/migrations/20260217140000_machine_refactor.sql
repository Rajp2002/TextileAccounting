-- Refactor: Machine-based pay & Assignments

-- 1. Remove rate_per_meter from workers
ALTER TABLE workers DROP COLUMN IF EXISTS rate_per_meter;

-- 2. Add rate_per_meter to machines
ALTER TABLE machines ADD COLUMN IF NOT EXISTS rate_per_meter DECIMAL DEFAULT 0;

-- 3. Create machine_assignments table
CREATE TABLE IF NOT EXISTS machine_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE NOT NULL,
    worker_id BIGINT REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    shift TEXT CHECK (shift IN ('day', 'night')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(machine_id, shift)
);

-- 4. RLS for machine_assignments
ALTER TABLE machine_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: Members can view assignments in their org
-- We need to join through machines to get org_id, or just assume if they have access to the machine they have access here.
-- A simpler way is to denormalize org_id or use a subquery.
-- Adding org_id to machine_assignments for easier RLS is often better, but let's stick to the join for normalized data.
-- Actually, let's add org_id to machine_assignments to make RLS consistent and performant.

ALTER TABLE machine_assignments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE POLICY "Tenant Isolation" ON machine_assignments
    FOR SELECT
    USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Owners Manage Assignments" ON machine_assignments
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );
