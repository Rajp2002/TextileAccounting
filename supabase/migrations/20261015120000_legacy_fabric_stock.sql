-- Legacy fabric stock (2026-10-15): untagged fabric that was already in the godown before Weavly tracked stock.
--
-- Two pools per quality, never mixed:
--   Orange stock  public.quality_stock.meters, unchanged: saved production adds to it, an Orange challan line takes
--                 from it, and it can never go below zero.
--   Legacy stock  public.legacy_stock + its append-only ledger public.legacy_stock_movements. Its balance is
--                 'unknown' (no number at all, never zero), 'estimated' or 'counted'. Legacy dispatches are never
--                 refused: the fabric has already left the gate. An estimate or count may go below zero, which the
--                 screen flags for a recount instead of hiding.
--
-- Movements between the pools happen only inside one transaction under the org's quality-stock advisory lock:
--   * a challan line marked Legacy debits legacy stock on confirm and is restored once on reversal;
--   * onboarding (old takas tagged orange) moves metres from legacy to orange stock.
-- A count or an estimate always describes what is in the godown now; no opening figure is back-dated.
-- A quality closes only after a count of 0 m and an explicit confirmation, and can be reopened with a reason.
--
-- Additive. Existing challans have legacy_meters = 0 and their lines carry no source, which means Orange, so their
-- confirm and reverse behaviour is unchanged. No existing row is rewritten.
BEGIN;

ALTER TABLE public.quality_stock_movements DROP CONSTRAINT IF EXISTS quality_stock_movements_kind_check;
ALTER TABLE public.quality_stock_movements ADD CONSTRAINT quality_stock_movements_kind_check
  CHECK (kind IN ('production','opening','correction','dispatch','dispatch_reversal','audit_adjustment','production_reversal','legacy_onboarding'));

CREATE TABLE public.legacy_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quality_id uuid NOT NULL,
  basis text NOT NULL CHECK (basis IN ('unknown','estimated','counted')),
  -- What Weavly believes is left: the last estimate or count, less legacy dispatched and onboarded since.
  -- NULL exactly when the basis is unknown. It may be negative, which means the estimate or count was too low.
  balance_meters numeric(16,2) CHECK (balance_meters IS NULL OR (balance_meters > -1000000000 AND balance_meters < 1000000000)),
  -- The figure the owner last entered as an estimate or a count, and when.
  basis_meters numeric(16,2) CHECK (basis_meters IS NULL OR (basis_meters >= 0 AND basis_meters <= 100000000)),
  basis_at timestamptz,
  -- Running totals since legacy stock started, net of reversals.
  dispatched_meters numeric(16,2) NOT NULL DEFAULT 0 CHECK (dispatched_meters >= 0 AND dispatched_meters < 1000000000),
  onboarded_meters numeric(16,2) NOT NULL DEFAULT 0 CHECK (onboarded_meters >= 0 AND onboarded_meters < 1000000000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (org_id, quality_id),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, quality_id) REFERENCES public.quality_stock(org_id, id) ON DELETE CASCADE,
  CONSTRAINT legacy_stock_unknown_has_no_balance CHECK ((basis = 'unknown') = (balance_meters IS NULL)),
  CONSTRAINT legacy_stock_unknown_has_no_basis CHECK ((basis = 'unknown') = (basis_meters IS NULL AND basis_at IS NULL)),
  CONSTRAINT legacy_stock_closed_after_zero_count CHECK (
    (status = 'open' AND closed_at IS NULL)
    OR (status = 'closed' AND basis = 'counted' AND balance_meters = 0 AND closed_at IS NOT NULL)
  )
);

CREATE TABLE public.legacy_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legacy_id uuid NOT NULL,
  quality_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('start','estimate','count','dispatch','dispatch_reversal','onboard','close','reopen')),
  -- Signed change to the legacy balance. NULL when the balance was unknown before or after (start, estimate, count, reopen).
  meters_delta numeric(16,2) CHECK (meters_delta IS NULL OR (meters_delta > -1000000000 AND meters_delta < 1000000000)),
  balance_after numeric(16,2),
  basis_after text NOT NULL CHECK (basis_after IN ('unknown','estimated','counted')),
  -- The estimate or count the owner entered, and Weavly's balance just before it (NULL when unknown).
  entered_meters numeric(16,2) CHECK (entered_meters IS NULL OR (entered_meters >= 0 AND entered_meters <= 100000000)),
  expected_meters numeric(16,2),
  reason text CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500),
  -- Onboarding: the taka numbers and metres tagged orange, [{lot, meters}].
  lines jsonb CHECK (lines IS NULL OR jsonb_typeof(lines) = 'array'),
  source_table text,
  source_id text,
  reverses_id uuid UNIQUE REFERENCES public.legacy_stock_movements(id) ON DELETE CASCADE,
  client_request_id uuid,
  request_payload jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (org_id, client_request_id),
  FOREIGN KEY (org_id, legacy_id) REFERENCES public.legacy_stock(org_id, id) ON DELETE CASCADE,
  CONSTRAINT legacy_stock_movements_quantity CHECK (kind NOT IN ('dispatch','dispatch_reversal','onboard') OR meters_delta IS NOT NULL),
  CONSTRAINT legacy_stock_movements_balance CHECK ((basis_after = 'unknown') = (balance_after IS NULL))
);
-- A challan debits legacy stock at most once and is restored at most once.
CREATE UNIQUE INDEX legacy_stock_movements_once_per_source ON public.legacy_stock_movements(org_id, kind, source_table, source_id)
  WHERE source_table IS NOT NULL AND kind IN ('dispatch','dispatch_reversal');
CREATE INDEX legacy_stock_movements_history_idx ON public.legacy_stock_movements(org_id, quality_id, created_at DESC, id DESC);
CREATE INDEX legacy_stock_movements_legacy_idx ON public.legacy_stock_movements(org_id, legacy_id);
CREATE INDEX legacy_stock_movements_actor_idx ON public.legacy_stock_movements(created_by);
CREATE INDEX legacy_stock_started_by_idx ON public.legacy_stock(started_by);
CREATE INDEX legacy_stock_closed_by_idx ON public.legacy_stock(closed_by);

ALTER TABLE public.legacy_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_stock, public.legacy_stock_movements FROM PUBLIC, anon, authenticated, service_role;
-- Owners read their own; only the RPCs below write. Service-role SELECT serves the tenant-scoped account export.
GRANT SELECT ON public.legacy_stock, public.legacy_stock_movements TO authenticated, service_role;
CREATE POLICY legacy_stock_owner_read ON public.legacy_stock FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));
CREATE POLICY legacy_stock_movements_owner_read ON public.legacy_stock_movements FOR SELECT TO authenticated USING ((SELECT private.quality_stock_access(org_id)));

-- Which pool a challan's metres come from. sent_meters stays the total; Orange metres are sent_meters - legacy_meters.
ALTER TABLE public.delivery_challans ADD COLUMN legacy_meters numeric(16,2) NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_challans ADD CONSTRAINT delivery_challans_legacy_within_sent CHECK (legacy_meters >= 0 AND legacy_meters <= sent_meters);

-- One legacy movement that changes the balance (dispatch, its reversal, or onboarding). The caller has authorised the
-- owner and holds the org's quality-stock advisory lock. Marking takas Legacy is enough to start legacy stock for a
-- quality: it starts as unknown, so no balance is invented.
CREATE FUNCTION private.move_legacy_stock(
  p_org uuid, p_quality uuid, p_kind text, p_meters numeric, p_reason text,
  p_source_table text, p_source_id text, p_reverses uuid, p_lines jsonb, p_request uuid, p_payload jsonb
)
RETURNS public.legacy_stock_movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  l public.legacy_stock%ROWTYPE;
  m public.legacy_stock_movements%ROWTYPE;
  v_delta numeric;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('dispatch','dispatch_reversal','onboard') OR p_meters IS NULL OR p_meters <= 0 OR p_meters > 100000000 THEN
    RAISE EXCEPTION 'Invalid legacy stock movement' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO l FROM public.legacy_stock WHERE org_id = p_org AND quality_id = p_quality FOR UPDATE;
  IF NOT FOUND THEN
    IF p_kind = 'dispatch_reversal' THEN
      RAISE EXCEPTION 'Legacy stock for this dispatch is missing' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.legacy_stock(org_id, quality_id, basis, started_by)
      VALUES (p_org, p_quality, 'unknown', auth.uid()) RETURNING * INTO l;
    INSERT INTO public.legacy_stock_movements(org_id, legacy_id, quality_id, kind, basis_after, reason, created_by)
      VALUES (p_org, l.id, p_quality, 'start', 'unknown',
        CASE WHEN p_kind = 'onboard' THEN 'Started by adding legacy takas' ELSE 'Started by marking takas Legacy' END, auth.uid());
  END IF;
  IF l.status = 'closed' THEN
    IF p_kind = 'dispatch_reversal' THEN
      RAISE EXCEPTION 'Legacy stock for this quality is closed. Reopen it before reversing this dispatch.' USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'Legacy stock for this quality is closed. Reopen it, or mark these takas Orange.' USING ERRCODE = '22023';
  END IF;

  v_delta := CASE WHEN p_kind = 'dispatch_reversal' THEN p_meters ELSE -p_meters END;
  UPDATE public.legacy_stock SET
    balance_meters = balance_meters + v_delta,
    dispatched_meters = dispatched_meters + CASE p_kind WHEN 'dispatch' THEN p_meters WHEN 'dispatch_reversal' THEN -p_meters ELSE 0 END,
    onboarded_meters = onboarded_meters + CASE WHEN p_kind = 'onboard' THEN p_meters ELSE 0 END,
    version = version + 1,
    updated_at = clock_timestamp()
  WHERE id = l.id
  RETURNING * INTO l;

  INSERT INTO public.legacy_stock_movements(
    org_id, legacy_id, quality_id, kind, meters_delta, balance_after, basis_after, reason, lines,
    source_table, source_id, reverses_id, client_request_id, request_payload, created_by
  )
  VALUES (
    p_org, l.id, p_quality, p_kind, v_delta, l.balance_meters, l.basis, left(nullif(btrim(p_reason), ''), 500), p_lines,
    p_source_table, p_source_id, p_reverses, p_request, p_payload, auth.uid()
  )
  RETURNING * INTO m;
  RETURN m;
END;
$$;
REVOKE ALL ON FUNCTION private.move_legacy_stock(uuid, uuid, text, numeric, text, text, text, uuid, jsonb, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- The owner's legacy stock actions: start, estimate, count, onboard, close, reopen.
-- p_version is the legacy_stock version the owner reviewed (0 before it exists); estimate, count, close and reopen
-- refuse a stale one, so a count is never applied to a balance the owner did not see.
CREATE FUNCTION public.mutate_legacy_stock(p_quality_id uuid, p_request_id uuid, p_version integer, p_action text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o uuid;
  q public.quality_stock%ROWTYPE;
  l public.legacy_stock%ROWTYPE;
  e public.legacy_stock_movements%ROWTYPE;
  m public.legacy_stock_movements%ROWTYPE;
  req jsonb;
  n numeric;
  v_expected numeric;
  v_basis text;
  v_reason text;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_balance numeric;
BEGIN
  SELECT org_id INTO o FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF o IS NULL OR private.quality_stock_access(o) IS NOT TRUE THEN
    RAISE EXCEPTION 'Production owner access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_org_not_locked(o);
  IF p_quality_id IS NULL OR p_request_id IS NULL OR p_action IS NULL OR p_version IS NULL OR p_version < 0
    OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::text) > 100000 THEN
    RAISE EXCEPTION 'Invalid request' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(o::text || ':quality-stock', 0));

  req := jsonb_build_object('quality_id', p_quality_id, 'version', p_version, 'action', p_action, 'data', p_payload);
  SELECT * INTO e FROM public.legacy_stock_movements WHERE org_id = o AND client_request_id = p_request_id;
  IF FOUND THEN
    IF e.request_payload IS DISTINCT FROM req THEN
      RAISE EXCEPTION 'This request already saved a different legacy stock change. Reload stock.' USING ERRCODE = '40001';
    END IF;
    RETURN jsonb_build_object('id', e.id, 'duplicate', true);
  END IF;

  SELECT * INTO q FROM public.quality_stock WHERE org_id = o AND id = p_quality_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a stock quality' USING ERRCODE = '22023'; END IF;
  SELECT * INTO l FROM public.legacy_stock WHERE org_id = o AND quality_id = q.id FOR UPDATE;

  v_reason := nullif(btrim(p_payload->>'reason'), '');
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Keep the note under 500 characters' USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('start', 'estimate', 'count', 'reopen') THEN
    n := nullif(p_payload->>'meters', '')::numeric;
    IF n IS NOT NULL AND (n < 0 OR n > 100000000 OR n <> round(n, 2)) THEN
      RAISE EXCEPTION 'Enter metres from 0 to 100000000 with up to two decimals' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_action IN ('start', 'reopen') THEN
    v_basis := p_payload->>'basis';
    IF v_basis IS NULL OR v_basis NOT IN ('unknown', 'estimated', 'counted') THEN
      RAISE EXCEPTION 'Choose whether the amount is unknown, estimated or counted' USING ERRCODE = '22023';
    END IF;
    IF (v_basis = 'unknown') <> (n IS NULL) THEN
      RAISE EXCEPTION 'Enter metres for an estimate or a count, and leave them empty when the amount is unknown' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_action = 'start' THEN
    IF l.id IS NOT NULL OR p_version <> 0 THEN
      RAISE EXCEPTION 'Legacy stock is already started for this quality. Reload stock.' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.legacy_stock(org_id, quality_id, basis, balance_meters, basis_meters, basis_at, started_by)
      VALUES (o, q.id, v_basis, n, n, CASE WHEN n IS NULL THEN NULL ELSE clock_timestamp() END, auth.uid())
      RETURNING * INTO l;
    INSERT INTO public.legacy_stock_movements(org_id, legacy_id, quality_id, kind, balance_after, basis_after, entered_meters, reason, client_request_id, request_payload, created_by)
      VALUES (o, l.id, q.id, 'start', n, v_basis, n, v_reason, p_request_id, req, auth.uid())
      RETURNING * INTO m;

  ELSIF p_action = 'onboard' THEN
    IF jsonb_typeof(p_payload->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'lines') NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Enter 1 to 500 takas' USING ERRCODE = '22023';
    END IF;
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lines') LOOP
      n := (v_line->>'meters')::numeric;
      IF coalesce(length(btrim(v_line->>'lot')), 0) NOT BETWEEN 1 AND 80 OR n IS NULL OR n < 0.01 OR n > 100000000 OR n <> round(n, 2) THEN
        RAISE EXCEPTION 'Enter a taka number and metres for every row' USING ERRCODE = '22023';
      END IF;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('lot', btrim(v_line->>'lot'), 'meters', n));
      v_total := v_total + n;
    END LOOP;
    IF (SELECT count(DISTINCT value->>'lot') FROM jsonb_array_elements(v_lines)) <> jsonb_array_length(v_lines) THEN
      RAISE EXCEPTION 'Each taka number can appear only once' USING ERRCODE = '22023';
    END IF;
    IF v_total > 100000000 THEN RAISE EXCEPTION 'Total metres exceed the limit' USING ERRCODE = '22023'; END IF;

    PERFORM private.reconcile_quality_stock(o, NULL, NULL);
    m := private.move_legacy_stock(o, q.id, 'onboard', v_total,
      coalesce(v_reason, format('%s takas tagged orange', jsonb_array_length(v_lines))),
      NULL, NULL, NULL, v_lines, p_request_id, req);
    UPDATE public.quality_stock SET meters = meters + v_total, updated_at = clock_timestamp()
      WHERE org_id = o AND id = q.id RETURNING meters INTO v_balance;
    INSERT INTO public.quality_stock_movements(org_id, quality_id, kind, meters_delta, balance_after, reason, source_table, source_id, created_by)
      VALUES (o, q.id, 'legacy_onboarding', v_total, v_balance,
        format('From legacy stock: %s takas', jsonb_array_length(v_lines)), 'legacy_stock_movements', m.id::text, auth.uid());

  ELSE
    IF l.id IS NULL THEN RAISE EXCEPTION 'Start legacy stock for this quality first' USING ERRCODE = '22023'; END IF;
    IF l.version IS DISTINCT FROM p_version THEN
      RAISE EXCEPTION 'Legacy stock changed after you opened it. Reload and review the balance.' USING ERRCODE = '40001';
    END IF;
    v_expected := l.balance_meters;

    IF p_action = 'estimate' THEN
      IF l.status <> 'open' THEN RAISE EXCEPTION 'Reopen legacy stock before changing it' USING ERRCODE = '22023'; END IF;
      IF l.basis = 'counted' THEN
        RAISE EXCEPTION 'This balance comes from a count. Record a new count instead of an estimate.' USING ERRCODE = '22023';
      END IF;
      IF n IS NULL THEN RAISE EXCEPTION 'Enter the estimated metres' USING ERRCODE = '22023'; END IF;
      UPDATE public.legacy_stock SET basis = 'estimated', balance_meters = n, basis_meters = n, basis_at = clock_timestamp(),
        version = version + 1, updated_at = clock_timestamp() WHERE id = l.id RETURNING * INTO l;

    ELSIF p_action = 'count' THEN
      IF l.status <> 'open' THEN RAISE EXCEPTION 'Reopen legacy stock before counting it' USING ERRCODE = '22023'; END IF;
      IF n IS NULL THEN RAISE EXCEPTION 'Enter the counted metres' USING ERRCODE = '22023'; END IF;
      IF v_expected IS NOT NULL AND v_expected <> n AND coalesce(char_length(v_reason), 0) < 3 THEN
        RAISE EXCEPTION 'Explain the difference between the count and the balance Weavly expected' USING ERRCODE = '22023';
      END IF;
      UPDATE public.legacy_stock SET basis = 'counted', balance_meters = n, basis_meters = n, basis_at = clock_timestamp(),
        version = version + 1, updated_at = clock_timestamp() WHERE id = l.id RETURNING * INTO l;

    ELSIF p_action = 'close' THEN
      IF l.status <> 'open' THEN RAISE EXCEPTION 'Legacy stock is already closed' USING ERRCODE = '22023'; END IF;
      IF l.basis <> 'counted' OR l.balance_meters <> 0 THEN
        RAISE EXCEPTION 'Legacy stock can close only after a count shows 0 m of untagged fabric left' USING ERRCODE = '22023';
      END IF;
      IF p_payload->>'confirmed' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Confirm that no untagged fabric of this quality is left' USING ERRCODE = '22023';
      END IF;
      UPDATE public.legacy_stock SET status = 'closed', closed_at = clock_timestamp(), closed_by = auth.uid(),
        version = version + 1, updated_at = clock_timestamp() WHERE id = l.id RETURNING * INTO l;

    ELSIF p_action = 'reopen' THEN
      IF l.status <> 'closed' THEN RAISE EXCEPTION 'Legacy stock is not closed' USING ERRCODE = '22023'; END IF;
      IF coalesce(char_length(v_reason), 0) < 3 THEN
        RAISE EXCEPTION 'Explain why legacy stock is reopened' USING ERRCODE = '22023';
      END IF;
      UPDATE public.legacy_stock SET status = 'open', closed_at = NULL, closed_by = NULL,
        basis = v_basis, balance_meters = n, basis_meters = n, basis_at = CASE WHEN n IS NULL THEN NULL ELSE clock_timestamp() END,
        version = version + 1, updated_at = clock_timestamp() WHERE id = l.id RETURNING * INTO l;

    ELSE
      RAISE EXCEPTION 'Unknown action' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.legacy_stock_movements(
      org_id, legacy_id, quality_id, kind, meters_delta, balance_after, basis_after, entered_meters, expected_meters,
      reason, client_request_id, request_payload, created_by
    )
    VALUES (
      o, l.id, q.id, p_action,
      CASE WHEN p_action IN ('estimate', 'count') AND v_expected IS NOT NULL THEN n - v_expected END,
      l.balance_meters, l.basis,
      CASE WHEN p_action IN ('estimate', 'count', 'reopen') THEN n END,
      CASE WHEN p_action IN ('estimate', 'count') THEN v_expected END,
      v_reason, p_request_id, req, auth.uid()
    )
    RETURNING * INTO m;
  END IF;

  RETURN jsonb_build_object('id', m.id, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.mutate_legacy_stock(uuid, uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mutate_legacy_stock(uuid, uuid, integer, text, jsonb) TO authenticated;

-- Latest definition (20261014120000) plus the Orange/Legacy split:
--   save              each line may carry source 'tracked' (Orange, the default) or 'legacy'; legacy_meters is their sum
--   confirm           Orange metres leave quality_stock with the existing availability check; Legacy metres leave legacy stock
--   reverse_dispatch  each pool gets back exactly what it gave; the legacy reversal points at the original movement
CREATE OR REPLACE FUNCTION public.mutate_delivery_challan(p_id uuid,p_request_id uuid,p_version integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  o uuid; d public.delivery_challans%ROWTYPE; e public.delivery_challan_events%ROWTYPE;
  q public.quality_stock%ROWTYPE; line jsonb; total numeric:=0; n numeric; amt numeric; rev uuid; req jsonb; prior_terms jsonb; due_date date; terms text;
  legacy_total numeric:=0; tracked numeric; legacy_dispatch uuid;
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
    IF coalesce(line->>'source','tracked') NOT IN ('tracked','legacy') THEN RAISE EXCEPTION 'Mark each taka Orange or Legacy' USING ERRCODE='22023'; END IF;
    IF line->>'source'='legacy' THEN legacy_total:=legacy_total+n; END IF;
    total:=total+n;
   END LOOP;
   IF (SELECT count(DISTINCT btrim(value->>'lot')) FROM jsonb_array_elements(p_payload->'lines'))<>jsonb_array_length(p_payload->'lines') THEN RAISE EXCEPTION 'Lot identifiers must be unique within this document' USING ERRCODE='22023'; END IF;
   n:=(p_payload->>'selling_rate')::numeric;
   IF n IS NULL OR n NOT BETWEEN 0.01 AND 100000000 OR n<>round(n,2) OR total>100000000 THEN RAISE EXCEPTION 'Enter agreed selling rate and valid metres' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM unnest(ARRAY['sender_name','sender_address','customer_name','customer_address','delivery_address','date']) k WHERE coalesce(length(btrim(p_payload->'document'->>k)),0) NOT BETWEEN 1 AND 1000) THEN RAISE EXCEPTION 'Sender, customer, delivery address and date are required' USING ERRCODE='22023'; END IF;
   PERFORM (p_payload->'document'->>'date')::date;
   IF EXISTS(SELECT 1 FROM jsonb_each(p_payload->'document') WHERE jsonb_typeof(value)<>'string' OR length(value#>>'{}')>1000) THEN RAISE EXCEPTION 'Document fields must be text up to 1000 characters' USING ERRCODE='22023'; END IF;
   INSERT INTO public.delivery_challans(id,org_id,quality_id,quality_label,document,lines,sent_meters,chargeable_meters,selling_rate,legacy_meters)
    VALUES(p_id,o,q.id,q.quality_label,p_payload->'document',p_payload->'lines',total,total,n,legacy_total)
    ON CONFLICT(id) DO UPDATE SET quality_id=excluded.quality_id,quality_label=excluded.quality_label,document=excluded.document,lines=excluded.lines,sent_meters=total,chargeable_meters=total,selling_rate=n,legacy_meters=excluded.legacy_meters,version=delivery_challans.version+1,updated_at=clock_timestamp()
    WHERE delivery_challans.org_id=o AND delivery_challans.delivery_status='draft';
   IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch identifier unavailable' USING ERRCODE='22023'; END IF;
   UPDATE public.delivery_challans SET payment_due_date=due_date,payment_terms=terms WHERE id=p_id AND org_id=o;
  ELSE
   IF d.id IS NULL THEN RAISE EXCEPTION 'Dispatch not found' USING ERRCODE='22023'; END IF;
   IF d.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Dispatch changed. Reload before saving.' USING ERRCODE='40001'; END IF;
   IF p_action='confirm' THEN
    IF d.delivery_status<>'draft' THEN RAISE EXCEPTION 'Only drafts can leave stock' USING ERRCODE='22023'; END IF;
    PERFORM private.reconcile_quality_stock(o,NULL,NULL);
    tracked:=d.sent_meters-d.legacy_meters;
    IF tracked>0 THEN
     UPDATE public.quality_stock SET meters=meters-tracked,updated_at=clock_timestamp() WHERE org_id=o AND id=d.quality_id AND meters>=tracked RETURNING * INTO q;
     IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for this dispatch' USING ERRCODE='22023'; END IF;
     INSERT INTO public.quality_stock_movements(org_id,quality_id,kind,meters_delta,balance_after,reason,source_table,source_id,created_by)
      VALUES(o,d.quality_id,'dispatch',-tracked,q.meters,'Dispatch '||d.number,'delivery_challans',d.id::text,auth.uid());
    END IF;
    IF d.legacy_meters>0 THEN
     PERFORM private.move_legacy_stock(o,d.quality_id,'dispatch',d.legacy_meters,'Dispatch '||d.number,'delivery_challans',d.id::text,NULL,NULL,NULL,NULL);
    END IF;
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
    tracked:=d.sent_meters-d.legacy_meters;
    IF tracked>0 THEN
     UPDATE public.quality_stock SET meters=meters+tracked,updated_at=clock_timestamp() WHERE id=d.quality_id AND org_id=o RETURNING * INTO q;
     INSERT INTO public.quality_stock_movements(org_id,quality_id,kind,meters_delta,balance_after,reason,source_table,source_id,created_by)
      VALUES(o,d.quality_id,'dispatch_reversal',tracked,q.meters,left(p_payload->>'reason',500),'delivery_challans',d.id::text,auth.uid());
    END IF;
    IF d.legacy_meters>0 THEN
     SELECT id INTO legacy_dispatch FROM public.legacy_stock_movements WHERE org_id=o AND kind='dispatch' AND source_table='delivery_challans' AND source_id=d.id::text;
     IF legacy_dispatch IS NULL THEN RAISE EXCEPTION 'Legacy stock for this dispatch is missing' USING ERRCODE='22023'; END IF;
     PERFORM private.move_legacy_stock(o,d.quality_id,'dispatch_reversal',d.legacy_meters,left(p_payload->>'reason',500),'delivery_challans',d.id::text,legacy_dispatch,NULL,NULL,NULL);
    END IF;
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

NOTIFY pgrst, 'reload schema';
COMMIT;
