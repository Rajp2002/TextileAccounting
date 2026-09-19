-- Unified Inventory Architecture: Saved Costing -> Quality Activation -> Production -> Yarn Stock -> Fabric Stock -> Dispatch -> Inventory Audit
-- Strictly separates:
-- 1. Operational loose yarn (yarn physically remaining in yarn_stock)
-- 2. Audit position: Total Yarn Represented = Loose Yarn + Yarn Embodied in Unsold Fabric Stock

BEGIN;

-- 1. Ensure kinds on quality_stock_movements and yarn_stock_movements support production consumption and audit adjustments
ALTER TABLE public.quality_stock_movements DROP CONSTRAINT IF EXISTS quality_stock_movements_kind_check;
ALTER TABLE public.quality_stock_movements ADD CONSTRAINT quality_stock_movements_kind_check 
  CHECK (kind IN ('production','opening','correction','dispatch','dispatch_reversal','audit_adjustment','production_reversal'));

ALTER TABLE public.yarn_stock_movements DROP CONSTRAINT IF EXISTS yarn_stock_movements_kind_check;
ALTER TABLE public.yarn_stock_movements ADD CONSTRAINT yarn_stock_movements_kind_check 
  CHECK (kind IN ('opening','receipt','correction','production_consumption','production_reversal','dispatch','dispatch_reversal','audit_adjustment'));

-- 2. Add recipe snapshot to base_production_jobs to freeze recipe at activation/production time
ALTER TABLE public.base_production_jobs 
  ADD COLUMN IF NOT EXISTS yarn_recipe_snapshot jsonb;

-- 3. Production Stock Lots: Preserves lineage between fabric in stock and the production event + yarn recipe snapshot
CREATE TABLE IF NOT EXISTS public.production_stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quality_id uuid NOT NULL REFERENCES public.quality_stock(id) ON DELETE CASCADE,
  quality_label text NOT NULL,
  job_id uuid REFERENCES public.base_production_jobs(id) ON DELETE SET NULL,
  costing_id uuid REFERENCES public.estimator_quotes(id) ON DELETE SET NULL,
  costing_version integer NOT NULL DEFAULT 1,
  produced_meters numeric(16,2) NOT NULL CHECK (produced_meters > 0),
  remaining_meters numeric(16,2) NOT NULL CHECK (remaining_meters >= 0 AND remaining_meters <= produced_meters),
  recipe_snapshot jsonb NOT NULL CHECK (jsonb_typeof(recipe_snapshot) = 'array'),
  yarn_consumption_snapshot jsonb NOT NULL CHECK (jsonb_typeof(yarn_consumption_snapshot) = 'array'),
  production_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (org_id, id)
);

CREATE INDEX IF NOT EXISTS production_stock_lots_org_quality_fifo_idx 
  ON public.production_stock_lots(org_id, quality_id, created_at ASC);
CREATE INDEX IF NOT EXISTS production_stock_lots_remaining_idx 
  ON public.production_stock_lots(org_id, remaining_meters);

-- 4. Delivery Challan Lot Allocations: Tracks FIFO allocation of fabric dispatches against production lots
CREATE TABLE IF NOT EXISTS public.delivery_challan_lot_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  challan_id uuid NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.production_stock_lots(id) ON DELETE CASCADE,
  allocated_meters numeric(16,2) NOT NULL CHECK (allocated_meters > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (challan_id, lot_id)
);

CREATE INDEX IF NOT EXISTS delivery_challan_lot_allocations_lot_idx 
  ON public.delivery_challan_lot_allocations(lot_id);

-- 5. Inventory Audits: Draft/Finalized stock audit records
CREATE TABLE IF NOT EXISTS public.inventory_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  audit_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  title text NOT NULL DEFAULT 'Stock Audit',
  notes text,
  snapshot jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (org_id, id)
);

CREATE INDEX IF NOT EXISTS inventory_audits_org_date_idx 
  ON public.inventory_audits(org_id, audit_date DESC, created_at DESC);

-- 6. Inventory Audit Lines: Physical counts and variances
CREATE TABLE IF NOT EXISTS public.inventory_audit_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.inventory_audits(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('fabric', 'yarn')),
  item_id uuid NOT NULL,
  item_label text NOT NULL,
  system_quantity numeric(24,9) NOT NULL,
  physical_count numeric(24,9),
  variance numeric(24,9) GENERATED ALWAYS AS (coalesce(physical_count, system_quantity) - system_quantity) STORED,
  adjustment_applied boolean NOT NULL DEFAULT false,
  adjustment_movement_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (audit_id, item_type, item_id)
);

-- RLS
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['production_stock_lots','delivery_challan_lot_allocations','inventory_audits','inventory_audit_lines'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role', tab);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated,service_role', tab);
    EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)))', tab);
  END LOOP;
END $$;

-- 7. DROP the previous dispatch yarn deduction trigger.
-- Per Rule 5: Dispatch decreases Fabric Stock only; Yarn Stock does NOT change because yarn was already consumed during production.
DROP TRIGGER IF EXISTS dispatch_yarn_stock ON public.quality_stock_movements;

-- 8. Validation RPC: Inspects quality yarn recipe and validates availability in yarn_stock
CREATE OR REPLACE FUNCTION public.validate_quality_activation_yarn(p_costing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  v_org_id uuid;
  v_costing record;
  v_recipe jsonb;
  v_yarn record;
  v_stock record;
  v_items jsonb := '[]'::jsonb;
  v_can_activate boolean := true;
  v_item jsonb;
  v_status text;
  v_stock_kg numeric;
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.quality_stock_access(v_org_id) THEN
    RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501';
  END IF;

  SELECT quote.id, quote.quality_label, quote.costing_result_snapshot, quote.version_number
  INTO v_costing
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id AND quote.id = p_costing_id AND quote.record_kind = 'costing' AND NOT quote.is_archived;

  IF v_costing.id IS NULL THEN
    RAISE EXCEPTION 'Saved costing not found' USING ERRCODE = '23503';
  END IF;

  v_recipe := private.yarn_costing_recipe(v_costing.costing_result_snapshot);
  IF v_recipe IS NULL OR jsonb_array_length(v_recipe) = 0 THEN
    RETURN jsonb_build_object(
      'can_activate', false,
      'error', 'Yarn requirements for this quality are incomplete. Save a fresh costing with named yarns and positive weights.',
      'costing_id', p_costing_id,
      'quality_label', v_costing.quality_label,
      'yarns', '[]'::jsonb
    );
  END IF;

  FOR v_yarn IN SELECT value->>'yarn_name' AS yarn_name, value->>'yarn_key' AS yarn_key,
                       min(value->>'role') AS role,
                       sum((value->>'kg_per_100m')::numeric) AS kg_per_100m
                FROM jsonb_array_elements(v_recipe)
                GROUP BY value->>'yarn_name', value->>'yarn_key'
                ORDER BY value->>'yarn_name'
  LOOP
    SELECT y.id, y.yarn_name, y.weight_kg INTO v_stock
    FROM public.yarn_stock y
    WHERE y.org_id = v_org_id AND y.yarn_key = v_yarn.yarn_key;

    IF v_stock.id IS NULL THEN
      v_status := 'missing';
      v_stock_kg := 0;
      v_can_activate := false;
    ELSIF v_stock.weight_kg <= 0 THEN
      v_status := 'zero_stock';
      v_stock_kg := v_stock.weight_kg;
      v_can_activate := false;
    ELSE
      v_status := 'available';
      v_stock_kg := v_stock.weight_kg;
    END IF;

    v_item := jsonb_build_object(
      'yarn_id', v_stock.id,
      'yarn_name', v_yarn.yarn_name,
      'yarn_key', v_yarn.yarn_key,
      'role', v_yarn.role,
      'kg_per_100m', v_yarn.kg_per_100m,
      'current_stock_kg', v_stock_kg,
      'status', v_status
    );
    v_items := v_items || jsonb_build_array(v_item);
  END LOOP;

  RETURN jsonb_build_object(
    'can_activate', v_can_activate,
    'costing_id', p_costing_id,
    'quality_label', v_costing.quality_label,
    'costing_version', v_costing.version_number,
    'yarns', v_items
  );
END;
$$;
REVOKE ALL ON FUNCTION public.validate_quality_activation_yarn(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_quality_activation_yarn(uuid) TO authenticated;

-- 9. Update activate_saved_costing_for_production to validate yarn and freeze recipe
CREATE OR REPLACE FUNCTION public.activate_saved_costing_for_production(
  p_costing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_costing record;
  v_existing_job record;
  v_new_job_id uuid;
  v_validation jsonb;
  v_recipe jsonb;
  v_quality_id uuid;
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
         quote.worker_rate_per_m, quote.order_quantity_m, quote.costing_result_snapshot
  INTO v_costing
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id
    AND quote.id = p_costing_id
    AND quote.record_kind = 'costing'
    AND quote.is_archived IS FALSE;

  IF v_costing.id IS NULL THEN
    RAISE EXCEPTION 'Active saved costing not found' USING ERRCODE = '23503';
  END IF;

  -- Rule 1: A quality cannot be activated unless all required yarns exist in Yarn Stock with positive balance
  v_validation := public.validate_quality_activation_yarn(p_costing_id);
  IF COALESCE((v_validation ->> 'can_activate')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked', true,
      'reason', 'yarn_required',
      'validation', v_validation
    );
  END IF;

  v_recipe := private.yarn_costing_recipe(v_costing.costing_result_snapshot);

  -- Idempotency check: verify if an active job already exists for this exact costing snapshot
  SELECT job.id, job.status, job.quality_label
  INTO v_existing_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = v_org_id
    AND job.costing_id = p_costing_id
    AND job.status IN ('planned', 'active')
  ORDER BY job.created_at DESC
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    -- Ensure recipe snapshot is populated
    UPDATE public.base_production_jobs
    SET yarn_recipe_snapshot = v_recipe
    WHERE id = v_existing_job.id AND yarn_recipe_snapshot IS NULL;

    RETURN jsonb_build_object(
      'success', true,
      'job_id', v_existing_job.id,
      'quality_label', v_existing_job.quality_label,
      'already_active', true
    );
  END IF;

  -- Ensure quality exists in quality_stock
  INSERT INTO public.quality_stock (org_id, quality_label)
  VALUES (v_org_id, regexp_replace(btrim(v_costing.quality_label), '\s+', ' ', 'g'))
  ON CONFLICT (org_id, quality_key) DO UPDATE SET updated_at = clock_timestamp()
  RETURNING id INTO v_quality_id;

  -- Synchronize recipe to yarn_stock_recipes for this quality
  INSERT INTO public.yarn_stock_recipes (org_id, quality_id, costing_id, recipe)
  VALUES (v_org_id, v_quality_id, v_costing.id, v_recipe)
  ON CONFLICT (org_id, quality_id) DO UPDATE
  SET costing_id = v_costing.id, recipe = excluded.recipe, version = yarn_stock_recipes.version + 1, updated_at = clock_timestamp();

  -- Create internal production activation record with frozen yarn recipe snapshot (Rule 10)
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
    yarn_recipe_snapshot,
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
    v_recipe,
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
$function$;

-- 10. Update private.reconcile_quality_stock to atomically deduct loose yarn and create production lots (Rules 3, 4, 11, 13, 14, 17)
CREATE OR REPLACE FUNCTION private.reconcile_quality_stock(p_org_id uuid, p_source_table text, p_source_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  r record;
  v_delta numeric;
  v_balance numeric;
  v_recipe record;
  v_item record;
  v_yarn record;
  v_kg_needed numeric;
  v_lot_consumption jsonb;
  v_lot_id uuid;
  v_latest_lot record;
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

    -- Look up recipe for yarn conversion
    SELECT ysr.costing_id, ysr.version, ysr.recipe
    INTO v_recipe
    FROM public.yarn_stock_recipes ysr
    WHERE ysr.org_id = p_org_id AND ysr.quality_id = r.id;

    -- If recipe not in yarn_stock_recipes, try active job for this quality
    IF v_recipe.recipe IS NULL THEN
      SELECT job.costing_id, job.costing_version AS version, job.yarn_recipe_snapshot AS recipe
      INTO v_recipe
      FROM public.base_production_jobs job
      WHERE job.org_id = p_org_id
        AND lower(regexp_replace(btrim(job.quality_label), '\s+', ' ', 'g')) = r.quality_key
        AND job.status IN ('planned', 'active')
        AND job.yarn_recipe_snapshot IS NOT NULL
      ORDER BY job.created_at DESC LIMIT 1;
    END IF;

    -- If production is positive and recipe exists, atomically validate & deduct yarn, and create production lot
    IF v_delta > 0 AND v_recipe.recipe IS NOT NULL AND jsonb_array_length(v_recipe.recipe) > 0 THEN
      v_lot_consumption := '[]'::jsonb;

      -- Step 1: Check sufficiency for all component yarns before committing any deduction (Rule 14)
      FOR v_item IN
        SELECT value->>'yarn_key' AS yarn_key,
               min(value->>'yarn_name') AS yarn_name,
               sum((value->>'kg_per_100m')::numeric) AS kg_per_100m
        FROM jsonb_array_elements(v_recipe.recipe)
        GROUP BY value->>'yarn_key'
      LOOP
        v_kg_needed := round(v_delta * v_item.kg_per_100m / 100, 9);
        SELECT * INTO v_yarn
        FROM public.yarn_stock
        WHERE org_id = p_org_id AND yarn_key = v_item.yarn_key
        FOR UPDATE;

        IF v_yarn.id IS NULL OR v_yarn.weight_kg < v_kg_needed THEN
          RAISE EXCEPTION 'Insufficient yarn stock for %: % kg required for %m production, but only % kg available.',
            v_item.yarn_name, v_kg_needed, v_delta, COALESCE(v_yarn.weight_kg, 0)
            USING ERRCODE = '22023';
        END IF;
      END LOOP;

      -- Step 2: Deduct yarn and record ledger entries
      FOR v_item IN
        SELECT value->>'yarn_key' AS yarn_key,
               min(value->>'yarn_name') AS yarn_name,
               sum((value->>'kg_per_100m')::numeric) AS kg_per_100m
        FROM jsonb_array_elements(v_recipe.recipe)
        GROUP BY value->>'yarn_key'
      LOOP
        v_kg_needed := round(v_delta * v_item.kg_per_100m / 100, 9);
        SELECT * INTO v_yarn
        FROM public.yarn_stock
        WHERE org_id = p_org_id AND yarn_key = v_item.yarn_key
        FOR UPDATE;

        UPDATE public.yarn_stock
        SET weight_kg = weight_kg - v_kg_needed
        WHERE id = v_yarn.id
        RETURNING * INTO v_yarn;

        INSERT INTO public.yarn_stock_movements(
          org_id, yarn_id, kind, kg_delta, balance_after, reason,
          recipe_snapshot, created_by
        )
        VALUES(
          p_org_id, v_yarn.id, 'production_consumption', -v_kg_needed, v_yarn.weight_kg,
          'Production: ' || round(v_delta, 2) || 'm of ' || r.quality_label,
          jsonb_build_object('costing_id', v_recipe.costing_id, 'version', v_recipe.version, 'kg_per_100m', v_item.kg_per_100m, 'meters', v_delta),
          auth.uid()
        );

        v_lot_consumption := v_lot_consumption || jsonb_build_array(jsonb_build_object(
          'yarn_id', v_yarn.id,
          'yarn_name', v_item.yarn_name,
          'yarn_key', v_item.yarn_key,
          'consumed_kg', v_kg_needed,
          'kg_per_100m', v_item.kg_per_100m
        ));
      END LOOP;

      -- Step 3: Create production stock lot (Rule 17)
      INSERT INTO public.production_stock_lots (
        org_id, quality_id, quality_label, costing_id, costing_version,
        produced_meters, remaining_meters, recipe_snapshot, yarn_consumption_snapshot
      )
      VALUES (
        p_org_id, r.id, r.quality_label, v_recipe.costing_id, coalesce(v_recipe.version, 1),
        v_delta, v_delta, v_recipe.recipe, v_lot_consumption
      )
      RETURNING id INTO v_lot_id;

    ELSIF v_delta < 0 AND v_recipe.recipe IS NOT NULL AND jsonb_array_length(v_recipe.recipe) > 0 THEN
      -- Negative delta = downward correction / reversal (Rule 39)
      FOR v_item IN
        SELECT value->>'yarn_key' AS yarn_key,
               min(value->>'yarn_name') AS yarn_name,
               sum((value->>'kg_per_100m')::numeric) AS kg_per_100m
        FROM jsonb_array_elements(v_recipe.recipe)
        GROUP BY value->>'yarn_key'
      LOOP
        v_kg_needed := round((-v_delta) * v_item.kg_per_100m / 100, 9);
        SELECT * INTO v_yarn
        FROM public.yarn_stock
        WHERE org_id = p_org_id AND yarn_key = v_item.yarn_key
        FOR UPDATE;

        IF v_yarn.id IS NOT NULL THEN
          UPDATE public.yarn_stock
          SET weight_kg = weight_kg + v_kg_needed
          WHERE id = v_yarn.id
          RETURNING * INTO v_yarn;

          INSERT INTO public.yarn_stock_movements(
            org_id, yarn_id, kind, kg_delta, balance_after, reason,
            recipe_snapshot, created_by
          )
          VALUES(
            p_org_id, v_yarn.id, 'production_reversal', v_kg_needed, v_yarn.weight_kg,
            'Production reversal: ' || round(-v_delta, 2) || 'm of ' || r.quality_label,
            jsonb_build_object('costing_id', v_recipe.costing_id, 'version', v_recipe.version, 'kg_per_100m', v_item.kg_per_100m, 'meters', -v_delta),
            auth.uid()
          );
        END IF;
      END LOOP;

      -- Decrement remaining meters from latest lot
      SELECT * INTO v_latest_lot
      FROM public.production_stock_lots
      WHERE org_id = p_org_id AND quality_id = r.id AND remaining_meters > 0
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

      IF v_latest_lot.id IS NOT NULL THEN
        UPDATE public.production_stock_lots
        SET remaining_meters = GREATEST(0, remaining_meters + v_delta),
            updated_at = clock_timestamp()
        WHERE id = v_latest_lot.id;
      END IF;
    END IF;

    -- Update fabric stock balance
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

-- 11. Update mutate_delivery_challan to allocate dispatches against production lots via FIFO (Rules 5, 20, 21)
-- Dispatch decreases Fabric Stock only; Yarn Stock does not change.
CREATE OR REPLACE FUNCTION public.mutate_delivery_challan(p_id uuid,p_request_id uuid,p_version integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE
  o uuid; d public.delivery_challans%ROWTYPE; e public.delivery_challan_events%ROWTYPE;
  q public.quality_stock%ROWTYPE; line jsonb; total numeric:=0; n numeric; amt numeric; rev uuid; req jsonb;
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
  INSERT INTO public.delivery_challan_events(org_id,challan_id,request_id,action,payload,amount,reverses_id,created_by)
   VALUES(o,p_id,p_request_id,p_action,req,amt,rev,auth.uid());
  RETURN jsonb_build_object('id',p_id,'duplicate',false);
END;
$$;

-- 12. RPC get_inventory_audit_data: Reconstructs loose yarn, fabric, and embodied yarn (Rules 6, 22, 27-34)
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

-- 13. RPC apply_inventory_audit_adjustment: Records physical count reconciliation and AUDIT_ADJUSTMENT ledger entry (Rules 35, 36)
CREATE OR REPLACE FUNCTION public.apply_inventory_audit_adjustment(
  p_audit_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_physical_count numeric,
  p_reason text DEFAULT 'Physical stock reconciliation'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid;
  v_audit public.inventory_audits%ROWTYPE;
  v_yarn public.yarn_stock%ROWTYPE;
  v_fabric public.quality_stock%ROWTYPE;
  v_variance numeric;
  v_movement_id uuid;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Physical stock reconciliation');
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_org_not_locked(o);

  SELECT * INTO v_audit FROM public.inventory_audits WHERE id = p_audit_id AND org_id = o FOR UPDATE;
  IF v_audit.id IS NULL THEN RAISE EXCEPTION 'Inventory audit not found' USING ERRCODE = '23503'; END IF;
  IF v_audit.status = 'finalized' THEN RAISE EXCEPTION 'Finalized audit cannot be adjusted' USING ERRCODE = '22023'; END IF;

  IF p_item_type = 'yarn' THEN
    SELECT * INTO v_yarn FROM public.yarn_stock WHERE id = p_item_id AND org_id = o FOR UPDATE;
    IF v_yarn.id IS NULL THEN RAISE EXCEPTION 'Yarn not found' USING ERRCODE = '23503'; END IF;

    v_variance := p_physical_count - v_yarn.weight_kg;
    IF v_variance = 0 THEN
      RETURN jsonb_build_object('success', true, 'adjusted', false, 'message', 'Physical count equals system count');
    END IF;

    UPDATE public.yarn_stock
    SET weight_kg = p_physical_count
    WHERE id = v_yarn.id;

    INSERT INTO public.yarn_stock_movements(
      org_id, yarn_id, kind, kg_delta, balance_after, reason, created_by
    )
    VALUES(
      o, v_yarn.id, 'audit_adjustment', v_variance, p_physical_count,
      v_reason || ' (Audit: ' || v_audit.title || ')', auth.uid()
    )
    RETURNING id INTO v_movement_id;

    INSERT INTO public.inventory_audit_lines(
      audit_id, org_id, item_type, item_id, item_label,
      system_quantity, physical_count, adjustment_applied, adjustment_movement_id, notes
    )
    VALUES(
      v_audit.id, o, 'yarn', v_yarn.id, v_yarn.yarn_name,
      v_yarn.weight_kg, p_physical_count, true, v_movement_id, v_reason
    )
    ON CONFLICT (audit_id, item_type, item_id) DO UPDATE SET
      physical_count = excluded.physical_count,
      adjustment_applied = true,
      adjustment_movement_id = v_movement_id,
      notes = excluded.notes,
      updated_at = clock_timestamp();

  ELSIF p_item_type = 'fabric' THEN
    SELECT * INTO v_fabric FROM public.quality_stock WHERE id = p_item_id AND org_id = o FOR UPDATE;
    IF v_fabric.id IS NULL THEN RAISE EXCEPTION 'Fabric quality not found' USING ERRCODE = '23503'; END IF;

    v_variance := p_physical_count - v_fabric.meters;
    IF v_variance = 0 THEN
      RETURN jsonb_build_object('success', true, 'adjusted', false, 'message', 'Physical count equals system count');
    END IF;

    UPDATE public.quality_stock
    SET meters = p_physical_count, updated_at = clock_timestamp()
    WHERE id = v_fabric.id;

    INSERT INTO public.quality_stock_movements(
      org_id, quality_id, kind, meters_delta, balance_after, reason, source_table, source_id, created_by
    )
    VALUES(
      o, v_fabric.id, 'audit_adjustment', v_variance, p_physical_count,
      v_reason || ' (Audit: ' || v_audit.title || ')', 'inventory_audits', v_audit.id::text, auth.uid()
    )
    RETURNING id INTO v_movement_id;

    INSERT INTO public.inventory_audit_lines(
      audit_id, org_id, item_type, item_id, item_label,
      system_quantity, physical_count, adjustment_applied, adjustment_movement_id, notes
    )
    VALUES(
      v_audit.id, o, 'fabric', v_fabric.id, v_fabric.quality_label,
      v_fabric.meters, p_physical_count, true, v_movement_id, v_reason
    )
    ON CONFLICT (audit_id, item_type, item_id) DO UPDATE SET
      physical_count = excluded.physical_count,
      adjustment_applied = true,
      adjustment_movement_id = v_movement_id,
      notes = excluded.notes,
      updated_at = clock_timestamp();

  ELSE
    RAISE EXCEPTION 'Unknown item type %', p_item_type USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('success', true, 'adjusted', true, 'variance', v_variance, 'movement_id', v_movement_id);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text) TO authenticated;

-- 14. RPC finalize_inventory_audit: Locks the audit into an immutable snapshot (Rules 37, 38)
CREATE OR REPLACE FUNCTION public.finalize_inventory_audit(p_audit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid;
  v_audit public.inventory_audits%ROWTYPE;
  v_data jsonb;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_org_not_locked(o);

  SELECT * INTO v_audit FROM public.inventory_audits WHERE id = p_audit_id AND org_id = o FOR UPDATE;
  IF v_audit.id IS NULL THEN RAISE EXCEPTION 'Inventory audit not found' USING ERRCODE = '23503'; END IF;
  IF v_audit.status = 'finalized' THEN
    RETURN jsonb_build_object('success', true, 'already_finalized', true);
  END IF;

  -- Generate full audit data snapshot as of audit date
  v_data := public.get_inventory_audit_data(v_audit.audit_date, v_audit.id);

  UPDATE public.inventory_audits
  SET status = 'finalized',
      snapshot = v_data,
      finalized_by = auth.uid(),
      finalized_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = v_audit.id;

  RETURN jsonb_build_object('success', true, 'audit_id', v_audit.id, 'status', 'finalized');
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_inventory_audit(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_inventory_audit(uuid) TO authenticated;

-- 15. Migration helper: Initialize opening stock for any existing yarn_stock rows lacking an opening movement
INSERT INTO public.yarn_stock_movements (org_id, yarn_id, kind, kg_delta, balance_after, reason)
SELECT y.org_id, y.id, 'opening', y.weight_kg, y.weight_kg, 'Opening stock initialization'
FROM public.yarn_stock y
WHERE NOT EXISTS (
  SELECT 1 FROM public.yarn_stock_movements m WHERE m.org_id = y.org_id AND m.yarn_id = y.id
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
