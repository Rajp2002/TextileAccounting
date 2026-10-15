-- Base go-live (2026-10-15): a factory records in Weavly from the start of a pay cycle.
--
-- Setup can happen on any day, but production, payroll, orange stock and challans start on
-- organizations.base_go_live_date, which is always a pay-cycle boundary chosen by the server action
-- (lib/base-go-live.server.ts) with the TypeScript cycle engine. Everything before it stays on paper,
-- and fabric already in the godown is legacy stock (20261015120000_legacy_fabric_stock.sql).
--
--   1. The go-live date, its one-time backfill, and the service-role scheduling RPC.
--   2. Table guards that refuse records dated before go-live.
--   3. Fixed salary accrues from go-live at the earliest.
--
-- Additive. Every organization that already has a Base record gets go-live on its earliest one, so no
-- existing row falls before it and nothing changes for factories already recording.
BEGIN;

-- ── 1. Go-live date ─────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN base_go_live_date date,
  ADD COLUMN base_go_live_set_at timestamptz,
  ADD COLUMN base_go_live_set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organizations.base_go_live_date IS
  'First day Base production, payroll, orange stock and challans are recorded in Weavly. Always a pay-cycle start. NULL: not scheduled.';

CREATE FUNCTION private.base_go_live_date(p_org uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.base_go_live_date FROM public.organizations AS o WHERE o.id = p_org;
$$;
REVOKE ALL ON FUNCTION private.base_go_live_date(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Existing factories go live on their earliest Base record of any kind. Production alone is not enough:
-- a factory with only fixed-salary staff has settlements and days off but no production, the assignment
-- Undo re-inserts rows dated before the first production, a factory may dispatch challans from opening
-- stock without recording production, and an unsettled fixed-salary worker must keep accruing from the
-- joining date (salary starts at the later of joining date and go-live).
CREATE FUNCTION private.backfill_base_go_live()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  WITH firsts AS (
    SELECT org_id, min(production_date) AS first_date FROM public.base_production_batches GROUP BY org_id
    UNION ALL SELECT org_id, min(production_date) FROM public.base_production_entries GROUP BY org_id
    UNION ALL SELECT org_id, min(effective_from) FROM public.base_worker_machine_assignments GROUP BY org_id
    UNION ALL SELECT org_id, min(effective_from) FROM public.base_machine_job_contexts GROUP BY org_id
    UNION ALL SELECT org_id, min(period_start) FROM public.base_payroll_settlements GROUP BY org_id
    UNION ALL SELECT org_id, min(off_date) FROM public.base_staff_days_off GROUP BY org_id
    UNION ALL SELECT org_id, min(service_start) FROM public.base_worker_incentives GROUP BY org_id
    UNION ALL SELECT org_id, min((created_at AT TIME ZONE 'Asia/Kolkata')::date) FROM public.delivery_challans GROUP BY org_id
    UNION ALL SELECT org_id, min((created_at AT TIME ZONE 'Asia/Kolkata')::date) FROM public.quality_stock_movements GROUP BY org_id
    UNION ALL SELECT org_id, min(start_date) FROM public.base_production_workers WHERE pay_type = 'fixed_monthly' GROUP BY org_id
  ), earliest AS (
    SELECT org_id, min(first_date) AS go_live FROM firsts GROUP BY org_id
  )
  UPDATE public.organizations AS o
  SET base_go_live_date = earliest.go_live, base_go_live_set_at = now()
  FROM earliest
  WHERE o.id = earliest.org_id AND o.base_go_live_date IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
REVOKE ALL ON FUNCTION private.backfill_base_go_live() FROM PUBLIC, anon, authenticated, service_role;

SELECT private.backfill_base_go_live();

-- Sets or moves go-live while it is still ahead. The server action has already checked the owner, the
-- plan and that p_go_live is one of the cycle starts on offer; this re-checks what the database knows.
CREATE FUNCTION public.schedule_base_go_live(p_org_id uuid, p_go_live date, p_actor uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_current date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':base-go-live', 0));
  SELECT o.base_go_live_date INTO v_current FROM public.organizations AS o WHERE o.id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = '42501';
  END IF;
  IF p_go_live IS NULL OR p_go_live < v_today THEN
    RAISE EXCEPTION 'Go-live cannot be in the past.' USING ERRCODE = '22023';
  END IF;
  IF v_current IS NOT NULL AND v_current <= v_today THEN
    RAISE EXCEPTION 'Daily recording has already started.' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.base_production_batches WHERE org_id = p_org_id)
     OR EXISTS (SELECT 1 FROM public.base_production_entries WHERE org_id = p_org_id)
     OR EXISTS (SELECT 1 FROM public.base_daily_production_allocations WHERE org_id = p_org_id) THEN
    RAISE EXCEPTION 'Production is already recorded.' USING ERRCODE = '55000';
  END IF;

  UPDATE public.organizations
  SET base_go_live_date = p_go_live, base_go_live_set_at = now(), base_go_live_set_by = p_actor
  WHERE id = p_org_id;

  -- Setup changes are dated at go-live. When go-live moves earlier (a new pay cycle during setup), move them
  -- with it, or go-live day would open with no qualities or workers on the looms. Nothing is recorded yet,
  -- so no history depends on these dates. An assignment stays put if its worker joins after the new date.
  IF v_current IS NOT NULL AND p_go_live < v_current THEN
    UPDATE public.base_machine_job_contexts
    SET effective_from = p_go_live
    WHERE org_id = p_org_id AND effective_from > p_go_live AND effective_from <= v_current;
    UPDATE public.base_worker_machine_assignments AS assignment
    SET effective_from = p_go_live
    FROM public.base_production_workers AS worker
    WHERE assignment.org_id = p_org_id AND worker.org_id = p_org_id AND worker.id = assignment.worker_id
      AND assignment.effective_from > p_go_live AND assignment.effective_from <= v_current
      AND (worker.start_date IS NULL OR worker.start_date <= p_go_live)
      AND (worker.operator_effective_from IS NULL OR worker.operator_effective_from <= p_go_live);
  END IF;

  -- Payroll periods begin at go-live, with no stub period for the setup days.
  UPDATE public.base_payroll_cycle_configs
  SET effective_from = p_go_live, updated_at = now()
  WHERE org_id = p_org_id AND effective_until IS NULL;

  RETURN p_go_live;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_base_go_live(uuid, date, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.schedule_base_go_live(uuid, date, uuid) TO service_role;

-- Only schedule_base_go_live (service role) and migrations may change the go-live columns. The owner's
-- organizations update policy would otherwise let a client back-date or clear go-live directly.
CREATE FUNCTION private.guard_base_go_live_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.base_go_live_date IS NOT DISTINCT FROM OLD.base_go_live_date
     AND NEW.base_go_live_set_at IS NOT DISTINCT FROM OLD.base_go_live_set_at
     AND NEW.base_go_live_set_by IS NOT DISTINCT FROM OLD.base_go_live_set_by THEN
    RETURN NEW;
  END IF;
  IF coalesce((SELECT auth.jwt()) ->> 'role', '') IN ('', 'service_role')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles AS r WHERE r.rolname = current_user AND r.rolsuper) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'The daily recording start date can only be changed from the production page.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_go_live_columns() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_base_go_live_columns
BEFORE UPDATE OF base_go_live_date, base_go_live_set_at, base_go_live_set_by ON public.organizations
FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live_columns();

-- Supervisors are not tenant members and cannot read organizations, so the sheet asks for the date.
CREATE FUNCTION public.get_supervisor_go_live()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.base_go_live_date FROM public.organizations AS o WHERE o.id = private.active_supervisor_org();
$$;
REVOKE ALL ON FUNCTION public.get_supervisor_go_live() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_supervisor_go_live() TO authenticated;

-- ── 2. Nothing is recorded before go-live ───────────────────────────────────
-- One trigger guards every writer of these tables, the owner and supervisor sheets, the assignment board,
-- Switch shifts, loom qualities, days off, incentives and settlement included. Production also needs a
-- scheduled go-live; the other records only check the date once one exists, since setup changes made
-- before scheduling are dated today and still cover go-live.

CREATE FUNCTION private.guard_base_go_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_go_live date := private.base_go_live_date(NEW.org_id);
  v_date date;
BEGIN
  -- The trigger argument names the row's business date column.
  v_date := (to_jsonb(NEW) ->> TG_ARGV[0])::date;
  IF v_go_live IS NULL THEN
    IF TG_TABLE_NAME = 'base_production_batches' THEN
      RAISE EXCEPTION 'Schedule daily recording before saving production.' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  IF v_date < v_go_live THEN
    RAISE EXCEPTION 'Daily recording starts on %.', to_char(v_go_live, 'YYYY-MM-DD') USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_go_live() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER guard_base_go_live BEFORE INSERT OR UPDATE OF production_date ON public.base_production_batches
  FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live('production_date');
CREATE TRIGGER guard_base_go_live BEFORE INSERT ON public.base_worker_machine_assignments
  FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live('effective_from');
CREATE TRIGGER guard_base_go_live BEFORE INSERT ON public.base_machine_job_contexts
  FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live('effective_from');
CREATE TRIGGER guard_base_go_live BEFORE INSERT ON public.base_staff_days_off
  FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live('off_date');
CREATE TRIGGER guard_base_go_live BEFORE INSERT ON public.base_worker_incentives
  FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live('service_start');
CREATE TRIGGER guard_base_go_live BEFORE INSERT ON public.base_payroll_settlements
  FOR EACH ROW EXECUTE FUNCTION private.guard_base_go_live('period_end');

-- ── 3. Fixed salary accrues from go-live ────────────────────────────────────
-- A first settlement starts at the later of the joining date and go-live; days before go-live were paid on
-- paper. lib/base-production-core.ts calculateBaseWorkerPayables applies the same rule to the review.
-- Assert the anchor appears exactly once so schema drift fails loudly, not partially.
DO $migration$
DECLARE definition text; anchor text;
BEGIN
  definition := pg_get_functiondef('public.settle_base_worker_payroll(uuid,date,text)'::regprocedure);
  anchor := 'coalesce(max(period_end) + 1, v_salary_worker.start_date)';
  IF (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'Unexpected fixed-salary period start';
  END IF;
  definition := replace(definition, anchor,
    'coalesce(max(period_end) + 1, greatest(v_salary_worker.start_date, coalesce(private.base_go_live_date(v_org_id), v_salary_worker.start_date)))');
  EXECUTE definition;
END;
$migration$;

COMMIT;
