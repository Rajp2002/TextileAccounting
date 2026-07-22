-- A costing snapshot is the source of truth for the yarns used in that
-- costing. Learn previously unseen warp and weft yarns in the same transaction
-- that saves the snapshot, without overwriting a rate the owner already keeps.

CREATE OR REPLACE FUNCTION public.sync_saved_costing_yarns_to_rate_book()
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
  v_existing public.cost_rate_book%ROWTYPE;
BEGIN
  IF NEW.record_kind IS DISTINCT FROM 'costing' THEN
    RETURN NEW;
  END IF;

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

    -- The table's historical unique key is case-sensitive. Serialize on the
    -- normalized business key so differently-cased saves cannot race.
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
      -- Promote only an untouched zero placeholder. Positive or reviewed
      -- values remain owner-controlled and historical costings stay immutable.
      IF v_existing.is_active
         AND v_existing.current_value = 0
         AND v_rate > 0
         AND v_existing.source = 'Estimator defaults'
      THEN
        UPDATE public.cost_rate_book
        SET current_value = v_rate,
            effective_date = current_date,
            last_reviewed_at = current_date,
            source = 'Saved costing',
            notes = left('Discovered from ' || v_name || ' in a saved costing.', 500),
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
      current_date, 90, 'Saved costing',
      left('Discovered from ' || v_name || ' in a saved costing.', 500),
      false, auth.uid(), auth.uid()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimator_quotes_sync_costing_yarns ON public.estimator_quotes;
CREATE TRIGGER estimator_quotes_sync_costing_yarns
  AFTER INSERT ON public.estimator_quotes
  FOR EACH ROW
  WHEN (NEW.record_kind = 'costing')
  EXECUTE FUNCTION public.sync_saved_costing_yarns_to_rate_book();

COMMENT ON FUNCTION public.sync_saved_costing_yarns_to_rate_book() IS
  'Adds previously unseen warp and weft yarn rates when an owner saves a costing snapshot.';
