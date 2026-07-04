-- Batch 24E: master data loom guardrails.
-- Source-only migration file. Do not apply without QA review and duplicate-name preflight.

CREATE UNIQUE INDEX IF NOT EXISTS machines_org_normalized_name_unique
    ON public.machines (org_id, lower(btrim(name)));

COMMENT ON INDEX public.machines_org_normalized_name_unique IS
    'Batch 24E: enforces org-scoped loom name uniqueness using trim + case-fold normalization.';
