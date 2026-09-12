BEGIN;
-- Yarn remains owned until fabric leaves. No production/loom issue deductions,
-- legacy balance imports, or retroactive deductions for already issued challans.
CREATE TABLE public.yarn_stock_settings (
 org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.yarn_stock (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 yarn_name text NOT NULL CHECK(length(btrim(yarn_name)) BETWEEN 1 AND 160),
 yarn_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(yarn_name),'\s+',' ','g'))) STORED,
 weight_kg numeric(24,9) NOT NULL DEFAULT 0 CHECK(weight_kg>=0 AND weight_kg<'Infinity'::numeric),
 opening_recorded boolean NOT NULL DEFAULT false,
 UNIQUE(org_id,id), UNIQUE(org_id,yarn_key)
);
CREATE TABLE public.yarn_stock_recipes (
 org_id uuid NOT NULL, quality_id uuid NOT NULL, costing_id uuid NOT NULL REFERENCES public.estimator_quotes(id),
 recipe jsonb NOT NULL CHECK(jsonb_typeof(recipe)='array' AND jsonb_array_length(recipe)>0),
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(org_id,quality_id), FOREIGN KEY(org_id,quality_id) REFERENCES public.quality_stock(org_id,id)
);
CREATE INDEX yarn_stock_recipes_costing_idx ON public.yarn_stock_recipes(costing_id);
CREATE TABLE public.yarn_stock_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id),
 request_id uuid NOT NULL, action text NOT NULL, payload jsonb NOT NULL, snapshot jsonb,
 created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(org_id,request_id)
);
CREATE INDEX yarn_stock_requests_actor_idx ON public.yarn_stock_requests(created_by);
CREATE TABLE public.yarn_stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL, yarn_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('opening','receipt','correction','dispatch','dispatch_reversal')),
 kg_delta numeric(24,9) NOT NULL CHECK(kg_delta>'-Infinity'::numeric AND kg_delta<'Infinity'::numeric),
 balance_after numeric(24,9) NOT NULL CHECK(balance_after>=0 AND balance_after<'Infinity'::numeric),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 500),
 stock_movement_id uuid REFERENCES public.quality_stock_movements(id),
 challan_id uuid REFERENCES public.delivery_challans(id),
 request_id uuid REFERENCES public.yarn_stock_requests(id),
 recipe_snapshot jsonb, created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(org_id,yarn_id) REFERENCES public.yarn_stock(org_id,id),
 UNIQUE(stock_movement_id,yarn_id)
);
CREATE INDEX yarn_stock_movements_history_idx ON public.yarn_stock_movements(org_id,created_at DESC,id DESC);
CREATE INDEX yarn_stock_movements_yarn_idx ON public.yarn_stock_movements(org_id,yarn_id,created_at DESC,id DESC);
CREATE INDEX yarn_stock_movements_challan_idx ON public.yarn_stock_movements(challan_id,kind);
CREATE INDEX yarn_stock_movements_request_idx ON public.yarn_stock_movements(request_id);
CREATE INDEX yarn_stock_movements_actor_idx ON public.yarn_stock_movements(created_by);

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['yarn_stock_settings','yarn_stock','yarn_stock_recipes','yarn_stock_requests','yarn_stock_movements'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated,service_role',tab);
  EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)))',tab);
 END LOOP;
END $$;

-- Read the canonical costing result, never a separately reimplemented formula.
-- Invalid/legacy snapshots are unavailable until the owner saves a fresh costing.
CREATE FUNCTION private.yarn_costing_recipe(snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE side text; layer jsonb; result jsonb:='[]'; name text; kg numeric;
BEGIN
 FOREACH side IN ARRAY ARRAY['warp','weft'] LOOP
  IF jsonb_typeof(snapshot->'audit'->side->'layers') IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  FOR layer IN SELECT value FROM jsonb_array_elements(snapshot->'audit'->side->'layers') LOOP
   name:=regexp_replace(btrim(layer->>'name'),'\s+',' ','g');
   IF coalesce(length(name),0) NOT BETWEEN 1 AND 160 OR jsonb_typeof(layer->'finalKgPer100m') IS DISTINCT FROM 'number' THEN RETURN NULL; END IF;
   kg:=(layer->>'finalKgPer100m')::numeric;
   IF kg NOT BETWEEN 0.000000001 AND 100000000 THEN RETURN NULL; END IF;
   result:=result||jsonb_build_array(jsonb_build_object('yarn_name',name,'yarn_key',lower(name),'kg_per_100m',kg,'role',side));
  END LOOP;
 END LOOP;
 IF jsonb_array_length(result)=0 THEN RETURN NULL; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.yarn_costing_recipe(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mutate_yarn_stock(p_request_id uuid,p_action text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE o uuid; req public.yarn_stock_requests%ROWTYPE; y public.yarn_stock%ROWTYPE;
 r public.yarn_stock_recipes%ROWTYPE; q public.quality_stock%ROWTYPE; c public.estimator_quotes%ROWTYPE;
 name text; kg numeric; delta numeric; recipe jsonb; reason text; prior jsonb;
BEGIN
 SELECT org_id INTO o FROM public.profiles WHERE id=auth.uid() AND role::text='owner';
 IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE='42501'; END IF;
 PERFORM public.assert_org_not_locked(o);
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>10000 THEN RAISE EXCEPTION 'Invalid yarn stock request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o::text||':quality-stock',0));
 SELECT * INTO req FROM public.yarn_stock_requests WHERE org_id=o AND request_id=p_request_id;
 IF FOUND THEN
  IF req.action IS DISTINCT FROM p_action OR req.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Request already used for different details' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('duplicate',true);
 END IF;
 reason:=btrim(p_payload->>'reason');
 IF coalesce(length(reason),0) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a reason or receipt reference (3 to 500 characters)' USING ERRCODE='22023'; END IF;
 IF p_action='recipe' THEN
  SELECT * INTO q FROM public.quality_stock WHERE org_id=o AND id=(p_payload->>'quality_id')::uuid;
  SELECT * INTO c FROM public.estimator_quotes WHERE org_id=o AND id=(p_payload->>'costing_id')::uuid AND NOT is_archived AND record_kind='costing';
  IF q.id IS NULL OR c.id IS NULL OR lower(regexp_replace(btrim(c.quality_label),'\s+',' ','g')) IS DISTINCT FROM q.quality_key THEN RAISE EXCEPTION 'Choose an active saved costing for this fabric quality' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.yarn_stock_recipes WHERE org_id=o AND quality_id=q.id;
  IF coalesce(r.version,0) IS DISTINCT FROM (p_payload->>'expected_version')::integer THEN RAISE EXCEPTION 'Yarn formula changed. Refresh before linking.' USING ERRCODE='40001'; END IF;
  recipe:=private.yarn_costing_recipe(c.costing_result_snapshot);
  IF recipe IS NULL THEN RAISE EXCEPTION 'Save a fresh costing with named yarns and positive yarn weights first' USING ERRCODE='22023'; END IF;
  prior:=jsonb_build_object('previous',to_jsonb(r),'recipe',recipe,'costing_id',c.id,'calculation_version',c.calculation_version);
  INSERT INTO public.yarn_stock_recipes(org_id,quality_id,costing_id,recipe) VALUES(o,q.id,c.id,recipe)
   ON CONFLICT(org_id,quality_id) DO UPDATE SET costing_id=c.id,recipe=excluded.recipe,version=yarn_stock_recipes.version+1,updated_at=clock_timestamp();
  INSERT INTO public.yarn_stock_requests(org_id,request_id,action,payload,snapshot,created_by) VALUES(o,p_request_id,p_action,p_payload,prior,auth.uid());
 ELSIF p_action IN ('opening','receipt','correction') THEN
  name:=regexp_replace(btrim(p_payload->>'yarn_name'),'\s+',' ','g'); kg:=(p_payload->>'weight_kg')::numeric;
  IF coalesce(length(name),0) NOT BETWEEN 1 AND 160 OR kg IS NULL OR kg NOT BETWEEN 0 AND 100000000 OR kg<>round(kg,3) OR (p_action='receipt' AND kg=0) THEN RAISE EXCEPTION 'Enter a yarn name and valid kg with up to three decimals' USING ERRCODE='22023'; END IF;
  INSERT INTO public.yarn_stock(org_id,yarn_name) VALUES(o,name) ON CONFLICT(org_id,yarn_key) DO NOTHING;
  SELECT * INTO y FROM public.yarn_stock WHERE org_id=o AND yarn_key=lower(name) FOR UPDATE;
  IF p_action='opening' AND y.opening_recorded THEN RAISE EXCEPTION 'Opening weight already recorded. Use a correction.' USING ERRCODE='22023'; END IF;
  IF p_action='correction' AND y.weight_kg IS DISTINCT FROM (p_payload->>'expected_kg')::numeric THEN RAISE EXCEPTION 'Yarn balance changed. Refresh before correcting.' USING ERRCODE='40001'; END IF;
  delta:=CASE WHEN p_action='correction' THEN kg-y.weight_kg ELSE kg END;
  UPDATE public.yarn_stock SET weight_kg=weight_kg+delta,opening_recorded=opening_recorded OR p_action IN ('opening','correction') WHERE id=y.id RETURNING * INTO y;
  INSERT INTO public.yarn_stock_settings(org_id) VALUES(o) ON CONFLICT DO NOTHING;
  INSERT INTO public.yarn_stock_requests(org_id,request_id,action,payload,created_by) VALUES(o,p_request_id,p_action,p_payload,auth.uid()) RETURNING * INTO req;
  INSERT INTO public.yarn_stock_movements(org_id,yarn_id,kind,kg_delta,balance_after,reason,request_id,created_by)
   VALUES(o,y.id,p_action,delta,y.weight_kg,reason,req.id,auth.uid());
 ELSE RAISE EXCEPTION 'Unknown yarn stock action' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.mutate_yarn_stock(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutate_yarn_stock(uuid,text,jsonb) TO authenticated;

-- Runs inside the existing, locked stock/dispatch transaction. Failure rolls
-- back fabric, yarn, document status and events together. Receipt/price/payment
-- changes never produce a stock movement and therefore never consume yarn.
CREATE FUNCTION private.move_dispatch_yarn_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE r public.yarn_stock_recipes%ROWTYPE; item record; y public.yarn_stock%ROWTYPE;
 kg numeric; c uuid; snapshot jsonb;
BEGIN
 IF NEW.kind NOT IN ('dispatch','dispatch_reversal') OR NEW.source_table IS DISTINCT FROM 'delivery_challans' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text||':quality-stock',0));
 c:=NEW.source_id::uuid;
 IF NEW.kind='dispatch' THEN
  IF NOT EXISTS(SELECT 1 FROM public.yarn_stock_settings WHERE org_id=NEW.org_id) THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.yarn_stock_recipes WHERE org_id=NEW.org_id AND quality_id=NEW.quality_id;
  IF r.quality_id IS NULL THEN RAISE EXCEPTION 'Link a saved costing for this quality in Stock > Yarn before dispatching' USING ERRCODE='22023'; END IF;
  snapshot:=jsonb_build_object('costing_id',r.costing_id,'version',r.version,'recipe',r.recipe,'sent_meters',-NEW.meters_delta);
  FOR item IN SELECT value->>'yarn_key' yarn_key,min(value->>'yarn_name') yarn_name,sum((value->>'kg_per_100m')::numeric) kg
   FROM jsonb_array_elements(r.recipe) GROUP BY value->>'yarn_key' ORDER BY value->>'yarn_key' LOOP
   kg:=round((-NEW.meters_delta)*item.kg/100,9);
   SELECT * INTO y FROM public.yarn_stock WHERE org_id=NEW.org_id AND yarn_key=item.yarn_key FOR UPDATE;
   IF y.id IS NULL OR y.weight_kg<kg THEN RAISE EXCEPTION 'Insufficient yarn stock for %. Required % kg. Record opening stock or a receipt in Stock > Yarn.',item.yarn_name,kg USING ERRCODE='22023'; END IF;
   UPDATE public.yarn_stock SET weight_kg=weight_kg-kg WHERE id=y.id RETURNING * INTO y;
   INSERT INTO public.yarn_stock_movements(org_id,yarn_id,kind,kg_delta,balance_after,reason,stock_movement_id,challan_id,recipe_snapshot,created_by)
    VALUES(NEW.org_id,y.id,'dispatch',-kg,y.weight_kg,NEW.reason,NEW.id,c,snapshot,NEW.created_by);
  END LOOP;
 ELSE
  -- Only reverse actual deductions. Pre-tracking dispatches have none.
  FOR item IN SELECT * FROM public.yarn_stock_movements WHERE org_id=NEW.org_id AND challan_id=c AND kind='dispatch' ORDER BY yarn_id LOOP
   UPDATE public.yarn_stock SET weight_kg=weight_kg-item.kg_delta WHERE id=item.yarn_id AND org_id=NEW.org_id RETURNING * INTO y;
   INSERT INTO public.yarn_stock_movements(org_id,yarn_id,kind,kg_delta,balance_after,reason,stock_movement_id,challan_id,recipe_snapshot,created_by)
    VALUES(NEW.org_id,y.id,'dispatch_reversal',-item.kg_delta,y.weight_kg,NEW.reason,NEW.id,c,item.recipe_snapshot,NEW.created_by);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.move_dispatch_yarn_stock() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER dispatch_yarn_stock AFTER INSERT ON public.quality_stock_movements FOR EACH ROW EXECUTE FUNCTION private.move_dispatch_yarn_stock();

CREATE FUNCTION public.get_yarn_stock_board(p_as_of date DEFAULT NULL,p_yarn_id uuid DEFAULT NULL,p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE o uuid; cutoff timestamptz; result jsonb;
BEGIN
 SELECT org_id INTO o FROM public.profiles WHERE id=auth.uid() AND role::text='owner';
 IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE='42501'; END IF;
 IF p_as_of>(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Choose today or an earlier audit date' USING ERRCODE='22023'; END IF;
 cutoff:=CASE WHEN p_as_of IS NULL THEN 'Infinity'::timestamptz ELSE (p_as_of+1)::timestamp AT TIME ZONE 'Asia/Kolkata' END;
 SELECT jsonb_build_object(
  'org_id',o,
  'started_at',(SELECT started_at FROM public.yarn_stock_settings WHERE org_id=o),
  'as_of',p_as_of,
  'yarns',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.yarn_name) FROM (
   SELECT y.id,y.yarn_name,y.yarn_key,y.opening_recorded,coalesce(sum(m.kg_delta),0) weight_kg
   FROM public.yarn_stock y LEFT JOIN public.yarn_stock_movements m ON m.org_id=y.org_id AND m.yarn_id=y.id AND m.created_at<cutoff
   WHERE y.org_id=o GROUP BY y.id) t),'[]'::jsonb),
  'qualities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'quality_label',q.quality_label,'quality_key',q.quality_key,'meters',q.meters,'recipe',r.recipe,'costing_id',r.costing_id,'version',coalesce(r.version,0)) ORDER BY q.quality_label)
   FROM public.quality_stock q LEFT JOIN public.yarn_stock_recipes r ON r.org_id=q.org_id AND r.quality_id=q.id WHERE q.org_id=o),'[]'::jsonb),
  'costings',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'quality_label',c.quality_label,'quality_key',lower(regexp_replace(btrim(c.quality_label),'\s+',' ','g')),'version_number',c.version_number,'saved_at',c.created_at,'recipe',private.yarn_costing_recipe(c.costing_result_snapshot)) ORDER BY c.quality_label,c.version_number DESC,c.created_at DESC)
   FROM public.estimator_quotes c WHERE c.org_id=o AND c.record_kind='costing' AND NOT c.is_archived AND private.yarn_costing_recipe(c.costing_result_snapshot) IS NOT NULL),'[]'::jsonb),
  'movements',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) FROM (
   SELECT m.*,y.yarn_name FROM public.yarn_stock_movements m JOIN public.yarn_stock y ON y.org_id=m.org_id AND y.id=m.yarn_id
   WHERE m.org_id=o AND m.created_at<cutoff AND (p_yarn_id IS NULL OR m.yarn_id=p_yarn_id)
    AND (p_before_at IS NULL OR (m.created_at,m.id)<(p_before_at,p_before_id)) ORDER BY m.created_at DESC,m.id DESC LIMIT 51) t),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_yarn_stock_board(date,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_yarn_stock_board(date,uuid,timestamptz,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
