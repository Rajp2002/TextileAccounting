-- ============================================================
-- MIGRATION: Base Payroll Cycle Configuration & Versioning
-- Stores versioned payroll recurrence rules per organization
-- and provides atomic transition RPC for cycle updates.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.base_payroll_cycle_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    cycle_type text NOT NULL CHECK (cycle_type IN ('monthly', 'weekly', 'interval_weeks', 'interval_days', 'semi_monthly')),
    rule jsonb NOT NULL,
    effective_from date NOT NULL,
    effective_until date,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT base_payroll_cycle_configs_effective_range CHECK (effective_until IS NULL OR effective_from <= effective_until)
);

-- At most one active payroll cycle configuration per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_base_payroll_cycle_active
    ON public.base_payroll_cycle_configs (org_id)
    WHERE effective_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_base_payroll_cycle_org_dates
    ON public.base_payroll_cycle_configs (org_id, effective_from, effective_until);

ALTER TABLE public.base_payroll_cycle_configs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.base_payroll_cycle_configs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.base_payroll_cycle_configs TO authenticated;

DROP POLICY IF EXISTS base_payroll_cycle_configs_owner_read ON public.base_payroll_cycle_configs;
CREATE POLICY base_payroll_cycle_configs_owner_read
    ON public.base_payroll_cycle_configs
    FOR SELECT TO authenticated
    USING (private.base_production_core_access(org_id));

DROP POLICY IF EXISTS base_payroll_cycle_configs_owner_write ON public.base_payroll_cycle_configs;
CREATE POLICY base_payroll_cycle_configs_owner_write
    ON public.base_payroll_cycle_configs
    FOR ALL TO authenticated
    USING (private.base_production_core_access(org_id))
    WITH CHECK (private.base_production_core_access(org_id));

-- Atomic RPC to update payroll cycle configuration with advisory lock
CREATE OR REPLACE FUNCTION public.update_base_payroll_cycle(
    p_cycle_type text,
    p_rule jsonb,
    p_effective_from date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
    v_org_id uuid;
    v_new_id uuid;
    v_existing_id uuid;
    v_existing_effective_from date;
BEGIN
    SELECT profile.org_id INTO v_org_id
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid() AND profile.role::text = 'owner';

    IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
        RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
    END IF;

    IF p_cycle_type NOT IN ('monthly', 'weekly', 'interval_weeks', 'interval_days', 'semi_monthly') THEN
        RAISE EXCEPTION 'Invalid payroll cycle type: %', p_cycle_type USING ERRCODE = '22023';
    END IF;

    IF p_rule IS NULL OR jsonb_typeof(p_rule) <> 'object' THEN
        RAISE EXCEPTION 'A valid rule JSON object is required' USING ERRCODE = '22023';
    END IF;

    IF p_effective_from IS NULL THEN
        RAISE EXCEPTION 'A valid effective from date is required' USING ERRCODE = '22023';
    END IF;

    -- Serialize updates for this org's payroll cycle
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_org_id::text || ':base-payroll-cycle-config', 0)
    );

    -- Find currently active configuration
    SELECT id, effective_from
    INTO v_existing_id, v_existing_effective_from
    FROM public.base_payroll_cycle_configs
    WHERE org_id = v_org_id AND effective_until IS NULL;

    IF v_existing_id IS NOT NULL THEN
        IF p_effective_from <= v_existing_effective_from THEN
            RAISE EXCEPTION 'New payroll cycle effective date (%) must be after current cycle effective date (%)',
                p_effective_from, v_existing_effective_from
            USING ERRCODE = '22023';
        END IF;

        -- Close current active version on the day before the new rule takes effect
        UPDATE public.base_payroll_cycle_configs
        SET effective_until = p_effective_from - 1,
            updated_at = now()
        WHERE id = v_existing_id;
    END IF;

    -- Insert new active version
    INSERT INTO public.base_payroll_cycle_configs (
        org_id,
        cycle_type,
        rule,
        effective_from,
        effective_until,
        created_by
    ) VALUES (
        v_org_id,
        p_cycle_type,
        p_rule,
        p_effective_from,
        NULL,
        auth.uid()
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true,
        'config_id', v_new_id,
        'effective_from', p_effective_from
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_base_payroll_cycle(text, jsonb, date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_base_payroll_cycle(text, jsonb, date) TO authenticated;
