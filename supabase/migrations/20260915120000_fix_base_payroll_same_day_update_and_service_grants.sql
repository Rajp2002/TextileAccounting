-- ============================================================
-- MIGRATION: Fix Base Payroll Cycle Same-Day Update & Service Grants
-- Grants service_role permissions on base_payroll_cycle_configs
-- and base_payroll_periods, and enables update_base_payroll_cycle
-- to update configurations in-place on same-day modifications.
-- ============================================================

-- 1. Table Grants for service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.base_payroll_cycle_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.base_payroll_periods TO service_role;

-- 2. Enhanced update_base_payroll_cycle RPC with same-day in-place update support
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
        -- If modifying on the exact same effective date (e.g. during onboarding or day-one adjustments),
        -- update the current active record in-place to preserve date monotonicity and avoid zero-day records.
        IF p_effective_from = v_existing_effective_from THEN
            UPDATE public.base_payroll_cycle_configs
            SET cycle_type = p_cycle_type,
                rule = p_rule,
                updated_at = now()
            WHERE id = v_existing_id;

            RETURN jsonb_build_object(
                'success', true,
                'config_id', v_existing_id,
                'effective_from', p_effective_from
            );
        ELSIF p_effective_from < v_existing_effective_from THEN
            RAISE EXCEPTION 'New payroll cycle effective date (%) must be on or after current cycle effective date (%)',
                p_effective_from, v_existing_effective_from
            USING ERRCODE = '22023';
        ELSE
            -- Close current active version on the day before the new rule takes effect
            UPDATE public.base_payroll_cycle_configs
            SET effective_until = p_effective_from - 1,
                updated_at = now()
            WHERE id = v_existing_id;
        END IF;
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

-- 3. Execute Grants
REVOKE ALL ON FUNCTION public.update_base_payroll_cycle(text, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_base_payroll_cycle(text, jsonb, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_base_payroll_period(date, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_base_payroll_period(date, date, uuid, text) TO authenticated, service_role;
