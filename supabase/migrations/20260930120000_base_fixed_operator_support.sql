-- Fixed operator increment. Preserve salary accrual, settlements, saved costings
-- and stock quantity functions. Existing piece workers retain their capability.
ALTER TABLE public.base_production_workers
  ADD COLUMN operator_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN operator_effective_from date,
  ADD COLUMN operator_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN operator_approved_at timestamptz;

UPDATE public.base_production_workers SET operator_eligible = true WHERE pay_type = 'piece_rate';
-- An omitted value is resolved by the trigger using the immutable pay basis.
-- Existing onboarding clients remain compatible; monthly staff default to false.
ALTER TABLE public.base_production_workers ALTER COLUMN operator_eligible DROP DEFAULT;

CREATE OR REPLACE FUNCTION private.guard_base_operator_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, private AS $$
DECLARE v_changed boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text || ':base-operator:' || NEW.id::text, 0));
  NEW.operator_eligible := coalesce(NEW.operator_eligible, NEW.pay_type = 'piece_rate');
  v_changed := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    v_changed := NEW.operator_eligible IS DISTINCT FROM OLD.operator_eligible;
    IF (v_changed AND NOT NEW.operator_eligible)
      OR NEW.shift_availability IS DISTINCT FROM OLD.shift_availability THEN
      IF EXISTS (SELECT 1 FROM public.base_worker_machine_assignments a
        WHERE a.org_id = NEW.org_id AND a.worker_id = NEW.id AND a.active AND a.effective_to IS NULL
          AND (NOT NEW.operator_eligible OR (NEW.shift_availability <> 'both' AND a.shift <> NEW.shift_availability))) THEN
        RAISE EXCEPTION 'End conflicting machine assignments before changing operator eligibility or shifts.' USING ERRCODE = '22023';
      END IF;
    END IF;
    -- Provenance is maintained here, never accepted from caller input.
    NEW.operator_effective_from := OLD.operator_effective_from;
    NEW.operator_approved_by := OLD.operator_approved_by;
    NEW.operator_approved_at := OLD.operator_approved_at;
  ELSE
    NEW.operator_effective_from := NULL;
    NEW.operator_approved_by := NULL;
    NEW.operator_approved_at := NULL;
  END IF;
  IF v_changed AND NEW.operator_eligible THEN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND org_id = NEW.org_id AND role::text = 'owner') THEN
      RAISE EXCEPTION 'Only the factory owner can approve an operator.' USING ERRCODE = '42501';
    END IF;
    IF NEW.pay_type = 'fixed_monthly' AND auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Fixed operators require a signed-in owner approval.' USING ERRCODE = '42501';
    END IF;
    -- Legacy piece workflows stay backdate-compatible. Fixed approval is
    -- prospective; dated machine assignments give the actual operation scope.
    IF NEW.pay_type = 'fixed_monthly' THEN
      NEW.operator_effective_from := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    END IF;
    NEW.operator_approved_by := auth.uid();
    NEW.operator_approved_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_operator_approval() FROM PUBLIC, anon, authenticated, service_role;
-- Run after compensation's payroll lock, matching production's payroll -> operator order.
CREATE TRIGGER zz_guard_base_operator_approval BEFORE INSERT OR UPDATE ON public.base_production_workers
FOR EACH ROW EXECUTE FUNCTION private.guard_base_operator_approval();

-- Keep the existing three trigger entrypoints, replacing their pay-type gate
-- with capability, effective dates and shift checks. Assignment retirement is
-- always possible so a revoked/inactive operator cannot strand an assignment.
CREATE OR REPLACE FUNCTION private.guard_base_piece_worker()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE v_worker public.base_production_workers%ROWTYPE; v_date date; v_shift text;
BEGIN
  IF TG_TABLE_NAME = 'base_worker_machine_assignments' THEN
    IF NOT NEW.active THEN RETURN NEW; END IF;
    v_date := NEW.effective_from;
    v_shift := NEW.shift;
  ELSIF TG_TABLE_NAME = 'base_daily_production_entries' THEN
    SELECT production_date, shift INTO v_date, v_shift FROM public.base_production_batches
    WHERE org_id = NEW.org_id AND id = NEW.batch_id;
  ELSE
    v_date := NEW.production_date;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text || ':base-operator:' || NEW.worker_id::text, 0));
  SELECT * INTO v_worker FROM public.base_production_workers
  WHERE org_id = NEW.org_id AND id = NEW.worker_id;
  IF NOT FOUND OR NOT v_worker.operator_eligible
    OR (v_worker.operator_effective_from IS NOT NULL AND v_date < v_worker.operator_effective_from)
    OR (v_worker.start_date IS NOT NULL AND v_date < v_worker.start_date)
    OR (v_worker.end_date IS NOT NULL AND v_date > v_worker.end_date)
    OR (v_shift IS NOT NULL AND v_worker.shift_availability <> 'both' AND v_shift <> v_worker.shift_availability)
    OR (TG_TABLE_NAME = 'base_worker_machine_assignments' AND NOT v_worker.is_active) THEN
    RAISE EXCEPTION 'Choose an approved operator available for this date and shift.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_piece_worker() FROM PUBLIC, anon, authenticated, service_role;

-- Present zero is distinct from legacy inheritance. These are rupees per metre;
-- no pick conversion or currency scaling is changed by this increment.
CREATE OR REPLACE FUNCTION private.base_operator_piece_rate(p_pay_type text, p_job_rate numeric, p_legacy_rate numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT CASE WHEN p_pay_type = 'fixed_monthly' THEN 0 ELSE coalesce(p_job_rate, p_legacy_rate) END;
$$;
REVOKE ALL ON FUNCTION private.base_operator_piece_rate(text,numeric,numeric) FROM PUBLIC, anon, authenticated, service_role;

-- Future production stores applicability even when the shared job wage is
-- positive. Historical rows keep their original rate, quantity and attribution.
ALTER TABLE public.base_production_entries
  ADD COLUMN pay_basis_snapshot text NOT NULL DEFAULT 'piece_rate' CHECK (pay_basis_snapshot IN ('piece_rate','fixed_monthly')),
  ADD COLUMN piece_earning_state text NOT NULL DEFAULT 'applicable' CHECK (piece_earning_state IN ('applicable','inapplicable'));
ALTER TABLE public.base_daily_production_entries
  ADD COLUMN pay_basis_snapshot text NOT NULL DEFAULT 'piece_rate' CHECK (pay_basis_snapshot IN ('piece_rate','fixed_monthly')),
  ADD COLUMN piece_earning_state text NOT NULL DEFAULT 'applicable' CHECK (piece_earning_state IN ('applicable','inapplicable'));
ALTER TABLE public.base_daily_production_allocations
  ADD COLUMN pay_basis_snapshot text NOT NULL DEFAULT 'piece_rate' CHECK (pay_basis_snapshot IN ('piece_rate','fixed_monthly')),
  ADD COLUMN piece_earning_state text NOT NULL DEFAULT 'applicable' CHECK (piece_earning_state IN ('applicable','inapplicable'));

CREATE OR REPLACE FUNCTION private.snapshot_base_operator_pay_basis()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'base_daily_production_allocations' THEN
      SELECT pay_basis_snapshot INTO NEW.pay_basis_snapshot FROM public.base_daily_production_entries
      WHERE org_id = NEW.org_id AND id = NEW.entry_id AND worker_id = NEW.worker_id;
    ELSE
      SELECT pay_type INTO NEW.pay_basis_snapshot FROM public.base_production_workers
      WHERE org_id = NEW.org_id AND id = NEW.worker_id;
    END IF;
  ELSE
    NEW.pay_basis_snapshot := OLD.pay_basis_snapshot;
  END IF;
  NEW.piece_earning_state := CASE WHEN NEW.pay_basis_snapshot = 'fixed_monthly' THEN 'inapplicable' ELSE 'applicable' END;
  IF NEW.piece_earning_state = 'inapplicable' THEN NEW.worker_rate_snapshot := 0; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.snapshot_base_operator_pay_basis() FROM PUBLIC, anon, authenticated, service_role;
-- Run after the legacy rate validation trigger so a job wage cannot reappear.
CREATE TRIGGER zz_snapshot_base_operator_pay_basis BEFORE INSERT OR UPDATE ON public.base_production_entries
FOR EACH ROW EXECUTE FUNCTION private.snapshot_base_operator_pay_basis();
CREATE TRIGGER zz_snapshot_base_operator_pay_basis BEFORE INSERT OR UPDATE ON public.base_daily_production_entries
FOR EACH ROW EXECUTE FUNCTION private.snapshot_base_operator_pay_basis();
CREATE TRIGGER zz_snapshot_base_operator_pay_basis BEFORE INSERT OR UPDATE ON public.base_daily_production_allocations
FOR EACH ROW EXECUTE FUNCTION private.snapshot_base_operator_pay_basis();

-- Retain the authoritative audited writer, its paid-row preservation, tenant
-- checks, locks, context resolution and request semantics. Assert every anchor
-- so schema drift rolls back the migration instead of applying a partial edit.
DO $migration$
DECLARE original text; definition text; anchor text;
BEGIN
  original := pg_get_functiondef('public.save_base_daily_production(date,text,uuid,jsonb)'::regprocedure);
  anchor := 'v_worker_rate numeric;';
  IF (length(original) - length(replace(original, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'Unexpected Base production worker declaration';
  END IF;
  definition := replace(original, anchor, anchor || ' v_worker_pay_type text;');
  anchor := 'SELECT worker.rate_per_meter' || chr(10) || '    INTO v_worker_rate';
  IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected Base production worker lookup'; END IF;
  definition := replace(definition, anchor, 'SELECT worker.rate_per_meter, worker.pay_type' || chr(10) || '    INTO v_worker_rate, v_worker_pay_type');
  anchor := 'COALESCE(NULLIF(job.worker_rate_per_meter, 0), v_worker_rate)';
  IF (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 5 THEN
    RAISE EXCEPTION 'Unexpected Base production rate resolution';
  END IF;
  definition := replace(definition, anchor, 'private.base_operator_piece_rate(v_worker_pay_type, job.worker_rate_per_meter, v_worker_rate)');
  -- Also prevent fallback-only worker totals from carrying a piece wage for fixed operators.
  anchor := '    IF NOT FOUND THEN' || chr(10) || '      RAISE EXCEPTION ''Worker not found for this organization'' USING ERRCODE = ''23503'';' || chr(10) || '    END IF;';
  IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected Base worker guard'; END IF;
  definition := replace(definition, anchor, anchor || chr(10) || '    IF v_worker_pay_type = ''fixed_monthly'' THEN v_worker_rate := 0; END IF;');
  EXECUTE definition;

  original := pg_get_functiondef('public.validate_base_production_entry()'::regprocedure);
  anchor := 'COALESCE(NULLIF(v_job.worker_rate_per_meter, 0), v_worker_rate)';
  IF position(anchor in original) = 0 THEN RAISE EXCEPTION 'Unexpected Base legacy rate resolution'; END IF;
  definition := replace(original, anchor, 'COALESCE(v_job.worker_rate_per_meter, v_worker_rate)');
  EXECUTE definition;

  original := pg_get_functiondef('private.base_production_batch_snapshot(uuid,uuid)'::regprocedure);
  anchor := '''worker_rate_snapshot'', entry.worker_rate_snapshot,';
  IF position(anchor in original) = 0 THEN RAISE EXCEPTION 'Unexpected Base production snapshot'; END IF;
  definition := replace(original, anchor, anchor || chr(10) ||
    '        ''pay_basis_snapshot'', entry.pay_basis_snapshot, ''piece_earning_state'', entry.piece_earning_state,');
  anchor := '''worker_rate_snapshot'', allocation.worker_rate_snapshot';
  IF position(anchor in definition) = 0 THEN RAISE EXCEPTION 'Unexpected Base allocation snapshot'; END IF;
  definition := replace(definition, anchor, anchor ||
    ', ''pay_basis_snapshot'', allocation.pay_basis_snapshot, ''piece_earning_state'', allocation.piece_earning_state');
  EXECUTE definition;
END;
$migration$;
-- Existing grants are preserved by CREATE OR REPLACE; no new public write path.
