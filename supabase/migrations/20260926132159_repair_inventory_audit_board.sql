-- Repair get_inventory_audit_data (inventory audit page and finalize).
--
-- 20260920000000 nested sum() inside jsonb_agg() for the loose-yarn and
-- fabric lists, which PostgreSQL rejects (42803) on every call, and read
-- v_audit.id from a record that is never assigned when no audit id is given.
-- Aggregate per item first, then build the same JSON (same keys, rounding and
-- ordering), declare v_audit as a row type, and, as the function's own comment
-- intends, load the latest draft for the date when no audit id is passed.
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
  v_audit_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;

  cutoff := (p_audit_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata';

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

  -- 4. If audit ID is provided or existing draft for this date, load lines
  IF p_audit_id IS NOT NULL THEN
    SELECT * INTO v_audit FROM public.inventory_audits WHERE id = p_audit_id AND org_id = o;
  ELSE
    SELECT * INTO v_audit FROM public.inventory_audits
    WHERE org_id = o AND audit_date = p_audit_date AND status = 'draft'
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_audit.id IS NOT NULL THEN
      SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.item_type, l.item_label), '[]'::jsonb)
      INTO v_audit_lines
      FROM public.inventory_audit_lines l
      WHERE l.audit_id = v_audit.id;
  END IF;

  RETURN jsonb_build_object(
    'audit_date', p_audit_date,
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
COMMIT;
