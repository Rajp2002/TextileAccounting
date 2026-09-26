-- Owner write path for inventory audits.
--
-- 20260920000000 grants owners SELECT only on inventory_audits and
-- inventory_audit_lines, while the server actions inserted into both tables
-- directly, so creating an audit and recording a physical count always failed
-- with "permission denied". Direct table writes stay revoked. These two
-- SECURITY DEFINER functions apply the same owner, Base stock access, locked
-- organization and finalized-audit checks as apply_inventory_audit_adjustment,
-- and derive item labels and system quantities on the server (as of the audit
-- date, rounded like get_inventory_audit_data) instead of trusting the client.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_inventory_audit_draft(
  p_audit_date date,
  p_title text DEFAULT 'Stock Audit',
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid;
  v_audit public.inventory_audits%ROWTYPE;
  v_title text := coalesce(nullif(btrim(p_title), ''), 'Stock Audit');
  v_notes text := nullif(btrim(p_notes), '');
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_org_not_locked(o);
  IF p_audit_date IS NULL OR p_audit_date > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'Choose an audit date that is not in the future' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_title) > 160 OR char_length(coalesce(v_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Audit title or notes are too long' USING ERRCODE = '22023';
  END IF;

  -- One open draft per organization and date; retries and double clicks reuse it.
  PERFORM pg_advisory_xact_lock(hashtextextended(o::text || ':inventory-audit:' || p_audit_date::text, 0));
  SELECT * INTO v_audit FROM public.inventory_audits
  WHERE org_id = o AND audit_date = p_audit_date AND status = 'draft'
  ORDER BY created_at DESC LIMIT 1;
  IF v_audit.id IS NOT NULL THEN
    RETURN jsonb_build_object('audit_id', v_audit.id, 'created', false);
  END IF;

  INSERT INTO public.inventory_audits(org_id, audit_date, title, notes, status, created_by)
  VALUES (o, p_audit_date, v_title, v_notes, 'draft', auth.uid())
  RETURNING * INTO v_audit;
  RETURN jsonb_build_object('audit_id', v_audit.id, 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_inventory_audit_draft(date, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_inventory_audit_draft(date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_inventory_audit_count(
  p_audit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_physical_count numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid;
  v_audit public.inventory_audits%ROWTYPE;
  v_line public.inventory_audit_lines%ROWTYPE;
  v_label text;
  v_system numeric;
  v_notes text := nullif(btrim(p_notes), '');
  cutoff timestamptz;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_org_not_locked(o);
  IF p_physical_count IS NULL OR p_physical_count < 0 OR p_physical_count > 100000000000 THEN
    RAISE EXCEPTION 'Enter a valid non-negative physical count' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_notes, '')) > 500 THEN RAISE EXCEPTION 'Notes must be 500 characters or fewer' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_audit FROM public.inventory_audits WHERE id = p_audit_id AND org_id = o FOR UPDATE;
  IF v_audit.id IS NULL THEN RAISE EXCEPTION 'Inventory audit not found' USING ERRCODE = '23503'; END IF;
  IF v_audit.status = 'finalized' THEN RAISE EXCEPTION 'Finalized audit cannot be changed' USING ERRCODE = '22023'; END IF;

  cutoff := (v_audit.audit_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata';
  IF p_item_type = 'yarn' THEN
    SELECT y.yarn_name, round(coalesce(sum(m.kg_delta), 0), 3)
    INTO v_label, v_system
    FROM public.yarn_stock y
    LEFT JOIN public.yarn_stock_movements m ON m.org_id = y.org_id AND m.yarn_id = y.id AND m.created_at < cutoff
    WHERE y.id = p_item_id AND y.org_id = o
    GROUP BY y.id, y.yarn_name;
    IF v_label IS NULL THEN RAISE EXCEPTION 'Yarn not found' USING ERRCODE = '23503'; END IF;
  ELSIF p_item_type = 'fabric' THEN
    SELECT q.quality_label, round(coalesce(sum(m.meters_delta), 0), 2)
    INTO v_label, v_system
    FROM public.quality_stock q
    LEFT JOIN public.quality_stock_movements m ON m.org_id = q.org_id AND m.quality_id = q.id AND m.created_at < cutoff
    WHERE q.id = p_item_id AND q.org_id = o
    GROUP BY q.id, q.quality_label;
    IF v_label IS NULL THEN RAISE EXCEPTION 'Fabric quality not found' USING ERRCODE = '23503'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown item type %', p_item_type USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_line FROM public.inventory_audit_lines
  WHERE audit_id = v_audit.id AND item_type = p_item_type AND item_id = p_item_id;
  IF v_line.adjustment_applied THEN
    RAISE EXCEPTION 'This count was already applied to stock. Start a new audit to count it again.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory_audit_lines(audit_id, org_id, item_type, item_id, item_label, system_quantity, physical_count, notes)
  VALUES (v_audit.id, o, p_item_type, p_item_id, v_label, v_system, p_physical_count, v_notes)
  ON CONFLICT (audit_id, item_type, item_id) DO UPDATE SET
    item_label = excluded.item_label,
    system_quantity = excluded.system_quantity,
    physical_count = excluded.physical_count,
    notes = excluded.notes,
    updated_at = clock_timestamp()
  RETURNING * INTO v_line;
  UPDATE public.inventory_audits SET updated_at = clock_timestamp() WHERE id = v_audit.id;

  RETURN jsonb_build_object(
    'audit_id', v_audit.id,
    'line_id', v_line.id,
    'system_quantity', v_line.system_quantity,
    'physical_count', v_line.physical_count,
    'variance', v_line.variance
  );
END;
$$;
REVOKE ALL ON FUNCTION public.record_inventory_audit_count(uuid, text, uuid, numeric, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_inventory_audit_count(uuid, text, uuid, numeric, text) TO authenticated;

COMMIT;
