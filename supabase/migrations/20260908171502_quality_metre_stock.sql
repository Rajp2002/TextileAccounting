-- Fresh metre-only stock. No legacy lots, packages, parties, sales or balances are imported.
-- Apply as one transaction during the coordinated stock cutover (see docs/features/inventory_and_stock.md).
BEGIN;
LOCK TABLE public.base_production_entries, public.base_daily_production_entries,
  public.base_daily_production_allocations, public.base_production_jobs,
  public.production_logs, public.orders IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.quality_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quality_label text NOT NULL CHECK (char_length(btrim(quality_label)) BETWEEN 1 AND 160),
  quality_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(quality_label), '\s+', ' ', 'g'))) STORED,
  meters numeric(16,2) NOT NULL DEFAULT 0 CHECK (meters >= 0 AND meters < 'Infinity'::numeric),
  -- Last observed authoritative production, including pre-cutover baseline. Never a stock balance.
  production_meters numeric(16,2) NOT NULL DEFAULT 0 CHECK (production_meters >= 0 AND production_meters < 'Infinity'::numeric),
  opening_recorded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, quality_key), UNIQUE (org_id, id)
);
CREATE TABLE public.quality_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quality_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('production', 'opening', 'correction')),
  meters_delta numeric(16,2) NOT NULL CHECK (meters_delta > '-Infinity'::numeric AND meters_delta < 'Infinity'::numeric),
  balance_after numeric(16,2) NOT NULL CHECK (balance_after >= 0 AND balance_after < 'Infinity'::numeric),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  source_table text,
  source_id text,
  production_before numeric(16,2),
  production_after numeric(16,2),
  client_request_id uuid,
  request_payload jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (org_id, quality_id) REFERENCES public.quality_stock(org_id, id) ON DELETE CASCADE,
  UNIQUE (org_id, client_request_id)
);
CREATE INDEX quality_stock_movements_history_idx ON public.quality_stock_movements(org_id, created_at DESC, id DESC);
CREATE INDEX quality_stock_movements_quality_history_idx ON public.quality_stock_movements(org_id, quality_id, created_at DESC, id DESC);
CREATE INDEX quality_stock_movements_actor_idx ON public.quality_stock_movements(created_by);
CREATE TABLE public.quality_stock_cutover (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  historical_production_meters numeric(16,2) NOT NULL,
  legacy_lot_count integer NOT NULL,
  unallocated_production_meters numeric(16,2) NOT NULL DEFAULT 0
);

CREATE FUNCTION private.quality_stock_access(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
  SELECT coalesce(private.base_production_core_access(p_org_id),false)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND org_id=p_org_id AND access_revoked_at IS NULL);
$$;
REVOKE ALL ON FUNCTION private.quality_stock_access(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.quality_stock_access(uuid) TO authenticated;

ALTER TABLE public.quality_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_stock_cutover ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quality_stock, public.quality_stock_movements, public.quality_stock_cutover FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.quality_stock, public.quality_stock_movements, public.quality_stock_cutover TO authenticated, service_role;
CREATE POLICY quality_stock_owner_read ON public.quality_stock FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));
CREATE POLICY quality_stock_movements_owner_read ON public.quality_stock_movements FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));
CREATE POLICY quality_stock_cutover_owner_read ON public.quality_stock_cutover FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));

-- Quality names are the existing production identity. Different costing versions/jobs
-- with the same normalized name contribute to one balance. No new customer entity.
CREATE FUNCTION private.quality_production_totals(p_org_id uuid)
RETURNS TABLE(quality_label text, quality_key text, meters numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
  WITH sources AS (
    SELECT j.quality_label, e.meters FROM public.base_production_entries e
      JOIN public.base_production_jobs j ON j.org_id = e.org_id AND j.id = e.job_id WHERE e.org_id = p_org_id
    UNION ALL
    SELECT j.quality_label, a.meters FROM public.base_daily_production_allocations a
      JOIN public.base_production_jobs j ON j.org_id = a.org_id AND j.id = a.job_id WHERE a.org_id = p_org_id
    UNION ALL
    -- Old worker-total rows are separate from machine allocations; never count both.
    SELECT j.quality_label, e.meters FROM public.base_daily_production_entries e
      JOIN public.base_production_jobs j ON j.org_id = e.org_id AND j.id = e.job_id
      WHERE e.org_id = p_org_id AND e.allocation_mode <> 'machine_breakdown' AND e.entry_status = 'entered'
    UNION ALL
    SELECT o.quality_label, l.meters FROM public.production_logs l
      JOIN public.orders o ON o.org_id = l.org_id AND o.id = l.order_id WHERE l.org_id = p_org_id
  ), normalized AS (
    SELECT regexp_replace(btrim(s.quality_label), '\s+', ' ', 'g') AS label, s.meters
    FROM sources s WHERE nullif(btrim(s.quality_label), '') IS NOT NULL AND s.meters > 0
  )
  SELECT min(label), lower(label), round(sum(n.meters),2) FROM normalized n GROUP BY lower(label);
$$;
REVOKE ALL ON FUNCTION private.quality_production_totals(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Baseline current production WITHOUT adding any of it to stock. Owners explicitly
-- record physically remaining pre-cutover metres via opening stock. Later historical
-- corrections apply their net delta, and cannot drive available stock below zero.
INSERT INTO public.quality_stock(org_id, quality_label, production_meters)
SELECT o.id, t.quality_label, t.meters FROM public.organizations o CROSS JOIN LATERAL private.quality_production_totals(o.id) t;
INSERT INTO public.quality_stock_cutover(org_id, historical_production_meters, legacy_lot_count, unallocated_production_meters)
SELECT o.id, coalesce((SELECT sum(s.production_meters) FROM public.quality_stock s WHERE s.org_id = o.id),0),
  (SELECT count(*) FROM public.fabric_stock_lots l WHERE l.org_id = o.id),
  coalesce((SELECT sum(e.meters) FROM public.base_daily_production_entries e WHERE e.org_id=o.id AND e.entry_status='entered' AND e.allocation_mode <> 'machine_breakdown' AND e.job_id IS NULL),0)
  + coalesce((SELECT sum(l.meters) FROM public.production_logs l LEFT JOIN public.orders r ON r.id=l.order_id AND r.org_id=l.org_id WHERE l.org_id=o.id AND nullif(btrim(r.quality_label),'') IS NULL AND l.meters>0),0)
FROM public.organizations o;

CREATE FUNCTION private.reconcile_quality_stock(p_org_id uuid, p_source_table text, p_source_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE r record; v_delta numeric; v_balance numeric;
BEGIN
  -- Serialize all production/adjustment/quality changes in a tenant; future dispatch
  -- confirmation must take this same lock before checking/debiting quality_stock.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':quality-stock', 0));
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id=p_org_id) THEN RETURN; END IF;
  INSERT INTO public.quality_stock_cutover(org_id,historical_production_meters,legacy_lot_count)
    VALUES(p_org_id,0,0) ON CONFLICT DO NOTHING;
  INSERT INTO public.quality_stock(org_id,quality_label)
    SELECT p_org_id,t.quality_label FROM private.quality_production_totals(p_org_id) t
    ON CONFLICT (org_id,quality_key) DO NOTHING;
  FOR r IN
    SELECT s.*, coalesce(t.meters,0) AS current_production FROM public.quality_stock s
    LEFT JOIN private.quality_production_totals(p_org_id) t ON t.quality_key=s.quality_key
    WHERE s.org_id=p_org_id ORDER BY s.quality_key FOR UPDATE OF s
  LOOP
    v_delta := r.current_production-r.production_meters;
    IF v_delta = 0 THEN CONTINUE; END IF;
    v_balance := r.meters+v_delta;
    IF v_balance < 0 THEN
      RAISE EXCEPTION 'Production correction exceeds available stock for %. Record verified opening stock or a stock correction first.',r.quality_label USING ERRCODE='22023';
    END IF;
    UPDATE public.quality_stock SET meters=v_balance,production_meters=r.current_production,updated_at=clock_timestamp() WHERE id=r.id;
    INSERT INTO public.quality_stock_movements(org_id,quality_id,kind,meters_delta,balance_after,reason,source_table,source_id,production_before,production_after,created_by)
    VALUES(p_org_id,r.id,'production',v_delta,v_balance,
      coalesce(nullif(current_setting('app.base_correction_reason',true),''),'Production updated'),
      p_source_table,p_source_id,r.production_meters,r.current_production,auth.uid());
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.reconcile_quality_stock(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.lock_quality_stock_production()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE v_org_id uuid; v_quality text;
BEGIN
  v_org_id := CASE WHEN TG_OP='DELETE' THEN OLD.org_id ELSE NEW.org_id END;
  IF TG_OP='UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Production cannot move between organizations' USING ERRCODE='42501';
  END IF;
  -- Metadata-only privacy/payroll updates do not change stock and must remain
  -- possible on historical unallocated rows.
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME IN ('base_production_jobs','orders') THEN
      IF NEW.quality_label IS NOT DISTINCT FROM OLD.quality_label THEN RETURN NEW; END IF;
    ELSIF TG_TABLE_NAME='base_daily_production_entries' THEN
      IF (NEW.meters,NEW.job_id,NEW.entry_status,NEW.allocation_mode) IS NOT DISTINCT FROM
         (OLD.meters,OLD.job_id,OLD.entry_status,OLD.allocation_mode) THEN RETURN NEW; END IF;
    ELSIF TG_TABLE_NAME='production_logs' THEN
      IF (NEW.meters,NEW.order_id) IS NOT DISTINCT FROM (OLD.meters,OLD.order_id) THEN RETURN NEW; END IF;
    ELSE
      IF (NEW.meters,NEW.job_id) IS NOT DISTINCT FROM (OLD.meters,OLD.job_id) THEN RETURN NEW; END IF;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':quality-stock',0));
  PERFORM set_config('app.stock_dirty_' || replace(v_org_id::text,'-',''), '1', true);
  IF TG_OP <> 'DELETE' THEN
    IF TG_TABLE_NAME='production_logs' THEN
      IF NEW.meters>0 THEN
      SELECT quality_label INTO v_quality FROM public.orders WHERE org_id=NEW.org_id AND id=NEW.order_id;
      IF nullif(btrim(v_quality),'') IS NULL THEN RAISE EXCEPTION 'Choose a fabric quality before recording production' USING ERRCODE='22023'; END IF;
      END IF;
    ELSIF TG_TABLE_NAME='base_daily_production_entries' THEN
      IF NEW.entry_status='entered' AND NEW.allocation_mode <> 'machine_breakdown' AND NEW.job_id IS NULL THEN
        RAISE EXCEPTION 'Allocate produced metres to a quality before saving' USING ERRCODE='22023';
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE FUNCTION private.sync_quality_stock_production()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE v_org uuid := CASE WHEN TG_OP='DELETE' THEN OLD.org_id ELSE NEW.org_id END; v_key text;
BEGIN
  v_key := 'app.stock_dirty_' || replace(v_org::text,'-','');
  IF current_setting(v_key,true)='1' THEN
    PERFORM private.reconcile_quality_stock(v_org,TG_TABLE_NAME::text,CASE WHEN TG_OP='DELETE' THEN OLD.id::text ELSE NEW.id::text END);
    PERFORM set_config(v_key,'0',true);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.lock_quality_stock_production(),private.sync_quality_stock_production() FROM PUBLIC, anon, authenticated, service_role;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['base_production_entries','base_daily_production_entries','base_daily_production_allocations','base_production_jobs','production_logs','orders'] LOOP
    EXECUTE format('CREATE TRIGGER quality_stock_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.lock_quality_stock_production()',t);
    EXECUTE format('CREATE CONSTRAINT TRIGGER quality_stock_sync AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.sync_quality_stock_production()',t);
  END LOOP;
END $$;

CREATE FUNCTION public.record_quality_stock_adjustment(p_quality_label text,p_meters numeric,p_kind text,p_reason text,p_client_request_id uuid,p_expected_meters numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE v_org uuid; v_label text; v_payload jsonb; v_existing public.quality_stock_movements%ROWTYPE; v_stock public.quality_stock%ROWTYPE; v_delta numeric; v_id uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.profiles WHERE id=auth.uid() AND role::text='owner';
  IF v_org IS NULL OR private.quality_stock_access(v_org) IS NOT TRUE THEN RAISE EXCEPTION 'Production access is required' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_org_not_locked(v_org);
  v_label:=regexp_replace(btrim(p_quality_label),'\s+',' ','g');
  IF v_label IS NULL OR char_length(v_label) NOT BETWEEN 1 AND 160 OR p_client_request_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('opening','correction')
    OR p_meters IS NULL OR p_meters NOT BETWEEN 0 AND 100000000 OR p_meters<>round(p_meters,2)
    OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Enter a quality, non-negative metres (up to two decimals), reason and request identifier' USING ERRCODE='22023';
  END IF;
  -- correction is a reviewed physical TOTAL, not an ambiguous add/subtract toggle.
  IF p_kind='correction' AND (p_expected_meters IS NULL OR p_expected_meters NOT BETWEEN 0 AND 100000000000000) THEN
    RAISE EXCEPTION 'Reload the current stock balance before correcting it' USING ERRCODE='40001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':quality-stock',0));
  v_payload:=jsonb_build_object('quality',lower(v_label),'meters',p_meters,'kind',p_kind,'reason',btrim(p_reason),'expected',p_expected_meters);
  SELECT * INTO v_existing FROM public.quality_stock_movements WHERE org_id=v_org AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF v_existing.request_payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'This request already saved a different stock change. Reload stock.' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object('id',v_existing.id,'duplicate',true);
  END IF;
  PERFORM private.reconcile_quality_stock(v_org,NULL,NULL);
  INSERT INTO public.quality_stock(org_id,quality_label) VALUES(v_org,v_label) ON CONFLICT (org_id,quality_key) DO NOTHING;
  SELECT * INTO v_stock FROM public.quality_stock WHERE org_id=v_org AND quality_key=lower(v_label) FOR UPDATE;
  IF p_kind='opening' THEN
    IF v_stock.opening_recorded THEN RAISE EXCEPTION 'Opening stock is already recorded. Use a correction.' USING ERRCODE='22023'; END IF;
    v_delta:=p_meters; -- remaining pre-cutover stock, added to production since cutover
  ELSE
    IF v_stock.meters IS DISTINCT FROM p_expected_meters THEN RAISE EXCEPTION 'Stock changed after you opened it. Reload and review the balance.' USING ERRCODE='40001'; END IF;
    v_delta:=p_meters-v_stock.meters;
  END IF;
  UPDATE public.quality_stock SET meters=meters+v_delta,opening_recorded=true,updated_at=clock_timestamp() WHERE id=v_stock.id;
  INSERT INTO public.quality_stock_movements(org_id,quality_id,kind,meters_delta,balance_after,reason,created_by,client_request_id,request_payload)
    VALUES(v_org,v_stock.id,p_kind,v_delta,v_stock.meters+v_delta,btrim(p_reason),auth.uid(),p_client_request_id,v_payload) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.record_quality_stock_adjustment(text,numeric,text,text,uuid,numeric) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_quality_stock_adjustment(text,numeric,text,text,uuid,numeric) TO authenticated;

-- Retire the old generated-inward implementation without changing production RPC
-- signatures. Existing shift replacement callers receive no inward rows; the new
-- deferred stock trigger handles their committed production automatically.
CREATE OR REPLACE FUNCTION public.reconcile_generated_stock_for_production_grain(p_org_id uuid,p_order_id uuid,p_source_date date,p_source_shift text,p_actor_id uuid)
RETURNS TABLE(draft_id uuid,suggested_meters numeric,status text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$ BEGIN RETURN; END; $$;
REVOKE ALL ON FUNCTION public.reconcile_generated_stock_for_production_grain(uuid,uuid,date,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- No new legacy inventory or sales. Preserve historical rows and the receipt /
-- payment / pending-dispatch functions that operate on previously recorded sales.
CREATE FUNCTION private.reject_retired_stock_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
  RAISE EXCEPTION 'Legacy stock entry is retired. Use quality stock.' USING ERRCODE='42501';
END; $$;
REVOKE ALL ON FUNCTION private.reject_retired_stock_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; f record; BEGIN
  FOREACH t IN ARRAY ARRAY['fabric_stock_lots','fabric_stock_inward_drafts','fabric_stock_sales'] LOOP
    EXECUTE format('CREATE TRIGGER reject_retired_stock_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.reject_retired_stock_write()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fabric_stock_lots','fabric_stock_inward_drafts','fabric_stock_movements','fabric_stock_sales','fabric_packages'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated, anon',t);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('create_or_refresh_stock_inward_draft','confirm_stock_inward_draft','record_fabric_stock_sale','adjust_fabric_stock_lot','create_party_stock_sale_dispatch_v1') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',f.signature);
  END LOOP;
END $$;
CREATE FUNCTION public.get_quality_stock_board(p_quality_id uuid DEFAULT NULL,p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object(
    'qualities',coalesce((SELECT jsonb_agg(s ORDER BY s.quality_label) FROM public.quality_stock s),'[]'::jsonb),
    'total_meters',coalesce((SELECT sum(meters) FROM public.quality_stock),0),
    'cutover',(SELECT to_jsonb(c) FROM public.quality_stock_cutover c LIMIT 1),
    'movements',coalesce((SELECT jsonb_agg(m ORDER BY m.created_at DESC,m.id DESC) FROM (
      SELECT h.id,h.quality_id,s.quality_label,h.kind,h.meters_delta,h.balance_after,h.reason,
        h.source_table,h.source_id,h.production_before,h.production_after,h.created_by,h.created_at
      FROM public.quality_stock_movements h JOIN public.quality_stock s ON s.id=h.quality_id AND s.org_id=h.org_id
      WHERE (p_quality_id IS NULL OR h.quality_id=p_quality_id)
        AND (p_before_at IS NULL OR (h.created_at,h.id)<(p_before_at,p_before_id))
      ORDER BY h.created_at DESC,h.id DESC LIMIT 51
    )m),'[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_quality_stock_board(uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_quality_stock_board(uuid,timestamptz,uuid) TO authenticated;
COMMIT;
