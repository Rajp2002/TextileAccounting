-- ROLLBACK for fix package F1 (not a migration; run only if F1 must be undone).
-- Restores the pre-F1 definitions from 20260920000000 and 20260922135042,
-- removes the two F1 audit functions and their migration-history rows.
-- Versions below are the ones recorded in production on 2026-09-26.
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
  v_audit record;
  v_audit_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;

  cutoff := (p_audit_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata';

  -- 1. Operational loose yarn stock (as of cutoff)
  SELECT jsonb_agg(jsonb_build_object(
    'id', y.id,
    'yarn_name', y.yarn_name,
    'yarn_key', y.yarn_key,
    'system_loose_kg', round(coalesce(sum(m.kg_delta), 0), 3)
  ) ORDER BY y.yarn_name)
  INTO v_yarns
  FROM public.yarn_stock y
  LEFT JOIN public.yarn_stock_movements m ON m.org_id = y.org_id AND m.yarn_id = y.id AND m.created_at < cutoff
  WHERE y.org_id = o
  GROUP BY y.id;
  v_yarns := coalesce(v_yarns, '[]'::jsonb);

  -- Total loose yarn kg
  SELECT coalesce(sum(round(coalesce(m.kg_delta, 0), 3)), 0)
  INTO v_total_loose_yarn_kg
  FROM public.yarn_stock y
  JOIN public.yarn_stock_movements m ON m.org_id = y.org_id AND m.yarn_id = y.id AND m.created_at < cutoff
  WHERE y.org_id = o;

  -- 2. Finished fabric stock (as of cutoff)
  SELECT jsonb_agg(jsonb_build_object(
    'id', q.id,
    'quality_label', q.quality_label,
    'quality_key', q.quality_key,
    'system_meters', round(coalesce(sum(m.meters_delta), 0), 2)
  ) ORDER BY q.quality_label)
  INTO v_fabrics
  FROM public.quality_stock q
  LEFT JOIN public.quality_stock_movements m ON m.org_id = q.org_id AND m.quality_id = q.id AND m.created_at < cutoff
  WHERE q.org_id = o
  GROUP BY q.id;
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
    IF v_audit.id IS NOT NULL THEN
      SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.item_type, l.item_label), '[]'::jsonb)
      INTO v_audit_lines
      FROM public.inventory_audit_lines l
      WHERE l.audit_id = v_audit.id;
    END IF;
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
DROP FUNCTION IF EXISTS public.create_inventory_audit_draft(date, text, text);
DROP FUNCTION IF EXISTS public.record_inventory_audit_count(uuid, text, uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.mutate_delivery_challan(p_id uuid,p_request_id uuid,p_version integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE
  o uuid; d public.delivery_challans%ROWTYPE; e public.delivery_challan_events%ROWTYPE;
  q public.quality_stock%ROWTYPE; line jsonb; total numeric:=0; n numeric; amt numeric; rev uuid; req jsonb; prior_terms jsonb; due_date date; terms text;
  v_lot record; v_unallocated numeric; v_deduct numeric; v_alloc record;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id=auth.uid() AND role::text='owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_org_not_locked(o);
  IF p_id IS NULL OR p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>200000 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(o::text || ':quality-stock',0));
  req:=jsonb_build_object('id',p_id,'version',p_version,'data',p_payload);
  SELECT * INTO e FROM public.delivery_challan_events WHERE org_id=o AND request_id=p_request_id;
  IF FOUND THEN
   IF e.action IS DISTINCT FROM p_action OR e.payload IS DISTINCT FROM req THEN RAISE EXCEPTION 'Request already used for different details' USING ERRCODE='40001'; END IF;
   RETURN jsonb_build_object('id',p_id,'duplicate',true);
  END IF;
  SELECT * INTO d FROM public.delivery_challans WHERE id=p_id AND org_id=o FOR UPDATE;
 IF p_action IN ('save','payment_terms') THEN
  terms:=coalesce(CASE WHEN p_action='save' THEN p_payload->'document'->>'payment_terms' ELSE p_payload->>'payment_terms' END,'');
  IF length(terms)>1000 THEN RAISE EXCEPTION 'Payment terms must be at most 1000 characters' USING ERRCODE='22023'; END IF;
  DECLARE raw_date text:=nullif(CASE WHEN p_action='save' THEN p_payload->'document'->>'payment_due_date' ELSE p_payload->>'payment_due_date' END,''); BEGIN
   IF raw_date IS NOT NULL THEN
    IF raw_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Enter a valid payment due date' USING ERRCODE='22023'; END IF;
    due_date:=raw_date::date;
    IF to_char(due_date,'YYYY-MM-DD')<>raw_date THEN RAISE EXCEPTION 'Enter a valid payment due date' USING ERRCODE='22023'; END IF;
   END IF;
  END;
 END IF;
  IF p_action='save' THEN
   IF d.id IS NOT NULL AND (d.delivery_status<>'draft' OR d.version IS DISTINCT FROM p_version) THEN RAISE EXCEPTION 'Draft changed or has already been issued. Reload.' USING ERRCODE='40001'; END IF;
   IF d.id IS NULL AND p_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Dispatch not found' USING ERRCODE='22023'; END IF;
   SELECT * INTO q FROM public.quality_stock WHERE org_id=o AND id=(p_payload->>'quality_id')::uuid;
   IF q.id IS NULL THEN RAISE EXCEPTION 'Choose a stock quality' USING ERRCODE='22023'; END IF;
   IF jsonb_typeof(p_payload->'document') IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Document and lines required' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(p_payload->'lines') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter 1 to 500 lot lines' USING ERRCODE='22023'; END IF;
   FOR line IN SELECT value FROM jsonb_array_elements(p_payload->'lines') LOOP
    n:=(line->>'meters')::numeric;
    IF coalesce(length(btrim(line->>'lot')),0) NOT BETWEEN 1 AND 80 OR n IS NULL OR n NOT BETWEEN 0.01 AND 100000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Invalid lot or metres' USING ERRCODE='22023'; END IF;
    total:=total+n;
   END LOOP;
   IF (SELECT count(DISTINCT btrim(value->>'lot')) FROM jsonb_array_elements(p_payload->'lines'))<>jsonb_array_length(p_payload->'lines') THEN RAISE EXCEPTION 'Lot identifiers must be unique within this document' USING ERRCODE='22023'; END IF;
   n:=(p_payload->>'selling_rate')::numeric;
   IF n IS NULL OR n NOT BETWEEN 0.01 AND 100000000 OR n<>round(n,2) OR total>100000000 THEN RAISE EXCEPTION 'Enter agreed selling rate and valid metres' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM unnest(ARRAY['sender_name','sender_address','customer_name','customer_address','delivery_address','date']) k WHERE coalesce(length(btrim(p_payload->'document'->>k)),0) NOT BETWEEN 1 AND 1000) THEN RAISE EXCEPTION 'Sender, customer, delivery address and date are required' USING ERRCODE='22023'; END IF;
   PERFORM (p_payload->'document'->>'date')::date;
   IF EXISTS(SELECT 1 FROM jsonb_each(p_payload->'document') WHERE jsonb_typeof(value)<>'string' OR length(value#>>'{}')>1000) THEN RAISE EXCEPTION 'Document fields must be text up to 1000 characters' USING ERRCODE='22023'; END IF;
   INSERT INTO public.delivery_challans(id,org_id,quality_id,quality_label,document,lines,sent_meters,chargeable_meters,selling_rate)
    VALUES(p_id,o,q.id,q.quality_label,p_payload->'document',p_payload->'lines',total,total,n)
    ON CONFLICT(id) DO UPDATE SET quality_id=excluded.quality_id,quality_label=excluded.quality_label,document=excluded.document,lines=excluded.lines,sent_meters=total,chargeable_meters=total,selling_rate=n,version=delivery_challans.version+1,updated_at=clock_timestamp()
    WHERE delivery_challans.org_id=o AND delivery_challans.delivery_status='draft';
   IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch identifier unavailable' USING ERRCODE='22023'; END IF;
   UPDATE public.delivery_challans SET payment_due_date=due_date,payment_terms=terms WHERE id=p_id AND org_id=o;
  ELSE
   IF d.id IS NULL THEN RAISE EXCEPTION 'Dispatch not found' USING ERRCODE='22023'; END IF;
   IF d.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Dispatch changed. Reload before saving.' USING ERRCODE='40001'; END IF;
   IF p_action='confirm' THEN
    IF d.delivery_status<>'draft' THEN RAISE EXCEPTION 'Only drafts can leave stock' USING ERRCODE='22023'; END IF;
    PERFORM private.reconcile_quality_stock(o,NULL,NULL);
    UPDATE public.quality_stock SET meters=meters-d.sent_meters,updated_at=clock_timestamp() WHERE org_id=o AND id=d.quality_id AND meters>=d.sent_meters RETURNING * INTO q;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for this dispatch' USING ERRCODE='22023'; END IF;

    -- FIFO Allocation of fabric against production lots (Rule 21)
    v_unallocated := d.sent_meters;
    FOR v_lot IN
      SELECT * FROM public.production_stock_lots
      WHERE org_id = o AND quality_id = d.quality_id AND remaining_meters > 0
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_unallocated <= 0;
      v_deduct := LEAST(v_lot.remaining_meters, v_unallocated);
      UPDATE public.production_stock_lots
      SET remaining_meters = remaining_meters - v_deduct, updated_at = clock_timestamp()
      WHERE id = v_lot.id;

      INSERT INTO public.delivery_challan_lot_allocations(org_id, challan_id, lot_id, allocated_meters)
      VALUES (o, d.id, v_lot.id, v_deduct);

      v_unallocated := v_unallocated - v_deduct;
    END LOOP;

    INSERT INTO public.quality_stock_movements(org_id,quality_id,kind,meters_delta,balance_after,reason,source_table,source_id,created_by)
     VALUES(o,d.quality_id,'dispatch',-d.sent_meters,q.meters,'Dispatch '||d.number,'delivery_challans',d.id::text,auth.uid());
    UPDATE public.delivery_challans SET delivery_status='sent',issued_at=clock_timestamp() WHERE id=d.id;
  ELSIF p_action='payment_terms' THEN
   IF d.delivery_status NOT IN ('sent','received') THEN RAISE EXCEPTION 'Edit payment terms in the draft, or choose an issued dispatch' USING ERRCODE='22023'; END IF;
   IF coalesce(length(btrim(p_payload->>'reason')),0) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Explain why the agreed payment terms changed' USING ERRCODE='22023'; END IF;
   prior_terms:=jsonb_build_object('payment_due_date',d.payment_due_date,'payment_terms',d.payment_terms);
   UPDATE public.delivery_challans SET payment_due_date=due_date,payment_terms=terms WHERE id=d.id;
   ELSIF p_action='receipt' THEN
    IF d.delivery_status NOT IN ('sent','received') THEN RAISE EXCEPTION 'Confirm dispatch first' USING ERRCODE='22023'; END IF;
    n:=(p_payload->>'meters')::numeric;
    IF n IS NULL OR n NOT BETWEEN 0 AND 100000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Enter valid receipt metres between zero and 100000000' USING ERRCODE='22023'; END IF;
    IF d.delivery_status='received' AND coalesce(length(btrim(p_payload->>'reason')),0)<3 THEN RAISE EXCEPTION 'Explain the receipt correction' USING ERRCODE='22023'; END IF;
    UPDATE public.delivery_challans SET delivery_status='received',acknowledged_meters=n,chargeable_meters=sent_meters,difference_status=CASE WHEN n=sent_meters THEN 'none' ELSE 'review' END WHERE id=d.id;
   ELSIF p_action='resolve' THEN
    IF d.delivery_status<>'received' OR d.acknowledged_meters=d.sent_meters OR p_payload->>'decision' IS NULL OR p_payload->>'decision' NOT IN ('accepted','disputed') OR coalesce(length(btrim(p_payload->>'reason')),0)<3 THEN RAISE EXCEPTION 'Choose a difference decision and reason' USING ERRCODE='22023'; END IF;
    UPDATE public.delivery_challans SET difference_status=p_payload->>'decision',chargeable_meters=CASE WHEN p_payload->>'decision'='accepted' THEN acknowledged_meters ELSE sent_meters END WHERE id=d.id;
   ELSIF p_action IN ('payment','refund','adjustment','reverse_entry') THEN
    IF d.delivery_status NOT IN ('sent','received') THEN RAISE EXCEPTION 'Only issued dispatches accept financial entries' USING ERRCODE='22023'; END IF;
    IF p_action='reverse_entry' THEN
     SELECT * INTO e FROM public.delivery_challan_events WHERE id=(p_payload->>'event_id')::uuid AND org_id=o AND challan_id=d.id AND action IN ('payment','refund','adjustment');
     IF NOT FOUND OR EXISTS(SELECT 1 FROM public.delivery_challan_events WHERE reverses_id=e.id) THEN RAISE EXCEPTION 'Entry missing or already reversed' USING ERRCODE='22023'; END IF;
     IF coalesce(length(btrim(p_payload->>'reason')),0)<3 THEN RAISE EXCEPTION 'Reversal reason required' USING ERRCODE='22023'; END IF;
     rev:=e.id;amt:=-e.amount;
     IF e.action='adjustment' THEN UPDATE public.delivery_challans SET adjustment_amount=adjustment_amount+amt WHERE id=d.id;
     ELSE UPDATE public.delivery_challans SET paid_amount=paid_amount+amt WHERE id=d.id; END IF;
    ELSE
     amt:=(p_payload->>'amount')::numeric;
     IF amt IS NULL OR amt NOT BETWEEN -100000000000 AND 100000000000 OR amt=0 OR amt<>round(amt,2) OR (p_action<>'adjustment' AND amt<0) THEN RAISE EXCEPTION 'Enter a valid amount with up to two decimals' USING ERRCODE='22023'; END IF;
     IF coalesce(length(btrim(p_payload->>'reason')),0)<3 THEN RAISE EXCEPTION 'Enter payment reference or adjustment reason' USING ERRCODE='22023'; END IF;
     IF p_action IN ('payment','refund') THEN
      IF coalesce(length(btrim(p_payload->>'method')),0)=0 OR p_payload->>'date' IS NULL THEN RAISE EXCEPTION 'Payment date and method required' USING ERRCODE='22023'; END IF;
      PERFORM (p_payload->>'date')::date;
     END IF;
     IF p_action='refund' THEN
      IF d.balance>=0 OR amt> -d.balance THEN RAISE EXCEPTION 'Refund cannot exceed the current customer credit' USING ERRCODE='22023'; END IF;
      amt:=-amt;
     END IF;
     IF p_action='adjustment' THEN UPDATE public.delivery_challans SET adjustment_amount=adjustment_amount+amt WHERE id=d.id;
     ELSE UPDATE public.delivery_challans SET paid_amount=paid_amount+amt WHERE id=d.id; END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM public.delivery_challans WHERE id=d.id AND (paid_amount<0 OR chargeable_meters*selling_rate+adjustment_amount<0)) THEN RAISE EXCEPTION 'Correction would create negative paid amount or charges; reverse dependent entries first' USING ERRCODE='22023'; END IF;
   ELSIF p_action='reverse_dispatch' THEN
    IF d.delivery_status<>'sent' OR EXISTS(SELECT 1 FROM public.delivery_challan_events WHERE challan_id=d.id AND action IN ('payment','refund','adjustment')) OR coalesce(length(btrim(p_payload->>'reason')),0)<3 OR p_payload->>'stock_present' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Only unreceived dispatches without financial history can be reversed; verify all sent fabric is physically in stock and give a reason' USING ERRCODE='22023'; END IF;
    
    -- Restore fabric stock
    UPDATE public.quality_stock SET meters=meters+d.sent_meters,updated_at=clock_timestamp() WHERE id=d.quality_id AND org_id=o RETURNING * INTO q;
    
    -- Restore allocated production lots
    FOR v_alloc IN SELECT * FROM public.delivery_challan_lot_allocations WHERE challan_id = d.id LOOP
      UPDATE public.production_stock_lots
      SET remaining_meters = remaining_meters + v_alloc.allocated_meters, updated_at = clock_timestamp()
      WHERE id = v_alloc.lot_id;
    END LOOP;
    DELETE FROM public.delivery_challan_lot_allocations WHERE challan_id = d.id;

    INSERT INTO public.quality_stock_movements(org_id,quality_id,kind,meters_delta,balance_after,reason,source_table,source_id,created_by)
     VALUES(o,d.quality_id,'dispatch_reversal',d.sent_meters,q.meters,left(p_payload->>'reason',500),'delivery_challans',d.id::text,auth.uid());
    UPDATE public.delivery_challans SET delivery_status='reversed',chargeable_meters=0 WHERE id=d.id;
   ELSE RAISE EXCEPTION 'Unknown action' USING ERRCODE='22023';
   END IF;
   UPDATE public.delivery_challans SET version=version+1,updated_at=clock_timestamp() WHERE id=d.id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.delivery_challans WHERE id=p_id AND org_id=o AND (paid_amount<0 OR chargeable_meters*selling_rate+adjustment_amount<0)) THEN
   RAISE EXCEPTION 'Financial invariant violated; reload document' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.delivery_challan_events(org_id,challan_id,request_id,action,payload,amount,reverses_id,created_by,previous_terms)
   VALUES(o,p_id,p_request_id,p_action,req,amt,rev,auth.uid(),prior_terms);
  RETURN jsonb_build_object('id',p_id,'duplicate',false);
END;
$$;
DELETE FROM supabase_migrations.schema_migrations WHERE version IN ('20260926132159', '20260926132310', '20260926132412');
COMMIT;
