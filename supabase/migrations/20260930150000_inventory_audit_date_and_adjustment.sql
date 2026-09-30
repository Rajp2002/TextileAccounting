-- PI-06: Stock audit date changes and adjustments.
--
-- 1. get_inventory_audit_data. The client passed the new date together with the previous audit's id, and the board
--    loaded the audit by id first, so it showed date B's stock beside audit A's lines and counts then saved against
--    audit A. The audit id now decides the date, and with no id the date's open draft wins, else the date's latest
--    finalized audit (so an earlier date can be viewed again after finalizing). The returned audit_date is the date
--    the board was actually computed for.
-- 2. apply_inventory_audit_adjustment. The owner is shown line.variance (the count against stock as of the audit
--    date), but the function applied p_physical_count minus the CURRENT stock and overwrote stock with the count,
--    so a later production or dispatch made the applied delta differ from the one shown, and adjusting a past
--    date erased every movement since. It now applies exactly the shown variance as a movement on top of current
--    stock: variance = count minus stock as of the audit date (the same figure record_inventory_audit_count stores),
--    new stock = current stock + variance. For an audit dated today that is the counted figure, as before. The
--    optional p_expected_variance is what the owner saw; a difference is refused instead of applied. An adjustment
--    that would take stock below zero is refused with an explanation.
--
-- The old five-argument function is dropped first: the new sixth argument has a default, so keeping both would make a
-- five-argument call ambiguous. Existing callers keep working through the default.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_inventory_audit_data(
  p_audit_date date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  p_audit_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid;
  cutoff timestamptz;
  v_yarns jsonb;
  v_fabrics jsonb;
  v_material_pos jsonb := '[]'::jsonb;
  v_yarn record;
  v_loose_kg numeric;
  v_embodied_kg numeric;
  v_total_kg numeric;
  v_drilldown jsonb;
  v_total_fabric_meters numeric := 0;
  v_total_loose_yarn_kg numeric := 0;
  v_total_embodied_yarn_kg numeric := 0;
  v_unresolved_fabric_meters numeric := 0;
  v_lot_meters_sum numeric := 0;
  v_audit public.inventory_audits%ROWTYPE;
  v_date date;
  v_audit_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;

  -- Resolve the audit first, because an audit id decides the date. Loading audit A with date B used to return
  -- date B's stock beside audit A's lines (PI-06). With no id, the date's open draft wins; a date that only has
  -- a finalized audit loads that audit, so an earlier date can be viewed again after finalizing.
  IF p_audit_id IS NOT NULL THEN
    SELECT * INTO v_audit FROM public.inventory_audits WHERE id = p_audit_id AND org_id = o;
  ELSE
    SELECT * INTO v_audit FROM public.inventory_audits
    WHERE org_id = o AND audit_date = p_audit_date
    ORDER BY (status = 'draft') DESC, created_at DESC LIMIT 1;
  END IF;
  v_date := coalesce(v_audit.audit_date, p_audit_date, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  cutoff := (v_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata';

  -- 1. Operational loose yarn stock (as of cutoff)
  SELECT jsonb_agg(jsonb_build_object(
    'id', per_yarn.id,
    'yarn_name', per_yarn.yarn_name,
    'yarn_key', per_yarn.yarn_key,
    'system_loose_kg', per_yarn.system_loose_kg
  ) ORDER BY per_yarn.yarn_name)
  INTO v_yarns
  FROM (
    SELECT y.id, y.yarn_name, y.yarn_key, round(coalesce(sum(m.kg_delta), 0), 3) AS system_loose_kg
    FROM public.yarn_stock y
    LEFT JOIN public.yarn_stock_movements m ON m.org_id = y.org_id AND m.yarn_id = y.id AND m.created_at < cutoff
    WHERE y.org_id = o
    GROUP BY y.id
  ) AS per_yarn;
  v_yarns := coalesce(v_yarns, '[]'::jsonb);

  -- Total loose yarn kg
  SELECT coalesce(sum(round(coalesce(m.kg_delta, 0), 3)), 0)
  INTO v_total_loose_yarn_kg
  FROM public.yarn_stock y
  JOIN public.yarn_stock_movements m ON m.org_id = y.org_id AND m.yarn_id = y.id AND m.created_at < cutoff
  WHERE y.org_id = o;

  -- 2. Finished fabric stock (as of cutoff)
  SELECT jsonb_agg(jsonb_build_object(
    'id', per_quality.id,
    'quality_label', per_quality.quality_label,
    'quality_key', per_quality.quality_key,
    'system_meters', per_quality.system_meters
  ) ORDER BY per_quality.quality_label)
  INTO v_fabrics
  FROM (
    SELECT q.id, q.quality_label, q.quality_key, round(coalesce(sum(m.meters_delta), 0), 2) AS system_meters
    FROM public.quality_stock q
    LEFT JOIN public.quality_stock_movements m ON m.org_id = q.org_id AND m.quality_id = q.id AND m.created_at < cutoff
    WHERE q.org_id = o
    GROUP BY q.id
  ) AS per_quality;
  v_fabrics := coalesce(v_fabrics, '[]'::jsonb);

  -- Total fabric meters
  SELECT coalesce(sum(round(coalesce(m.meters_delta, 0), 2)), 0)
  INTO v_total_fabric_meters
  FROM public.quality_stock q
  JOIN public.quality_stock_movements m ON m.org_id = q.org_id AND m.quality_id = q.id AND m.created_at < cutoff
  WHERE q.org_id = o;

  -- 3. Embodied Yarn Calculation (Section 22: proportional consumption of remaining fabric lots)
  -- Total remaining meters in production lots as of cutoff
  SELECT coalesce(sum(lot.remaining_meters), 0)
  INTO v_lot_meters_sum
  FROM public.production_stock_lots lot
  WHERE lot.org_id = o AND lot.created_at < cutoff;

  v_unresolved_fabric_meters := GREATEST(0, v_total_fabric_meters - v_lot_meters_sum);

  -- Build Material Position per yarn:
  -- Material Position = Loose Yarn + Yarn Embodied in Current Fabric Stock (Section 30)
  FOR v_yarn IN
    SELECT y.id, y.yarn_name, y.yarn_key,
           round(coalesce(sum(m.kg_delta), 0), 3) AS loose_kg
    FROM public.yarn_stock y
    LEFT JOIN public.yarn_stock_movements m ON m.org_id = y.org_id AND m.yarn_id = y.id AND m.created_at < cutoff
    WHERE y.org_id = o
    GROUP BY y.id
    ORDER BY y.yarn_name
  LOOP
    v_loose_kg := v_yarn.loose_kg;
    v_embodied_kg := 0;
    v_drilldown := '[]'::jsonb;

    -- Find all remaining production lots containing this yarn
    SELECT coalesce(sum(
             round(((item->>'consumed_kg')::numeric * (lot.remaining_meters / lot.produced_meters)), 3)
           ), 0),
           coalesce(jsonb_agg(jsonb_build_object(
             'lot_id', lot.id,
             'quality_label', lot.quality_label,
             'costing_version', lot.costing_version,
             'produced_meters', lot.produced_meters,
             'remaining_meters', lot.remaining_meters,
             'embodied_kg', round(((item->>'consumed_kg')::numeric * (lot.remaining_meters / lot.produced_meters)), 3),
             'production_date', lot.production_date,
             'created_at', lot.created_at
           ) ORDER BY lot.created_at DESC), '[]'::jsonb)
    INTO v_embodied_kg, v_drilldown
    FROM public.production_stock_lots lot
    CROSS JOIN LATERAL jsonb_array_elements(lot.yarn_consumption_snapshot) item
    WHERE lot.org_id = o
      AND lot.created_at < cutoff
      AND lot.remaining_meters > 0
      AND item->>'yarn_key' = v_yarn.yarn_key;

    v_total_kg := v_loose_kg + v_embodied_kg;
    v_total_embodied_yarn_kg := v_total_embodied_yarn_kg + v_embodied_kg;

    v_material_pos := v_material_pos || jsonb_build_array(jsonb_build_object(
      'yarn_id', v_yarn.id,
      'yarn_name', v_yarn.yarn_name,
      'yarn_key', v_yarn.yarn_key,
      'loose_kg', v_loose_kg,
      'embodied_kg', v_embodied_kg,
      'total_represented_kg', v_total_kg,
      'drilldown', v_drilldown
    ));
  END LOOP;

  -- 4. Load the resolved audit's lines
  IF v_audit.id IS NOT NULL THEN
      SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.item_type, l.item_label), '[]'::jsonb)
      INTO v_audit_lines
      FROM public.inventory_audit_lines l
      WHERE l.audit_id = v_audit.id;
  END IF;

  RETURN jsonb_build_object(
    'audit_date', v_date,
    'audit', CASE WHEN v_audit.id IS NOT NULL THEN to_jsonb(v_audit) ELSE NULL END,
    'lines', v_audit_lines,
    'summary', jsonb_build_object(
      'total_fabric_meters', v_total_fabric_meters,
      'total_loose_yarn_kg', v_total_loose_yarn_kg,
      'total_embodied_yarn_kg', v_total_embodied_yarn_kg,
      'total_yarn_represented_kg', v_total_loose_yarn_kg + v_total_embodied_yarn_kg,
      'unresolved_fabric_meters', v_unresolved_fabric_meters
    ),
    'yarns', v_yarns,
    'fabric', v_fabrics,
    'material_position', v_material_pos
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_inventory_audit_data(date, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_inventory_audit_data(date, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.apply_inventory_audit_adjustment(
  p_audit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_physical_count numeric,
  p_reason text DEFAULT 'Physical stock reconciliation',
  p_expected_variance numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid;
  v_audit public.inventory_audits%ROWTYPE;
  v_yarn public.yarn_stock%ROWTYPE;
  v_fabric public.quality_stock%ROWTYPE;
  v_system numeric;
  v_variance numeric;
  v_new_quantity numeric;
  v_movement_id uuid;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Physical stock reconciliation');
  cutoff timestamptz;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_org_not_locked(o);
  IF p_physical_count IS NULL OR p_physical_count < 0 OR p_physical_count > 100000000000 THEN
    RAISE EXCEPTION 'Enter a valid non-negative physical count' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_audit FROM public.inventory_audits WHERE id = p_audit_id AND org_id = o FOR UPDATE;
  IF v_audit.id IS NULL THEN RAISE EXCEPTION 'Inventory audit not found' USING ERRCODE = '23503'; END IF;
  IF v_audit.status = 'finalized' THEN RAISE EXCEPTION 'Finalized audit cannot be adjusted' USING ERRCODE = '22023'; END IF;

  cutoff := (v_audit.audit_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata';

  IF p_item_type = 'yarn' THEN
    SELECT * INTO v_yarn FROM public.yarn_stock WHERE id = p_item_id AND org_id = o FOR UPDATE;
    IF v_yarn.id IS NULL THEN RAISE EXCEPTION 'Yarn not found' USING ERRCODE = '23503'; END IF;

    SELECT round(coalesce(sum(m.kg_delta), 0), 3) INTO v_system
    FROM public.yarn_stock_movements m
    WHERE m.org_id = o AND m.yarn_id = v_yarn.id AND m.created_at < cutoff;
    v_variance := round(p_physical_count - v_system, 3);

    IF p_expected_variance IS NOT NULL AND round(p_expected_variance, 3) <> v_variance THEN
      RAISE EXCEPTION 'The adjustment changed since it was shown (was %, now %). Review it and try again.', round(p_expected_variance, 3), v_variance USING ERRCODE = '22023';
    END IF;
    IF v_variance = 0 THEN
      RETURN jsonb_build_object('success', true, 'adjusted', false, 'message', 'Physical count equals system count');
    END IF;
    v_new_quantity := v_yarn.weight_kg + v_variance;
    IF v_new_quantity < 0 THEN
      RAISE EXCEPTION 'Stock has changed since %: this adjustment would make stock negative (now % kg, adjustment % kg). Count again as of today.', v_audit.audit_date, v_yarn.weight_kg, v_variance USING ERRCODE = '22023';
    END IF;

    UPDATE public.yarn_stock
    SET weight_kg = v_new_quantity
    WHERE id = v_yarn.id;

    INSERT INTO public.yarn_stock_movements(
      org_id, yarn_id, kind, kg_delta, balance_after, reason, created_by
    )
    VALUES(
      o, v_yarn.id, 'audit_adjustment', v_variance, v_new_quantity,
      v_reason || ' (Audit: ' || v_audit.title || ')', auth.uid()
    )
    RETURNING id INTO v_movement_id;

    INSERT INTO public.inventory_audit_lines(
      audit_id, org_id, item_type, item_id, item_label,
      system_quantity, physical_count, adjustment_applied, adjustment_movement_id, notes
    )
    VALUES(
      v_audit.id, o, 'yarn', v_yarn.id, v_yarn.yarn_name,
      v_system, p_physical_count, true, v_movement_id, v_reason
    )
    ON CONFLICT (audit_id, item_type, item_id) DO UPDATE SET
      system_quantity = excluded.system_quantity,
      physical_count = excluded.physical_count,
      adjustment_applied = true,
      adjustment_movement_id = v_movement_id,
      notes = excluded.notes,
      updated_at = clock_timestamp();

  ELSIF p_item_type = 'fabric' THEN
    SELECT * INTO v_fabric FROM public.quality_stock WHERE id = p_item_id AND org_id = o FOR UPDATE;
    IF v_fabric.id IS NULL THEN RAISE EXCEPTION 'Fabric quality not found' USING ERRCODE = '23503'; END IF;

    SELECT round(coalesce(sum(m.meters_delta), 0), 2) INTO v_system
    FROM public.quality_stock_movements m
    WHERE m.org_id = o AND m.quality_id = v_fabric.id AND m.created_at < cutoff;
    v_variance := round(p_physical_count - v_system, 2);

    IF p_expected_variance IS NOT NULL AND round(p_expected_variance, 2) <> v_variance THEN
      RAISE EXCEPTION 'The adjustment changed since it was shown (was %, now %). Review it and try again.', round(p_expected_variance, 2), v_variance USING ERRCODE = '22023';
    END IF;
    IF v_variance = 0 THEN
      RETURN jsonb_build_object('success', true, 'adjusted', false, 'message', 'Physical count equals system count');
    END IF;
    v_new_quantity := v_fabric.meters + v_variance;
    IF v_new_quantity < 0 THEN
      RAISE EXCEPTION 'Stock has changed since %: this adjustment would make stock negative (now % m, adjustment % m). Count again as of today.', v_audit.audit_date, v_fabric.meters, v_variance USING ERRCODE = '22023';
    END IF;

    UPDATE public.quality_stock
    SET meters = v_new_quantity, updated_at = clock_timestamp()
    WHERE id = v_fabric.id;

    INSERT INTO public.quality_stock_movements(
      org_id, quality_id, kind, meters_delta, balance_after, reason, source_table, source_id, created_by
    )
    VALUES(
      o, v_fabric.id, 'audit_adjustment', v_variance, v_new_quantity,
      v_reason || ' (Audit: ' || v_audit.title || ')', 'inventory_audits', v_audit.id::text, auth.uid()
    )
    RETURNING id INTO v_movement_id;

    INSERT INTO public.inventory_audit_lines(
      audit_id, org_id, item_type, item_id, item_label,
      system_quantity, physical_count, adjustment_applied, adjustment_movement_id, notes
    )
    VALUES(
      v_audit.id, o, 'fabric', v_fabric.id, v_fabric.quality_label,
      v_system, p_physical_count, true, v_movement_id, v_reason
    )
    ON CONFLICT (audit_id, item_type, item_id) DO UPDATE SET
      system_quantity = excluded.system_quantity,
      physical_count = excluded.physical_count,
      adjustment_applied = true,
      adjustment_movement_id = v_movement_id,
      notes = excluded.notes,
      updated_at = clock_timestamp();

  ELSE
    RAISE EXCEPTION 'Unknown item type %', p_item_type USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'adjusted', true, 'variance', v_variance, 'movement_id', v_movement_id,
    'system_quantity', v_system, 'balance_after', v_new_quantity
  );
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text, numeric) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text, numeric) TO authenticated;

COMMIT;
