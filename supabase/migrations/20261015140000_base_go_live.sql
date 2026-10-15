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
-- a factory with only fixed-salary staff has settlements and days off but no production, and the
-- assignment Undo re-inserts rows dated before the first production.
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

  -- Payroll periods begin at go-live, with no stub period for the setup days.
  UPDATE public.base_payroll_cycle_configs
  SET effective_from = p_go_live, updated_at = now()
  WHERE org_id = p_org_id AND effective_until IS NULL;

  RETURN p_go_live;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_base_go_live(uuid, date, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.schedule_base_go_live(uuid, date, uuid) TO service_role;

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

COMMIT;
