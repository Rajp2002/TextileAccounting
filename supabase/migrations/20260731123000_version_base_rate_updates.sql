-- Base Estimator: reject stale rate edits before the atomic rate/history/quality update.
-- The wrapper locks the current row for the duration of the nested RPC call, so
-- two tabs cannot pass the version check and overwrite one another silently.

CREATE OR REPLACE FUNCTION public.save_cost_rate_atomic_versioned(
  p_rate_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_category text,
  p_unit text,
  p_current_value numeric,
  p_effective_date date,
  p_last_reviewed_at date,
  p_review_interval_days integer,
  p_source text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_apply_as_default boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing public.cost_rate_book%ROWTYPE;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can save costing rates.';
  END IF;

  IF p_rate_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.cost_rate_book
    WHERE id = p_rate_id
      AND org_id = v_org_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate no longer exists.';
    END IF;

    IF p_expected_updated_at IS NULL OR v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'This rate changed in another tab or was archived. Refresh before saving again.';
    END IF;
  END IF;

  RETURN public.save_cost_rate_atomic(
    p_rate_id,
    p_name,
    p_category,
    p_unit,
    p_current_value,
    p_effective_date,
    p_last_reviewed_at,
    p_review_interval_days,
    p_source,
    p_notes,
    p_apply_as_default
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_cost_rate_atomic_versioned(
  uuid, timestamptz, text, text, text, numeric, date, date, integer, text, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cost_rate_atomic_versioned(
  uuid, timestamptz, text, text, text, numeric, date, date, integer, text, text, boolean
) TO authenticated;

COMMENT ON FUNCTION public.save_cost_rate_atomic_versioned(
  uuid, timestamptz, text, text, text, numeric, date, date, integer, text, text, boolean
) IS 'Optimistic-concurrency wrapper for the atomic Base rate update RPC.';
