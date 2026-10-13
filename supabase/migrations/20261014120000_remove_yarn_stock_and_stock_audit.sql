-- Delete Yarn Stock and the Stock Audit, data included (owner's decision, 2026-10-14).
--
-- IRREVERSIBLE. Applying this permanently deletes every org's yarn stock (yarn_stock*), the production lots that only
-- existed to estimate yarn inside unsold fabric (production_stock_lots, delivery_challan_lot_allocations), every
-- stock audit (inventory_audits, inventory_audit_lines) and the frozen yarn recipe on production jobs.
-- Apply it BEFORE deploying the app that stops calling these RPCs: until it lands, production entry still fails when
-- a quality's yarn runs short.
--
-- Three shared functions are re-created as their latest definitions minus the yarn and lot parts, with no other
-- behaviour change:
--   private.reconcile_quality_stock            (20260920000000) no yarn deduction or lot creation on production
--   public.activate_saved_costing_for_production (20260920000000) no yarn gate, no recipe sync
--   public.mutate_delivery_challan             (20260926132412) no lot allocation on confirm or reversal
--
-- Kept on purpose: quality_stock_movements rows of kind 'audit_adjustment'. They are part of fabric stock history and
-- of today's fabric balances, so the kind stays valid; nothing can create new ones once the audit RPCs are gone.
BEGIN;

CREATE OR REPLACE FUNCTION private.reconcile_quality_stock(p_org_id uuid, p_source_table text, p_source_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  r record;
  v_delta numeric;
  v_balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':quality-stock', 0));
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN RETURN; END IF;

  INSERT INTO public.quality_stock_cutover(org_id, historical_production_meters, legacy_lot_count)
    VALUES(p_org_id, 0, 0) ON CONFLICT DO NOTHING;

  INSERT INTO public.quality_stock(org_id, quality_label)
    SELECT p_org_id, t.quality_label FROM private.quality_production_totals(p_org_id) t
    ON CONFLICT (org_id, quality_key) DO NOTHING;

  FOR r IN
    SELECT s.*, coalesce(t.meters,0) AS current_production FROM public.quality_stock s
    LEFT JOIN private.quality_production_totals(p_org_id) t ON t.quality_key = s.quality_key
    WHERE s.org_id = p_org_id ORDER BY s.quality_key FOR UPDATE OF s
  LOOP
    v_delta := r.current_production - r.production_meters;
    IF v_delta = 0 THEN CONTINUE; END IF;

    v_balance := r.meters + v_delta;
    IF v_balance < 0 THEN
      RAISE EXCEPTION 'Production correction exceeds available stock for %. Record verified opening stock or a stock correction first.', r.quality_label USING ERRCODE = '22023';
    END IF;

    UPDATE public.quality_stock
    SET meters = v_balance, production_meters = r.current_production, updated_at = clock_timestamp()
    WHERE id = r.id;

    INSERT INTO public.quality_stock_movements(
      org_id, quality_id, kind, meters_delta, balance_after, reason,
      source_table, source_id, production_before, production_after, created_by
    )
    VALUES(
      p_org_id, r.id, CASE WHEN v_delta >= 0 THEN 'production' ELSE 'production_reversal' END,
      v_delta, v_balance,
      coalesce(nullif(current_setting('app.base_correction_reason', true), ''), 'Production updated'),
      p_source_table, p_source_id, r.production_meters, r.current_production, auth.uid()
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.reconcile_quality_stock(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_saved_costing_for_production(p_costing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  v_org_id uuid;
  v_costing record;
  v_existing_job record;
  v_new_job_id uuid;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_costing_id IS NULL THEN
    RAISE EXCEPTION 'A valid costing ID is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':activate-costing:' || p_costing_id::text, 0)
  );

  SELECT quote.id, quote.quality_label, quote.costing_group_id, quote.version_number,
         quote.production_cost_per_meter, quote.landed_cost_per_meter, quote.quote_price_per_meter,
         quote.worker_rate_per_m, quote.order_quantity_m
  INTO v_costing
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id
    AND quote.id = p_costing_id
    AND quote.record_kind = 'costing'
    AND quote.is_archived IS FALSE;

  IF v_costing.id IS NULL THEN
    RAISE EXCEPTION 'Active saved costing not found' USING ERRCODE = '23503';
  END IF;

  -- Idempotency: an active job for this exact costing snapshot is returned as is.
  SELECT job.id, job.status, job.quality_label
  INTO v_existing_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = v_org_id
    AND job.costing_id = p_costing_id
    AND job.status IN ('planned', 'active')
  ORDER BY job.created_at DESC
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'job_id', v_existing_job.id,
      'quality_label', v_existing_job.quality_label,
      'already_active', true
    );
  END IF;

  -- Ensure the quality exists in fabric stock.
  INSERT INTO public.quality_stock (org_id, quality_label)
  VALUES (v_org_id, regexp_replace(btrim(v_costing.quality_label), '\s+', ' ', 'g'))
  ON CONFLICT (org_id, quality_key) DO UPDATE SET updated_at = clock_timestamp();

  INSERT INTO public.base_production_jobs (
    org_id,
    costing_id,
    costing_group_id,
    costing_version,
    quality_label,
    target_meters,
    start_date,
    status,
    worker_rate_per_meter,
    planned_cost_per_meter,
    planned_price_per_meter,
    created_by
  )
  VALUES (
    v_org_id,
    v_costing.id,
    v_costing.costing_group_id,
    v_costing.version_number,
    COALESCE(NULLIF(btrim(v_costing.quality_label), ''), 'Unnamed Quality'),
    10000000,
    (now() AT TIME ZONE 'Asia/Kolkata')::date,
    'active',
    COALESCE(v_costing.worker_rate_per_m, 0),
    COALESCE(v_costing.production_cost_per_meter, v_costing.landed_cost_per_meter, 0),
    COALESCE(v_costing.quote_price_per_meter, 0),
    auth.uid()
  )
  RETURNING id INTO v_new_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_new_job_id,
    'quality_label', v_costing.quality_label,
    'already_active', false
  );
END;
$$;
REVOKE ALL ON FUNCTION public.activate_saved_costing_for_production(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_saved_costing_for_production(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mutate_delivery_challan(p_id uuid,p_request_id uuid,p_version integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid; d public.delivery_challans%ROWTYPE; e public.delivery_challan_events%ROWTYPE;
  q public.quality_stock%ROWTYPE; line jsonb; total numeric:=0; n numeric; amt numeric; rev uuid; req jsonb; prior_terms jsonb; due_date date; terms text;
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
    UPDATE public.quality_stock SET meters=meters+d.sent_meters,updated_at=clock_timestamp() WHERE id=d.quality_id AND org_id=o RETURNING * INTO q;
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
  -- Settled or reversed challans move to History (20260926132412).
  UPDATE public.delivery_challans SET archived_at=CASE WHEN (delivery_status='received' AND difference_status IN ('none','accepted') AND balance=0) OR delivery_status='reversed' THEN coalesce(archived_at,clock_timestamp()) ELSE NULL END WHERE id=p_id AND org_id=o;
  INSERT INTO public.delivery_challan_events(org_id,challan_id,request_id,action,payload,amount,reverses_id,created_by,previous_terms)
   VALUES(o,p_id,p_request_id,p_action,req,amt,rev,auth.uid(),prior_terms);
  RETURN jsonb_build_object('id',p_id,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.mutate_delivery_challan(uuid, uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mutate_delivery_challan(uuid, uuid, integer, text, jsonb) TO authenticated;

-- Yarn Stock and Stock Audit functions. yarn_costing_recipe goes last: it was only called by the functions above it.
DROP FUNCTION IF EXISTS public.mutate_yarn_stock(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.get_yarn_stock_board(date, uuid, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.validate_quality_activation_yarn(uuid);
DROP FUNCTION IF EXISTS private.move_dispatch_yarn_stock();
DROP FUNCTION IF EXISTS public.get_inventory_audit_data(date, uuid);
DROP FUNCTION IF EXISTS public.create_inventory_audit_draft(date, text, text);
DROP FUNCTION IF EXISTS public.record_inventory_audit_count(uuid, text, uuid, numeric, text);
DROP FUNCTION IF EXISTS public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.finalize_inventory_audit(uuid);
DROP FUNCTION IF EXISTS private.yarn_costing_recipe(jsonb);

-- Tables, children before parents. No CASCADE: a dependency this migration missed must fail, not vanish silently.
DROP TABLE IF EXISTS public.inventory_audit_lines;
DROP TABLE IF EXISTS public.inventory_audits;
DROP TABLE IF EXISTS public.delivery_challan_lot_allocations;
DROP TABLE IF EXISTS public.production_stock_lots;
DROP TABLE IF EXISTS public.yarn_stock_movements;
DROP TABLE IF EXISTS public.yarn_stock_requests;
DROP TABLE IF EXISTS public.yarn_stock_recipes;
DROP TABLE IF EXISTS public.yarn_stock;
DROP TABLE IF EXISTS public.yarn_stock_settings;

ALTER TABLE public.base_production_jobs DROP COLUMN IF EXISTS yarn_recipe_snapshot;

NOTIFY pgrst, 'reload schema';
COMMIT;
