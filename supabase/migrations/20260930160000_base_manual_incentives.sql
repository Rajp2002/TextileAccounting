-- Positive manual production incentives. No salary, costing or stock rewrites.
CREATE TABLE public.base_worker_incentives (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 worker_id uuid NOT NULL,
 service_start date NOT NULL, service_end date NOT NULL,
 amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 10000000),
 evidence_reference text NOT NULL CHECK (char_length(btrim(evidence_reference)) BETWEEN 3 AND 240),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','voided')),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 approved_by uuid REFERENCES auth.users(id), approved_at timestamptz,
 voided_by uuid REFERENCES auth.users(id), voided_at timestamptz, void_reason text,
 CHECK (service_start <= service_end),
 CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
 CHECK (status <> 'voided' OR (voided_by IS NOT NULL AND voided_at IS NOT NULL AND char_length(btrim(void_reason)) BETWEEN 3 AND 240)),
 FOREIGN KEY (org_id,worker_id) REFERENCES public.base_production_workers(org_id,id) ON DELETE RESTRICT
);
-- Void/replacement retains the original identity and evidence. No direct writes.
CREATE UNIQUE INDEX base_worker_incentives_source_unique ON public.base_worker_incentives(org_id,worker_id,lower(btrim(evidence_reference))) WHERE status <> 'voided';
CREATE INDEX base_worker_incentives_period_idx ON public.base_worker_incentives(org_id,worker_id,service_start,service_end);
ALTER TABLE public.base_worker_incentives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.base_worker_incentives FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.base_worker_incentives TO authenticated;
CREATE POLICY base_worker_incentives_owner_read ON public.base_worker_incentives FOR SELECT TO authenticated USING (private.base_production_core_access(org_id));
ALTER TABLE public.base_payroll_settlements ADD COLUMN incentive_pay numeric(14,2) NOT NULL DEFAULT 0 CHECK (incentive_pay >= 0);
ALTER TABLE public.base_payroll_settlement_lines ADD COLUMN earning_snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.base_payroll_settlement_lines DROP CONSTRAINT base_payroll_settlement_lines_source_kind_check;
ALTER TABLE public.base_payroll_settlement_lines ADD CONSTRAINT base_payroll_settlement_lines_source_kind_check
 CHECK (source_kind IN ('legacy_entry','worker_total','machine_allocation','fixed_salary','manual_incentive'));

CREATE OR REPLACE FUNCTION private.base_payroll_open_incentives(p_org uuid,p_worker uuid)
RETURNS SETOF public.base_worker_incentives LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog,public AS $$
 SELECT incentive.* FROM public.base_worker_incentives incentive WHERE incentive.org_id = p_org AND incentive.worker_id = p_worker AND incentive.status <> 'voided'
 AND NOT EXISTS (SELECT 1 FROM public.base_payroll_settlement_lines line JOIN public.base_payroll_settlements paid
 ON paid.org_id = line.org_id AND paid.id = line.settlement_id AND paid.status = 'paid'
 WHERE line.org_id = p_org AND line.source_kind = 'manual_incentive' AND line.source_id = incentive.id);
$$;
CREATE OR REPLACE FUNCTION private.assert_base_incentive_period(p_org uuid,p_worker uuid,p_start date,p_end date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog,public AS $$
DECLARE worker public.base_production_workers%ROWTYPE;
BEGIN
 IF p_start IS NULL OR p_end IS NULL OR p_start > p_end OR p_end > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
  RAISE EXCEPTION 'Choose a completed incentive service period.' USING ERRCODE = '22023'; END IF;
 SELECT * INTO worker FROM public.base_production_workers WHERE org_id = p_org AND id = p_worker;
 IF NOT FOUND THEN RAISE EXCEPTION 'Worker not found' USING ERRCODE = '23503'; END IF;
 IF (worker.start_date IS NOT NULL AND p_start < worker.start_date) OR (worker.end_date IS NOT NULL AND p_end > worker.end_date) THEN
  RAISE EXCEPTION 'The incentive period must be within employment dates.' USING ERRCODE = '22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.base_payroll_settlements WHERE org_id = p_org AND worker_id = p_worker AND status = 'paid' AND period_end >= p_start) THEN
  RAISE EXCEPTION 'This service period is already paid. Use the controlled correction workflow.' USING ERRCODE = '22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.base_payroll_periods WHERE org_id = p_org AND status = 'settled' AND period_start <= p_end AND period_end >= p_start) THEN
  RAISE EXCEPTION 'Reopen the completed payroll period before changing incentives.' USING ERRCODE = '22023'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.create_base_worker_incentive(p_worker_id uuid,p_service_start date,p_service_end date,p_amount numeric,p_evidence_reference text,p_client_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,private AS $$
DECLARE v_org uuid; existing public.base_worker_incentives%ROWTYPE;
BEGIN
 SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
 IF v_org IS NULL OR NOT private.base_production_core_access(v_org) OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND is_locked_down) THEN RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501'; END IF;
 IF p_client_request_id IS NULL OR p_worker_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000000 OR p_amount <> round(p_amount,2)
  OR p_evidence_reference IS NULL OR char_length(btrim(p_evidence_reference)) NOT BETWEEN 3 AND 240 THEN
  RAISE EXCEPTION 'Enter a positive incentive amount with at most two decimals and an evidence reference.' USING ERRCODE = '22023'; END IF;
 -- Incentive lock precedes payroll lock, also serializing period completion.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':base-incentives',0));
 PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':base-payroll:' || p_worker_id::text,0));
 SELECT * INTO existing FROM public.base_worker_incentives WHERE org_id = v_org AND id = p_client_request_id;
 IF FOUND THEN
  IF existing.worker_id IS DISTINCT FROM p_worker_id OR existing.service_start IS DISTINCT FROM p_service_start OR existing.service_end IS DISTINCT FROM p_service_end
   OR existing.amount IS DISTINCT FROM p_amount OR existing.evidence_reference IS DISTINCT FROM btrim(p_evidence_reference) THEN
   RAISE EXCEPTION 'This incentive request was used for different details.' USING ERRCODE = '40001'; END IF;
  RETURN jsonb_build_object('incentive_id',existing.id,'idempotent',true);
 END IF;
 PERFORM private.assert_base_incentive_period(v_org,p_worker_id,p_service_start,p_service_end);
 INSERT INTO public.base_worker_incentives(id,org_id,worker_id,service_start,service_end,amount,evidence_reference,created_by)
 VALUES(p_client_request_id,v_org,p_worker_id,p_service_start,p_service_end,p_amount,btrim(p_evidence_reference),auth.uid());
 RETURN jsonb_build_object('incentive_id',p_client_request_id,'idempotent',false);
END;
$$;
CREATE OR REPLACE FUNCTION public.review_base_worker_incentive(p_incentive_id uuid,p_expected_updated_at timestamptz,p_action text,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,private AS $$
DECLARE v_org uuid; incentive public.base_worker_incentives%ROWTYPE;
BEGIN
 SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
 IF v_org IS NULL OR NOT private.base_production_core_access(v_org) OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND is_locked_down) THEN RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('approve','void') OR p_expected_updated_at IS NULL THEN RAISE EXCEPTION 'Reload and review the incentive.' USING ERRCODE = '22023'; END IF;
 IF p_action = 'void' AND (p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 240) THEN RAISE EXCEPTION 'Explain why the incentive is being voided.' USING ERRCODE = '22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':base-incentives',0));
 SELECT * INTO incentive FROM public.base_worker_incentives WHERE org_id = v_org AND id = p_incentive_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Incentive not found' USING ERRCODE = '23503'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':base-payroll:' || incentive.worker_id::text,0));
 IF (p_action = 'approve' AND incentive.status = 'approved') OR (p_action = 'void' AND incentive.status = 'voided' AND incentive.void_reason = btrim(p_reason)) THEN
  RETURN jsonb_build_object('incentive_id',incentive.id,'idempotent',true); END IF;
 IF incentive.updated_at IS DISTINCT FROM p_expected_updated_at OR incentive.status = 'voided' THEN
  RAISE EXCEPTION 'Incentive changed since review. Reload before continuing.' USING ERRCODE = '40001'; END IF;
 PERFORM private.assert_base_incentive_period(v_org,incentive.worker_id,incentive.service_start,incentive.service_end);
 IF p_action = 'approve' THEN
  UPDATE public.base_worker_incentives SET status = 'approved',approved_by = auth.uid(),approved_at = clock_timestamp(),updated_at = clock_timestamp() WHERE org_id = v_org AND id = incentive.id;
 ELSE
  UPDATE public.base_worker_incentives SET status = 'voided',voided_by = auth.uid(),voided_at = clock_timestamp(),void_reason = btrim(p_reason),updated_at = clock_timestamp() WHERE org_id = v_org AND id = incentive.id;
 END IF;
 RETURN jsonb_build_object('incentive_id',incentive.id,'idempotent',false);
END;
$$;
CREATE OR REPLACE FUNCTION private.capture_base_payroll_incentive_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,private AS $$
BEGIN
 INSERT INTO public.base_payroll_settlement_lines(org_id,settlement_id,worker_id,production_date,machine_label,costing_label,meters,worker_rate_snapshot,gross_pay,source_kind,source_id,earning_snapshot)
 SELECT NEW.org_id,NEW.id,NEW.worker_id,incentive.service_end,'Production incentive',
  incentive.service_start::text || ' to ' || incentive.service_end::text || ' · ' || incentive.evidence_reference,
  0,0,incentive.amount,'manual_incentive',incentive.id,
  jsonb_build_object('id',incentive.id,'service_start',incentive.service_start,'service_end',incentive.service_end,'amount',incentive.amount,
   'evidence_reference',incentive.evidence_reference,'approved_by',incentive.approved_by,'approved_at',incentive.approved_at,
   'updated_at',incentive.updated_at,'calculation_version','manual-incentive-v1','currency','INR','unit','amount')
 FROM private.base_payroll_open_incentives(NEW.org_id,NEW.worker_id) incentive
 WHERE incentive.status = 'approved' AND incentive.service_start >= NEW.period_start AND incentive.service_end <= NEW.period_end;
 IF (SELECT coalesce(sum(gross_pay),0) FROM public.base_payroll_settlement_lines WHERE org_id = NEW.org_id AND settlement_id = NEW.id AND source_kind = 'manual_incentive') <> NEW.incentive_pay THEN
  RAISE EXCEPTION 'Incentive receipt did not reconcile.' USING ERRCODE = '40001'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER capture_base_payroll_incentive_lines AFTER INSERT ON public.base_payroll_settlements FOR EACH ROW EXECUTE FUNCTION private.capture_base_payroll_incentive_lines();

-- Patch the current audited definitions. Schema drift rolls back this file.
DO $migration$
DECLARE definition text; anchor text;
BEGIN
 definition := pg_get_functiondef('public.settle_base_worker_payroll(uuid,date,text)'::regprocedure);
 anchor := 'v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id)';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll access guard'; END IF;
 definition := replace(definition,anchor,anchor || ' OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND is_locked_down)');
 anchor := '  PERFORM pg_advisory_xact_lock(';
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 THEN RAISE EXCEPTION 'Unexpected payroll lock'; END IF;
 definition := replace(definition,anchor,'  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || '':base-incentives'',0));' || chr(10) || anchor);
 anchor := 'v_gross numeric := 0;';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll declaration'; END IF;
 definition := replace(definition,anchor,anchor || ' v_incentive numeric := 0;');
 anchor := '  SELECT * INTO v_salary_worker FROM public.base_production_workers WHERE org_id = v_org_id AND id = p_worker_id;';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected salary branch'; END IF;
 definition := replace(definition,anchor,$start$
  IF NOT EXISTS (SELECT 1 FROM public.base_payroll_settlements WHERE org_id = v_org_id AND worker_id = p_worker_id AND status = 'paid') THEN
   SELECT least(v_period_start,coalesce(min(service_start),v_period_start)) INTO v_period_start FROM private.base_payroll_open_incentives(v_org_id,p_worker_id) WHERE service_start <= p_period_end;
  END IF;
$start$ || anchor);
 anchor := '  END IF;' || chr(10) || '  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)' || chr(10) || '  INTO v_total_pending_advances';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll earnings boundary'; END IF;
 definition := replace(definition,anchor,$earn$
  END IF;
  IF EXISTS (SELECT 1 FROM private.base_payroll_open_incentives(v_org_id,p_worker_id)
   WHERE service_start <= p_period_end AND (status <> 'approved' OR service_start < v_period_start OR service_end > p_period_end)) THEN
   RAISE EXCEPTION 'Review incentives and include their complete service periods before payment.' USING ERRCODE = '23514';
  END IF;
  SELECT coalesce(sum(amount),0) INTO v_incentive FROM private.base_payroll_open_incentives(v_org_id,p_worker_id)
   WHERE status = 'approved' AND service_start >= v_period_start AND service_end <= p_period_end;
  v_gross := v_gross + v_incentive;
  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)
  INTO v_total_pending_advances$earn$);
 anchor := 'gross_pay, advance_deducted, net_payout, payment_mode, created_by';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll insert columns'; END IF;
 definition := replace(definition,anchor,anchor || ', incentive_pay');
 anchor := 'p_payment_mode, auth.uid()' || chr(10) || '  )';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll insert values'; END IF;
 definition := replace(definition,anchor,'p_payment_mode, auth.uid(), v_incentive' || chr(10) || '  )');
 EXECUTE definition;

 definition := pg_get_functiondef('public.settle_base_worker_payroll_reviewed(uuid,date,text,jsonb,text)'::regprocedure);
 anchor := 'v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id)';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll access guard'; END IF;
 definition := replace(definition,anchor,anchor || ' OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND is_locked_down)');
 anchor := '  v_request_id uuid;';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected reviewed declaration'; END IF;
 definition := replace(definition,anchor,anchor || ' v_incentive_expected jsonb;');
 anchor := '  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || '':base-payroll:'' || p_worker_id::text, 0));';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected reviewed lock'; END IF;
 definition := replace(definition,anchor,'  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || '':base-incentives'',0));' || chr(10) || anchor);
 anchor := '  v_result := public.settle_base_worker_payroll(p_worker_id, p_period_end, p_payment_mode);';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected reviewed call'; END IF;
 definition := replace(definition,anchor,$request$
  IF EXISTS (SELECT 1 FROM public.base_payroll_payment_requests WHERE org_id = v_org_id AND request_id = v_request_id
   AND payload IS DISTINCT FROM jsonb_build_object('worker_id',p_worker_id,'period_end',p_period_end,'payment_mode',p_payment_mode,'expected',p_expected)) THEN
   RAISE EXCEPTION 'This payment request was used for different details.' USING ERRCODE = '40001';
  END IF;
$request$ || anchor);
 anchor := '  IF p_note IS NOT NULL AND btrim(p_note) <> '''' THEN';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected note boundary'; END IF;
 definition := replace(definition,anchor,$review$
  SELECT jsonb_build_object('incentive_pay',settlement.incentive_pay,'incentives',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',line.source_id,'amount',line.gross_pay,'updated_at',(line.earning_snapshot->>'updated_at')::timestamptz) ORDER BY line.source_id)
   FROM public.base_payroll_settlement_lines line WHERE line.org_id = v_org_id AND line.settlement_id = settlement.id AND line.source_kind = 'manual_incentive'
  ),'[]'::jsonb)) INTO v_actual FROM public.base_payroll_settlements settlement WHERE org_id = v_org_id AND id = v_settlement_id;
  IF (v_actual->>'incentive_pay')::numeric > 0 OR p_expected ? 'incentives' OR p_expected ? 'incentive_pay' THEN
   IF jsonb_typeof(p_expected->'incentives') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Review approved incentives before payment.' USING ERRCODE = '40001'; END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',(item->>'id')::uuid,'amount',(item->>'amount')::numeric,'updated_at',(item->>'updated_at')::timestamptz)
    ORDER BY (item->>'id')::uuid),'[]'::jsonb) INTO v_incentive_expected FROM jsonb_array_elements(p_expected->'incentives') item;
   IF jsonb_typeof(p_expected->'incentive_pay') IS DISTINCT FROM 'number' OR (p_expected->>'incentive_pay')::numeric IS DISTINCT FROM (v_actual->>'incentive_pay')::numeric
    OR v_incentive_expected IS DISTINCT FROM v_actual->'incentives' THEN
    RAISE EXCEPTION 'Incentives changed since review. Reload before payment.' USING ERRCODE = '40001';
   END IF;
  END IF;
$review$ || anchor);
 EXECUTE definition;

 definition := pg_get_functiondef('public.complete_base_payroll_period(date,date,jsonb,text[])'::regprocedure);
 anchor := 'v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id)';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll access guard'; END IF;
 definition := replace(definition,anchor,anchor || ' OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND is_locked_down)');
 anchor := '    PERFORM pg_advisory_xact_lock(';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected completion lock'; END IF;
 definition := replace(definition,anchor,'    PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || '':base-incentives'',0));' || chr(10) || anchor);
 anchor := '    -- Aggregate totals from active settlements in this period';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected completion boundary'; END IF;
 definition := replace(definition,anchor,$complete$
    IF EXISTS (SELECT 1 FROM public.base_worker_incentives incentive WHERE org_id = v_org_id AND status <> 'voided' AND service_start <= p_period_end AND NOT EXISTS (
     SELECT 1 FROM public.base_payroll_settlement_lines line JOIN public.base_payroll_settlements paid ON paid.org_id = line.org_id AND paid.id = line.settlement_id AND paid.status = 'paid'
     WHERE line.org_id = v_org_id AND line.source_kind = 'manual_incentive' AND line.source_id = incentive.id
    )) THEN RAISE EXCEPTION 'Review and settle outstanding incentives before completing payroll.' USING ERRCODE = '23514'; END IF;
$complete$ || anchor);
 EXECUTE definition;

 definition := pg_get_functiondef('public.reverse_base_payroll_settlement(uuid,text,boolean)'::regprocedure);
 anchor := 'v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id)';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected payroll access guard'; END IF;
 definition := replace(definition,anchor,anchor || ' OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND is_locked_down)');
 anchor := '  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || '':base-payroll:'' || v_settlement.worker_id::text, 0));';
 IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected reversal lock'; END IF;
 definition := replace(definition,anchor,'  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || '':base-incentives'',0));' || chr(10) || anchor);
 EXECUTE definition;
END;
$migration$;
REVOKE ALL ON FUNCTION private.base_payroll_open_incentives(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.assert_base_incentive_period(uuid,uuid,date,date) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.capture_base_payroll_incentive_lines() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.create_base_worker_incentive(uuid,date,date,numeric,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.review_base_worker_incentive(uuid,timestamptz,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_base_worker_incentive(uuid,date,date,numeric,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_base_worker_incentive(uuid,timestamptz,text,text) TO authenticated;
