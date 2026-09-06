-- Exclude template-linked child costings from blocking yarn renames/deletions,
-- and retroactively clean up obsolete orphaned rates like 'Warp B'.

CREATE OR REPLACE FUNCTION public.sync_saved_quality_yarns_to_rate_book()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_category text;
  v_old_rows jsonb;
  v_new_rows jsonb;
  v_old_row jsonb;
  v_new_row jsonb;
  v_old_id text;
  v_old_name text;
  v_old_norm text;
  v_new_name text;
  v_new_norm text;
  v_new_rate numeric;
  v_used_elsewhere boolean;
  v_old_existing public.cost_rate_book%ROWTYPE;
  v_new_existing public.cost_rate_book%ROWTYPE;
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

  -- If this is an UPDATE of an active Saved Quality, handle renames and deletions
  IF TG_OP = 'UPDATE' AND OLD.is_active = true THEN
    FOR v_category IN SELECT 'yarn_warp' UNION ALL SELECT 'yarn_weft' LOOP
      IF v_category = 'yarn_warp' THEN
        v_old_rows := COALESCE(OLD.warp_rows, '[]'::jsonb);
        v_new_rows := COALESCE(NEW.warp_rows, '[]'::jsonb);
      ELSE
        v_old_rows := COALESCE(OLD.weft_rows, '[]'::jsonb);
        v_new_rows := COALESCE(NEW.weft_rows, '[]'::jsonb);
      END IF;

      FOR v_old_row IN SELECT * FROM jsonb_array_elements(v_old_rows) LOOP
        v_old_id := v_old_row ->> 'id';
        v_old_name := regexp_replace(btrim(COALESCE(v_old_row ->> 'label', '')), '\s+', ' ', 'g');
        v_old_norm := lower(v_old_name);

        IF v_old_name = '' OR char_length(v_old_name) > 120 THEN
          CONTINUE;
        END IF;

        -- Find matching new row by id if present
        v_new_row := NULL;
        IF v_old_id IS NOT NULL AND v_old_id <> '' THEN
          SELECT element INTO v_new_row
          FROM jsonb_array_elements(v_new_rows) AS element
          WHERE element ->> 'id' = v_old_id
          LIMIT 1;
        END IF;

        IF v_new_row IS NOT NULL THEN
          v_new_name := regexp_replace(btrim(COALESCE(v_new_row ->> 'label', '')), '\s+', ' ', 'g');
          v_new_norm := lower(v_new_name);
        ELSE
          v_new_name := '';
          v_new_norm := '';
        END IF;

        -- If yarn name changed or row was removed
        IF v_old_norm <> v_new_norm THEN
          -- Check if old yarn is used anywhere else in the factory.
          -- Deliberately exclude the template's own child costing snapshot (q.template_id = NEW.id).
          SELECT (
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(NEW.warp_rows, '[]'::jsonb)) AS r
              WHERE lower(regexp_replace(btrim(COALESCE(r ->> 'label', '')), '\s+', ' ', 'g')) = v_old_norm
            )
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(NEW.weft_rows, '[]'::jsonb)) AS r
              WHERE lower(regexp_replace(btrim(COALESCE(r ->> 'label', '')), '\s+', ' ', 'g')) = v_old_norm
            )
            OR EXISTS (
              SELECT 1
              FROM public.estimator_templates AS t,
                   jsonb_array_elements(COALESCE(t.warp_rows, '[]'::jsonb) || COALESCE(t.weft_rows, '[]'::jsonb)) AS r
              WHERE t.org_id = NEW.org_id
                AND t.id <> NEW.id
                AND t.is_active = true
                AND lower(regexp_replace(btrim(COALESCE(r ->> 'label', '')), '\s+', ' ', 'g')) = v_old_norm
            )
            OR EXISTS (
              SELECT 1
              FROM public.estimator_quotes AS q,
                   jsonb_array_elements(COALESCE(q.warp_rows, '[]'::jsonb) || COALESCE(q.weft_rows, '[]'::jsonb)) AS r
              WHERE q.org_id = NEW.org_id
                AND q.record_kind = 'costing'
                AND q.is_archived = false
                AND (q.template_id IS NULL OR q.template_id <> NEW.id)
                AND lower(regexp_replace(btrim(COALESCE(r ->> 'label', '')), '\s+', ' ', 'g')) = v_old_norm
            )
          ) INTO v_used_elsewhere;

          IF NOT v_used_elsewhere THEN
            PERFORM pg_advisory_xact_lock(hashtextextended(
              NEW.org_id::text || ':' || v_category || ':' || v_old_norm,
              0
            ));

            SELECT * INTO v_old_existing
            FROM public.cost_rate_book AS rate
            WHERE rate.org_id = NEW.org_id
              AND rate.category = v_category
              AND lower(regexp_replace(btrim(rate.name), '\s+', ' ', 'g')) = v_old_norm
            ORDER BY rate.is_active DESC, rate.created_at ASC
            LIMIT 1
            FOR UPDATE;

            IF FOUND THEN
              IF v_new_name <> '' AND char_length(v_new_name) <= 120 THEN
                v_new_rate := (v_new_row ->> 'yarnRate')::numeric;

                SELECT * INTO v_new_existing
                FROM public.cost_rate_book AS rate
                WHERE rate.org_id = NEW.org_id
                  AND rate.category = v_category
                  AND lower(regexp_replace(btrim(rate.name), '\s+', ' ', 'g')) = v_new_norm
                ORDER BY rate.is_active DESC, rate.created_at ASC
                LIMIT 1
                FOR UPDATE;

                IF NOT FOUND THEN
                  -- Rename the rate in-place so Rate Book retains identity and does not create duplicate
                  UPDATE public.cost_rate_book
                  SET name = v_new_name,
                      current_value = CASE
                        WHEN v_new_rate IS NOT NULL AND v_new_rate >= 0 AND v_new_rate <= 10000000 AND v_new_rate <> 'NaN'::numeric
                        THEN v_new_rate
                        ELSE current_value
                      END,
                      effective_date = current_date,
                      last_reviewed_at = current_date,
                      review_interval_days = v_review_interval_days,
                      source = 'Saved quality',
                      notes = left('Discovered from ' || NEW.name || ' in a Saved Quality.', 500),
                      updated_by = auth.uid(),
                      updated_at = now()
                  WHERE id = v_old_existing.id;
                ELSE
                  -- New yarn already exists in Rate Book; remove obsolete old auto-discovered rate
                  IF v_old_existing.source IN ('Saved quality', 'Saved costing')
                     AND v_old_existing.apply_as_default = false THEN
                    DELETE FROM public.cost_rate_book WHERE id = v_old_existing.id;
                  END IF;
                END IF;
              ELSE
                -- Row removed from quality and used nowhere else
                IF v_old_existing.source IN ('Saved quality', 'Saved costing')
                   AND v_old_existing.apply_as_default = false THEN
                  DELETE FROM public.cost_rate_book WHERE id = v_old_existing.id;
                END IF;
              END IF;
            END IF;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Process NEW rows: insert previously unseen yarns or promote untouched zero defaults
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

-- Retroactive cleanup of unreviewed auto-discovered rates with zero usages across all active templates and standalone costings
DELETE FROM public.cost_rate_book AS rate
WHERE rate.category IN ('yarn_warp', 'yarn_weft')
  AND rate.source = 'Saved quality'
  AND rate.apply_as_default = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.cost_rate_history AS history
    WHERE history.rate_id = rate.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.estimator_templates AS t,
         jsonb_array_elements(COALESCE(t.warp_rows, '[]'::jsonb) || COALESCE(t.weft_rows, '[]'::jsonb)) AS r
    WHERE t.org_id = rate.org_id
      AND t.is_active = true
      AND lower(regexp_replace(btrim(COALESCE(r ->> 'label', '')), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(rate.name), '\s+', ' ', 'g'))
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.estimator_quotes AS q,
         jsonb_array_elements(COALESCE(q.warp_rows, '[]'::jsonb) || COALESCE(q.weft_rows, '[]'::jsonb)) AS r
    WHERE q.org_id = rate.org_id
      AND q.record_kind = 'costing'
      AND q.is_archived = false
      AND q.template_id IS NULL
      AND lower(regexp_replace(btrim(COALESCE(r ->> 'label', '')), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(rate.name), '\s+', ' ', 'g'))
  );
