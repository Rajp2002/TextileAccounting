-- Block Base payroll settlement when a positive production source cannot be
-- reconciled to a saved worker rate and, for machine-first rows, an exact set
-- of machine/costing allocation snapshots.

CREATE OR REPLACE FUNCTION private.guard_base_payroll_settlement_readiness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.base_daily_production_entries AS daily
    JOIN public.base_production_batches AS batch
      ON batch.org_id = daily.org_id
     AND batch.id = daily.batch_id
    WHERE daily.org_id = NEW.org_id
      AND daily.worker_id = NEW.worker_id
      AND daily.entry_status = 'entered'
      AND daily.meters > 0
      AND batch.production_date BETWEEN NEW.period_start AND NEW.period_end
      AND (
        (daily.allocation_mode = 'worker_total' AND daily.worker_rate_snapshot <= 0)
        OR (
          daily.allocation_mode = 'machine_breakdown'
          AND (
            NOT EXISTS (
              SELECT 1
              FROM public.base_daily_production_allocations AS allocation
              WHERE allocation.org_id = daily.org_id
                AND allocation.entry_id = daily.id
            )
            OR ABS(COALESCE((
              SELECT SUM(allocation.meters)
              FROM public.base_daily_production_allocations AS allocation
              WHERE allocation.org_id = daily.org_id
                AND allocation.entry_id = daily.id
            ), 0) - daily.meters) > 0.01
            OR EXISTS (
              SELECT 1
              FROM public.base_daily_production_allocations AS allocation
              WHERE allocation.org_id = daily.org_id
                AND allocation.entry_id = daily.id
                AND (
                  allocation.worker_id <> daily.worker_id
                  OR allocation.machine_id IS NULL
                  OR allocation.job_id IS NULL
                  OR allocation.worker_rate_snapshot <= 0
                )
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Payroll readiness review is required before this worker can be marked paid'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.base_production_entries AS entry
    WHERE entry.org_id = NEW.org_id
      AND entry.worker_id = NEW.worker_id
      AND entry.production_date BETWEEN NEW.period_start AND NEW.period_end
      AND entry.meters > 0
      AND entry.worker_rate_snapshot <= 0
  ) THEN
    RAISE EXCEPTION 'Payroll readiness review is required before this worker can be marked paid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_base_payroll_settlement_readiness
  ON public.base_payroll_settlements;
CREATE TRIGGER guard_base_payroll_settlement_readiness
  BEFORE INSERT ON public.base_payroll_settlements
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_base_payroll_settlement_readiness();

REVOKE ALL ON FUNCTION private.guard_base_payroll_settlement_readiness()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.guard_base_payroll_settlement_readiness() IS
  'Rejects Base settlements whose positive production cannot be reconciled to exact saved payroll sources.';
