BEGIN;
-- Independent transactions; legacy commercial records stay in their original tables.
ALTER TABLE public.quality_stock_movements DROP CONSTRAINT quality_stock_movements_kind_check;
ALTER TABLE public.quality_stock_movements ADD CONSTRAINT quality_stock_movements_kind_check CHECK (kind IN ('production','opening','correction','dispatch','dispatch_reversal'));
CREATE SEQUENCE private.challan_number_seq MAXVALUE 999999999999;
CREATE TABLE public.delivery_challans (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES public.organizations(id),
 number text NOT NULL DEFAULT ('DC' || lpad(nextval('private.challan_number_seq')::text,12,'0')) UNIQUE,
 quality_id uuid NOT NULL, quality_label text NOT NULL,
 document jsonb NOT NULL, lines jsonb NOT NULL,
 sent_meters numeric(16,2) NOT NULL CHECK(sent_meters>0 AND sent_meters<100000001),
 selling_rate numeric(16,2) NOT NULL CHECK(selling_rate>0 AND selling_rate<100000001),
 chargeable_meters numeric(16,2) NOT NULL,
 acknowledged_meters numeric(16,2),
 delivery_status text NOT NULL DEFAULT 'draft' CHECK(delivery_status IN ('draft','sent','received','reversed')),
 difference_status text NOT NULL DEFAULT 'none' CHECK(difference_status IN ('none','review','accepted','disputed')),
 adjustment_amount numeric(20,2) NOT NULL DEFAULT 0,
 paid_amount numeric(20,2) NOT NULL DEFAULT 0,
 balance numeric(20,2) GENERATED ALWAYS AS (round(chargeable_meters*selling_rate,2)+adjustment_amount-paid_amount) STORED,
 archived_at timestamptz, issued_at timestamptz, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(org_id,id), FOREIGN KEY(org_id,quality_id) REFERENCES public.quality_stock(org_id,id)
);
CREATE TABLE public.delivery_challan_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL,challan_id uuid NOT NULL,
 request_id uuid NOT NULL, action text NOT NULL,payload jsonb NOT NULL,
 amount numeric(20,2), reverses_id uuid REFERENCES public.delivery_challan_events(id),
 created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(org_id,request_id), UNIQUE(reverses_id),
 FOREIGN KEY(org_id,challan_id) REFERENCES public.delivery_challans(org_id,id)
);
CREATE INDEX delivery_challans_board_idx ON public.delivery_challans(org_id,created_at DESC,id DESC);
CREATE INDEX delivery_challan_events_history_idx ON public.delivery_challan_events(org_id,challan_id,created_at,id);
CREATE INDEX delivery_challan_events_actor_idx ON public.delivery_challan_events(created_by);
CREATE INDEX delivery_challans_quality_idx ON public.delivery_challans(org_id,quality_id);
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challan_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_challans,public.delivery_challan_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.delivery_challans,public.delivery_challan_events TO authenticated,service_role;
CREATE POLICY challan_owner_read ON public.delivery_challans FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));
CREATE POLICY challan_event_owner_read ON public.delivery_challan_events FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));

-- One mutation entry point: authenticate, share stock lock, check retry, lock document,
-- validate expected revision, apply transition, append immutable audit event.
CREATE FUNCTION public.mutate_delivery_challan(p_id uuid,p_request_id uuid,p_version integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE o uuid; d public.delivery_challans%ROWTYPE; e public.delivery_challan_events%ROWTYPE;
 q public.quality_stock%ROWTYPE; line jsonb; total numeric:=0; n numeric; amt numeric; rev uuid; req jsonb;
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
  RAISE EXCEPTION 'Settlement would create negative charges; review existing adjustments first' USING ERRCODE='22023';
 END IF;
 UPDATE public.delivery_challans SET archived_at=CASE WHEN (delivery_status='received' AND difference_status IN ('none','accepted') AND balance=0) OR delivery_status='reversed' THEN coalesce(archived_at,clock_timestamp()) ELSE NULL END WHERE id=p_id AND org_id=o;
 INSERT INTO public.delivery_challan_events(org_id,challan_id,request_id,action,payload,amount,reverses_id,created_by) VALUES(o,p_id,p_request_id,p_action,req,amt,rev,auth.uid());
 RETURN jsonb_build_object('id',p_id,'duplicate',false);
END; $$;
REVOKE ALL ON FUNCTION public.mutate_delivery_challan(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutate_delivery_challan(uuid,uuid,integer,text,jsonb) TO authenticated;
COMMIT;
