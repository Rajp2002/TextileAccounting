-- Sprint 10: saved costing library state is a lifecycle operation, not an
-- in-place edit to historical economics. Archive/restore and favourites are
-- the only mutable fields on an immutable costing snapshot. Full Suite
-- quotations use the same library action, so their lifecycle state remains
-- supported without widening the editable economics surface.

CREATE INDEX IF NOT EXISTS estimator_quotes_saved_costing_library_state_idx
  ON public.estimator_quotes(org_id, is_archived, is_favorite, updated_at DESC)
  WHERE record_kind = 'costing';

COMMENT ON INDEX public.estimator_quotes_saved_costing_library_state_idx IS
  'Supports tenant-scoped Saved Costings archive, favourite, and recent sorting without changing historical snapshot data.';

CREATE OR REPLACE FUNCTION public.update_saved_costing_library_state_atomic(
  p_costing_id uuid,
  p_expected_updated_at timestamptz,
  p_is_archived boolean DEFAULT NULL,
  p_is_favorite boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing public.estimator_quotes%ROWTYPE;
  v_updated public.estimator_quotes%ROWTYPE;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can update Saved Costing library state.';
  END IF;
  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator or Full Suite subscription is required.';
  END IF;
  IF public.check_org_lockdown(v_org_id) THEN
    RAISE EXCEPTION 'This organization is locked. Saved Costing library state cannot be changed.';
  END IF;
  IF p_costing_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'This costing changed or is missing its version. Refresh Saved Costings before changing it.';
  END IF;
  IF p_is_archived IS NULL AND p_is_favorite IS NULL THEN
    RAISE EXCEPTION 'Choose archive, restore, or favourite state before saving.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.estimator_quotes AS quote
  WHERE quote.id = p_costing_id
    AND quote.org_id = v_org_id
    AND quote.record_kind IN ('costing', 'quotation')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saved Costing no longer exists.';
  END IF;
  IF v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'This costing changed in another tab. Refresh Saved Costings and try again.';
  END IF;

  -- A repeated click that asks for the already-visible state is a safe no-op;
  -- it must not create a false version of the historical row.
  IF (p_is_archived IS NULL OR v_existing.is_archived IS NOT DISTINCT FROM p_is_archived)
     AND (p_is_favorite IS NULL OR v_existing.is_favorite IS NOT DISTINCT FROM p_is_favorite) THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'updated_at', v_existing.updated_at,
      'is_archived', v_existing.is_archived,
      'is_favorite', v_existing.is_favorite,
      'costing_group_id', v_existing.costing_group_id,
      'version_number', v_existing.version_number,
      'no_change', true
    );
  END IF;

  UPDATE public.estimator_quotes AS quote
  SET is_archived = COALESCE(p_is_archived, quote.is_archived),
      is_favorite = COALESCE(p_is_favorite, quote.is_favorite),
      updated_at = now()
  WHERE quote.id = v_existing.id
    AND quote.org_id = v_org_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'id', v_updated.id,
    'updated_at', v_updated.updated_at,
    'is_archived', v_updated.is_archived,
    'is_favorite', v_updated.is_favorite,
    'costing_group_id', v_updated.costing_group_id,
    'version_number', v_updated.version_number,
    'no_change', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_saved_costing_library_state_atomic(uuid, timestamptz, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_saved_costing_library_state_atomic(uuid, timestamptz, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.update_saved_costing_library_state_atomic(uuid, timestamptz, boolean, boolean) IS
  'Atomically archives/restores or favourites a tenant-owned Saved Costing with optimistic concurrency; historical economics remain immutable.';

-- Read-time yarn discovery must not bypass the Rate Book mutation boundary.
-- This helper intentionally creates an unreviewed row without a history event;
-- the owner still has to confirm it before the rate is trusted.
CREATE OR REPLACE FUNCTION public.discover_yarn_rate_atomic(
  p_name text,
  p_category text,
  p_current_value numeric,
  p_review_interval_days integer,
  p_source text DEFAULT NULL,
  p_notes text DEFAULT NULL
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
  v_rate public.cost_rate_book%ROWTYPE;
  v_name text := btrim(COALESCE(p_name, ''));
  v_normalized_name text := lower(regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g'));
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can discover yarn rates.';
  END IF;
  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator or Full Suite subscription is required.';
  END IF;
  IF public.check_org_lockdown(v_org_id) THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Discovered yarn name is invalid.';
  END IF;
  IF p_category NOT IN ('yarn_warp', 'yarn_weft') THEN
    RAISE EXCEPTION 'Discovered rate category is invalid.';
  END IF;
  IF p_current_value IS NULL OR p_current_value = 'NaN'::numeric OR p_current_value < 0 OR p_current_value > 10000000 THEN
    RAISE EXCEPTION 'Discovered yarn rate is invalid.';
  END IF;
  IF p_review_interval_days NOT BETWEEN 1 AND 1095 THEN
    RAISE EXCEPTION 'Review period is invalid.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || p_category || ':' || v_normalized_name, 0));

  SELECT *
  INTO v_existing
  FROM public.cost_rate_book AS rate
  WHERE rate.org_id = v_org_id
    AND rate.category = p_category
    AND lower(regexp_replace(btrim(rate.name), '\s+', ' ', 'g')) = v_normalized_name
  ORDER BY rate.is_active DESC, rate.updated_at DESC
  FOR UPDATE;

  IF FOUND THEN
    IF NOT v_existing.is_active THEN
      RETURN jsonb_build_object('rate', to_jsonb(v_existing), 'promoted', false);
    END IF;
    IF v_existing.current_value = 0 AND p_current_value > 0 THEN
      UPDATE public.cost_rate_book AS rate
      SET current_value = p_current_value,
          effective_date = current_date,
          last_reviewed_at = current_date,
          review_interval_days = p_review_interval_days,
          source = p_source,
          notes = p_notes,
          updated_by = v_user_id,
          updated_at = now()
      WHERE rate.id = v_existing.id
        AND rate.org_id = v_org_id
      RETURNING * INTO v_rate;

      RETURN jsonb_build_object('rate', to_jsonb(v_rate), 'promoted', true);
    END IF;

    RETURN jsonb_build_object('rate', to_jsonb(v_existing), 'promoted', false);
  END IF;

  INSERT INTO public.cost_rate_book (
    org_id, name, category, unit, current_value, effective_date,
    last_reviewed_at, review_interval_days, source, notes,
    apply_as_default, created_by, updated_by
  ) VALUES (
    v_org_id, v_name, p_category, 'per_kg', p_current_value, current_date,
    current_date, p_review_interval_days, p_source, p_notes,
    false, v_user_id, v_user_id
  )
  RETURNING * INTO v_rate;

  RETURN jsonb_build_object('rate', to_jsonb(v_rate), 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.discover_yarn_rate_atomic(text, text, numeric, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_yarn_rate_atomic(text, text, numeric, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.discover_yarn_rate_atomic(text, text, numeric, integer, text, text) IS
  'Atomically discovers or promotes an unreviewed yarn Rate Book row without creating a trusted review history event.';
