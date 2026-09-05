-- Allow Base production logging to exceed initial planned job targets.
-- Extra woven metres often arise when exhausting a beam or producing market stock,
-- and must be accounted for so piece-rate worker payroll is accurately calculated.

CREATE OR REPLACE FUNCTION public.assert_base_daily_production_allocation_totals(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_org_id uuid;
  v_worker_id uuid;
  v_mode text;
  v_status text;
  v_entry_meters numeric;
  v_allocation_count integer;
  v_allocation_meters numeric;
BEGIN
  IF p_entry_id IS NULL THEN
    RETURN;
  END IF;

  SELECT entry.org_id, entry.worker_id, entry.allocation_mode, entry.entry_status, entry.meters
  INTO v_org_id, v_worker_id, v_mode, v_status, v_entry_meters
  FROM public.base_daily_production_entries AS entry
  WHERE entry.id = p_entry_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*), COALESCE(sum(allocation.meters), 0)
  INTO v_allocation_count, v_allocation_meters
  FROM public.base_daily_production_allocations AS allocation
  WHERE allocation.entry_id = p_entry_id;

  IF EXISTS (
    SELECT 1
    FROM public.base_daily_production_allocations AS allocation
    WHERE allocation.entry_id = p_entry_id
      AND allocation.worker_id IS DISTINCT FROM v_worker_id
  ) THEN
    RAISE EXCEPTION 'Machine allocations must belong to the worker roll-up'
      USING ERRCODE = '22023';
  END IF;

  IF v_mode = 'machine_breakdown' THEN
    IF v_status IS DISTINCT FROM 'entered'
       OR v_allocation_count < 1
       OR abs(v_allocation_meters - COALESCE(v_entry_meters, 0)) > 0.005 THEN
      RAISE EXCEPTION 'Machine allocation metres must equal the worker total'
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_allocation_count > 0 THEN
    RAISE EXCEPTION 'Worker-total entries cannot contain machine allocations'
      USING ERRCODE = '22023';
  END IF;

  -- Over-target production is allowed: woven output can exceed the initial target
  -- to account for beam exhaustion and extra stock, ensuring accurate worker pay.
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_base_daily_production_allocation_totals(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
