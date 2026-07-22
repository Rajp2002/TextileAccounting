-- Base Estimator: save one reviewed rate, its history, factory default, and
-- matching saved-quality layers in a single tenant-scoped transaction.

ALTER TABLE public.factory_cost_profile
  DROP CONSTRAINT IF EXISTS factory_cost_profile_valid_economics,
  ADD CONSTRAINT factory_cost_profile_valid_economics CHECK (
    warping_rate_per_kg <> 'NaN'::numeric AND warping_rate_per_kg >= 0
    AND sizing_rate_per_kg <> 'NaN'::numeric AND sizing_rate_per_kg >= 0
    AND winding_rate_per_kg <> 'NaN'::numeric AND winding_rate_per_kg >= 0
    AND default_processing_rate_per_m <> 'NaN'::numeric AND default_processing_rate_per_m >= 0
    AND default_finishing_rate_per_m <> 'NaN'::numeric AND default_finishing_rate_per_m >= 0
    AND overhead_pct <> 'NaN'::numeric AND overhead_pct BETWEEN 0 AND 100
    AND default_commission_pct <> 'NaN'::numeric AND default_commission_pct BETWEEN 0 AND 99.99
    AND default_transport_per_m <> 'NaN'::numeric AND default_transport_per_m >= 0
    AND (overhead_override_per_m IS NULL OR (overhead_override_per_m <> 'NaN'::numeric AND overhead_override_per_m >= 0))
    AND loom_count >= 0
    AND monthly_working_days BETWEEN 1 AND 31
    AND avg_output_per_loom_per_day <> 'NaN'::numeric AND avg_output_per_loom_per_day > 0
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.save_cost_rate_atomic(
  p_rate_id uuid,
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
  v_rate public.cost_rate_book%ROWTYPE;
  v_existing public.cost_rate_book%ROWTYPE;
  v_previous_value numeric := NULL;
  v_profile_rows integer := 0;
  v_synced_quality_count integer := 0;
  v_template record;
  v_rows jsonb;
  v_changed boolean;
  v_normalized_name text := lower(regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g'));
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can save costing rates.';
  END IF;
  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator or Full Suite subscription is required.';
  END IF;
  IF public.check_org_lockdown(v_org_id) THEN
    RAISE EXCEPTION 'This organization is locked. Costing rates cannot be changed.';
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Rate name must be between 1 and 120 characters.';
  END IF;
  IF p_category NOT IN (
    'yarn_warp', 'yarn_weft', 'warping', 'sizing', 'winding',
    'processing', 'finishing', 'transport', 'commission', 'overhead'
  ) THEN
    RAISE EXCEPTION 'Rate category is invalid.';
  END IF;
  IF p_unit NOT IN ('per_kg', 'per_m', 'percent') THEN
    RAISE EXCEPTION 'Rate unit is invalid.';
  END IF;
  IF p_current_value IS NULL OR p_current_value = 'NaN'::numeric OR p_current_value < 0 OR p_current_value > 10000000 THEN
    RAISE EXCEPTION 'Enter a valid non-negative rate.';
  END IF;
  IF p_effective_date IS NULL OR p_last_reviewed_at IS NULL THEN
    RAISE EXCEPTION 'Effective and review dates are required.';
  END IF;
  IF p_review_interval_days NOT BETWEEN 1 AND 1095 THEN
    RAISE EXCEPTION 'Review period must be between 1 and 1095 days.';
  END IF;
  IF char_length(COALESCE(p_notes, '')) > 500 THEN
    RAISE EXCEPTION 'Notes must be 500 characters or fewer.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || p_category || ':' || v_normalized_name, 0));

  IF p_rate_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.cost_rate_book
    WHERE id = p_rate_id
      AND org_id = v_org_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate no longer exists.';
    END IF;
    IF v_existing.category IN ('yarn_warp', 'yarn_weft') AND (
      lower(regexp_replace(btrim(v_existing.name), '\s+', ' ', 'g')) <> v_normalized_name
      OR v_existing.category <> p_category
      OR v_existing.unit <> p_unit
    ) THEN
      RAISE EXCEPTION 'A yarn rate name, category, and unit cannot be changed because they match saved quality layers.';
    END IF;

    v_previous_value := v_existing.current_value;
    UPDATE public.cost_rate_book
    SET name = btrim(p_name),
        category = p_category,
        unit = p_unit,
        current_value = p_current_value,
        previous_value = v_previous_value,
        effective_date = p_effective_date,
        last_reviewed_at = p_last_reviewed_at,
        review_interval_days = p_review_interval_days,
        source = NULLIF(btrim(COALESCE(p_source, '')), ''),
        notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
        apply_as_default = p_apply_as_default,
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_rate_id
      AND org_id = v_org_id
    RETURNING * INTO v_rate;
  ELSE
    INSERT INTO public.cost_rate_book (
      org_id, name, category, unit, current_value, previous_value,
      effective_date, last_reviewed_at, review_interval_days, source, notes,
      apply_as_default, created_by, updated_by
    ) VALUES (
      v_org_id, btrim(p_name), p_category, p_unit, p_current_value, NULL,
      p_effective_date, p_last_reviewed_at, p_review_interval_days,
      NULLIF(btrim(COALESCE(p_source, '')), ''),
      NULLIF(btrim(COALESCE(p_notes, '')), ''), p_apply_as_default,
      v_user_id, v_user_id
    ) RETURNING * INTO v_rate;
  END IF;

  INSERT INTO public.cost_rate_history (
    org_id, rate_id, value, effective_date, source, notes, changed_by
  ) VALUES (
    v_org_id, v_rate.id, p_current_value, p_effective_date,
    NULLIF(btrim(COALESCE(p_source, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''), v_user_id
  );

  IF p_apply_as_default THEN
    IF p_category = 'yarn_warp' THEN
      UPDATE public.factory_cost_profile
      SET default_warp_yarn_name = btrim(p_name), default_warp_yarn_rate_per_kg = p_current_value, updated_at = now()
      WHERE factory_id = v_org_id;
    ELSIF p_category = 'yarn_weft' THEN
      UPDATE public.factory_cost_profile
      SET default_weft_yarn_name = btrim(p_name), default_weft_yarn_rate_per_kg = p_current_value, updated_at = now()
      WHERE factory_id = v_org_id;
    ELSIF p_category = 'warping' THEN
      UPDATE public.factory_cost_profile SET warping_rate_per_kg = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'sizing' THEN
      UPDATE public.factory_cost_profile SET sizing_rate_per_kg = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'winding' THEN
      UPDATE public.factory_cost_profile SET winding_rate_per_kg = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'processing' THEN
      UPDATE public.factory_cost_profile SET default_processing_rate_per_m = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'finishing' THEN
      UPDATE public.factory_cost_profile SET default_finishing_rate_per_m = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'transport' THEN
      UPDATE public.factory_cost_profile SET default_transport_per_m = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'commission' THEN
      UPDATE public.factory_cost_profile SET default_commission_pct = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    ELSIF p_category = 'overhead' THEN
      UPDATE public.factory_cost_profile SET overhead_pct = p_current_value, updated_at = now() WHERE factory_id = v_org_id;
    END IF;
    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;
    IF v_profile_rows <> 1 THEN
      RAISE EXCEPTION 'Factory defaults were not updated because the cost profile has not been configured yet.';
    END IF;
  END IF;

  IF p_category IN ('yarn_warp', 'yarn_weft') THEN
    FOR v_template IN
      SELECT id, warp_rows, weft_rows
      FROM public.estimator_templates
      WHERE org_id = v_org_id
        AND is_active = true
      FOR UPDATE
    LOOP
      v_changed := false;
      IF p_category = 'yarn_warp' THEN
        SELECT COALESCE(jsonb_agg(
          CASE WHEN lower(regexp_replace(btrim(COALESCE(element ->> 'label', '')), '\s+', ' ', 'g')) = v_normalized_name
            THEN jsonb_set(element, '{yarnRate}', to_jsonb(p_current_value), true)
            ELSE element END ORDER BY ordinal
        ), '[]'::jsonb),
        bool_or(lower(regexp_replace(btrim(COALESCE(element ->> 'label', '')), '\s+', ' ', 'g')) = v_normalized_name)
        INTO v_rows, v_changed
        FROM jsonb_array_elements(COALESCE(v_template.warp_rows, '[]'::jsonb)) WITH ORDINALITY AS rows(element, ordinal);

        IF COALESCE(v_changed, false) THEN
          UPDATE public.estimator_templates
          SET warp_rows = v_rows,
              default_yarn_rate = CASE WHEN lower(regexp_replace(btrim(COALESCE(v_rows -> 0 ->> 'label', '')), '\s+', ' ', 'g')) = v_normalized_name THEN p_current_value ELSE default_yarn_rate END,
              updated_at = now()
          WHERE id = v_template.id AND org_id = v_org_id;
          v_synced_quality_count := v_synced_quality_count + 1;
        END IF;
      ELSE
        SELECT COALESCE(jsonb_agg(
          CASE WHEN lower(regexp_replace(btrim(COALESCE(element ->> 'label', '')), '\s+', ' ', 'g')) = v_normalized_name
            THEN jsonb_set(element, '{yarnRate}', to_jsonb(p_current_value), true)
            ELSE element END ORDER BY ordinal
        ), '[]'::jsonb),
        bool_or(lower(regexp_replace(btrim(COALESCE(element ->> 'label', '')), '\s+', ' ', 'g')) = v_normalized_name)
        INTO v_rows, v_changed
        FROM jsonb_array_elements(COALESCE(v_template.weft_rows, '[]'::jsonb)) WITH ORDINALITY AS rows(element, ordinal);

        IF COALESCE(v_changed, false) THEN
          UPDATE public.estimator_templates
          SET weft_rows = v_rows, updated_at = now()
          WHERE id = v_template.id AND org_id = v_org_id;
          v_synced_quality_count := v_synced_quality_count + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'rate', to_jsonb(v_rate),
    'synced_quality_count', v_synced_quality_count
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A rate with this name and category already exists.';
END;
$$;

REVOKE ALL ON FUNCTION public.save_cost_rate_atomic(
  uuid, text, text, text, numeric, date, date, integer, text, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cost_rate_atomic(
  uuid, text, text, text, numeric, date, date, integer, text, text, boolean
) TO authenticated;

COMMENT ON FUNCTION public.save_cost_rate_atomic(
  uuid, text, text, text, numeric, date, date, integer, text, text, boolean
) IS 'Atomically saves a tenant-scoped reviewed costing rate, history, optional factory default, and matching saved-quality layers.';
