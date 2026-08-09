-- Saved Qualities are a second authoritative write-time discovery source for
-- the Base Rate Book. Keeping this in the same transaction as the quality
-- write lets the Rate Book GET remain read-only and idempotent.

CREATE OR REPLACE FUNCTION public.sync_saved_quality_yarns_to_rate_book()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_layer record;
  v_name text;
  v_normalized_name text;
  v_rate numeric;
  v_review_interval_days integer := 90;
  v_existing public.cost_rate_book%ROWTYPE;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(profile.yarn_review_interval_days, 90)
  INTO v_review_interval_days
  FROM public.factory_cost_profile AS profile
  WHERE profile.factory_id = NEW.org_id;

  FOR v_layer IN
    SELECT 'yarn_warp'::text AS category, rows.element
    FROM jsonb_array_elements(COALESCE(NEW.warp_rows, '[]'::jsonb)) AS rows(element)
    UNION ALL
    SELECT 'yarn_weft'::text AS category, rows.element
    FROM jsonb_array_elements(COALESCE(NEW.weft_rows, '[]'::jsonb)) AS rows(element)
  LOOP
    IF jsonb_typeof(v_layer.element -> 'label') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_layer.element -> 'yarnRate') IS DISTINCT FROM 'number' THEN
      CONTINUE;
    END IF;

    v_name := regexp_replace(btrim(v_layer.element ->> 'label'), '\s+', ' ', 'g');
    v_normalized_name := lower(v_name);
    v_rate := (v_layer.element ->> 'yarnRate')::numeric;

    IF v_name = '' OR char_length(v_name) > 120
       OR v_rate = 'NaN'::numeric OR v_rate < 0 OR v_rate > 10000000 THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.org_id::text || ':' || v_layer.category || ':' || v_normalized_name,
      0
    ));

    SELECT * INTO v_existing
    FROM public.cost_rate_book AS rate
    WHERE rate.org_id = NEW.org_id
      AND rate.category = v_layer.category
      AND lower(regexp_replace(btrim(rate.name), '\s+', ' ', 'g')) = v_normalized_name
    ORDER BY rate.is_active DESC, rate.created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      -- Positive or reviewed values are owner-controlled. Only an untouched
      -- zero default may be promoted by a saved-quality write.
      IF v_existing.is_active
         AND v_existing.current_value = 0
         AND v_rate > 0
         AND v_existing.source = 'Estimator defaults'
      THEN
        UPDATE public.cost_rate_book
        SET current_value = v_rate,
            effective_date = current_date,
            last_reviewed_at = current_date,
            review_interval_days = v_review_interval_days,
            source = 'Saved quality',
            notes = left('Discovered from ' || NEW.name || ' in a Saved Quality.', 500),
            updated_by = auth.uid(),
            updated_at = now()
        WHERE id = v_existing.id;
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.cost_rate_book (
      org_id, name, category, unit, current_value, effective_date,
      last_reviewed_at, review_interval_days, source, notes,
      apply_as_default, created_by, updated_by
    ) VALUES (
      NEW.org_id, v_name, v_layer.category, 'per_kg', v_rate, current_date,
      current_date, v_review_interval_days, 'Saved quality',
      left('Discovered from ' || NEW.name || ' in a Saved Quality.', 500),
      false, auth.uid(), auth.uid()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimator_templates_sync_saved_quality_yarns ON public.estimator_templates;
CREATE TRIGGER estimator_templates_sync_saved_quality_yarns
  AFTER INSERT OR UPDATE OF warp_rows, weft_rows, is_active ON public.estimator_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_saved_quality_yarns_to_rate_book();

REVOKE ALL ON FUNCTION public.sync_saved_quality_yarns_to_rate_book() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_saved_quality_yarns_to_rate_book() IS
  'Adds or promotes untouched yarn rates when an active Saved Quality is written; never overwrites a positive or reviewed owner rate.';
