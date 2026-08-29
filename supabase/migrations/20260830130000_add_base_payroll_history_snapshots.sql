-- Comprehensive Base payroll history.
--
-- A settlement already freezes the financial totals. These line records also
-- freeze the worker, machine, costing, metre, and weaver-rate explanation that
-- produced those totals, so later setup edits cannot rewrite payroll history.

ALTER TABLE public.base_payroll_settlements
  ADD COLUMN IF NOT EXISTS worker_name_snapshot text,
  ADD COLUMN IF NOT EXISTS advance_balance_before numeric(14,2),
  ADD COLUMN IF NOT EXISTS remaining_advance_balance numeric(14,2);

CREATE TABLE public.base_payroll_settlement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  settlement_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  production_date date NOT NULL,
  shift text CHECK (shift IS NULL OR shift IN ('day', 'night')),
  machine_id uuid,
  machine_label text NOT NULL,
  job_id uuid,
  costing_label text NOT NULL,
  meters numeric(14,2) NOT NULL CHECK (meters >= 0),
  worker_rate_snapshot numeric(12,2) NOT NULL CHECK (worker_rate_snapshot >= 0),
  gross_pay numeric(14,2) NOT NULL CHECK (gross_pay >= 0),
  source_kind text NOT NULL CHECK (source_kind IN ('legacy_entry', 'worker_total', 'machine_allocation')),
  source_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, source_kind, source_id),
  CONSTRAINT base_payroll_settlement_lines_settlement_same_org_fkey
    FOREIGN KEY (org_id, settlement_id)
    REFERENCES public.base_payroll_settlements(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT base_payroll_settlement_lines_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX base_payroll_settlement_lines_settlement_idx
  ON public.base_payroll_settlement_lines(org_id, settlement_id, production_date, machine_label);

ALTER TABLE public.base_payroll_settlement_lines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.base_payroll_settlement_lines
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.base_payroll_settlement_lines TO authenticated;

CREATE POLICY base_payroll_settlement_lines_owner_read
  ON public.base_payroll_settlement_lines
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

CREATE OR REPLACE FUNCTION private.prepare_base_payroll_settlement_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_pending numeric := 0;
BEGIN
  SELECT worker.name
  INTO NEW.worker_name_snapshot
  FROM public.base_production_workers AS worker
  WHERE worker.org_id = NEW.org_id
    AND worker.id = NEW.worker_id;

  IF NEW.worker_name_snapshot IS NULL THEN
    RAISE EXCEPTION 'Worker not found while preparing payroll snapshot'
      USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)
  INTO v_pending
  FROM public.base_worker_advances AS advance
  WHERE advance.org_id = NEW.org_id
    AND advance.worker_id = NEW.worker_id
    AND advance.status = 'pending'
    AND advance.recovered_amount < advance.amount;

  NEW.advance_balance_before := round(v_pending, 2);
  NEW.remaining_advance_balance := round(GREATEST(v_pending - NEW.advance_deducted, 0), 2);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.capture_base_payroll_settlement_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
  INSERT INTO public.base_payroll_settlement_lines (
    org_id, settlement_id, worker_id, production_date, shift,
    machine_id, machine_label, job_id, costing_label, meters,
    worker_rate_snapshot, gross_pay, source_kind, source_id
  )
  SELECT
    NEW.org_id,
    NEW.id,
    NEW.worker_id,
    source.production_date,
    source.shift,
    source.machine_id,
    source.machine_label,
    source.job_id,
    source.costing_label,
    round(source.meters, 2),
    round(source.worker_rate_snapshot, 2),
    round(source.meters * source.worker_rate_snapshot, 2),
    source.source_kind,
    source.source_id
  FROM (
    SELECT
      entry.production_date,
      NULL::text AS shift,
      NULL::uuid AS machine_id,
      'Unassigned machine'::text AS machine_label,
      entry.job_id,
      COALESCE(job.quality_label, 'Production job')::text AS costing_label,
      entry.meters,
      entry.worker_rate_snapshot,
      'legacy_entry'::text AS source_kind,
      entry.id AS source_id
    FROM public.base_production_entries AS entry
    LEFT JOIN public.base_production_jobs AS job
      ON job.org_id = entry.org_id AND job.id = entry.job_id
    WHERE entry.org_id = NEW.org_id
      AND entry.worker_id = NEW.worker_id
      AND entry.production_date BETWEEN NEW.period_start AND NEW.period_end

    UNION ALL

    SELECT
      batch.production_date,
      batch.shift,
      daily.machine_id,
      COALESCE(daily.machine_label, 'Unassigned machine')::text,
      daily.job_id,
      COALESCE(daily.job_label, job.quality_label, 'Production job')::text,
      daily.meters,
      daily.worker_rate_snapshot,
      'worker_total'::text,
      daily.id
    FROM public.base_daily_production_entries AS daily
    JOIN public.base_production_batches AS batch
      ON batch.org_id = daily.org_id AND batch.id = daily.batch_id
    LEFT JOIN public.base_production_jobs AS job
      ON job.org_id = daily.org_id AND job.id = daily.job_id
    WHERE daily.org_id = NEW.org_id
      AND daily.worker_id = NEW.worker_id
      AND daily.entry_status = 'entered'
      AND daily.allocation_mode = 'worker_total'
      AND batch.production_date BETWEEN NEW.period_start AND NEW.period_end

    UNION ALL

    SELECT
      batch.production_date,
      batch.shift,
      allocation.machine_id,
      allocation.machine_label,
      allocation.job_id,
      allocation.job_label,
      allocation.meters,
      allocation.worker_rate_snapshot,
      'machine_allocation'::text,
      allocation.id
    FROM public.base_daily_production_allocations AS allocation
    JOIN public.base_daily_production_entries AS daily
      ON daily.org_id = allocation.org_id AND daily.id = allocation.entry_id
    JOIN public.base_production_batches AS batch
      ON batch.org_id = daily.org_id AND batch.id = daily.batch_id
    WHERE allocation.org_id = NEW.org_id
      AND allocation.worker_id = NEW.worker_id
      AND daily.entry_status = 'entered'
      AND daily.allocation_mode = 'machine_breakdown'
      AND batch.production_date BETWEEN NEW.period_start AND NEW.period_end
  ) AS source
  ON CONFLICT (settlement_id, source_kind, source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prepare_base_payroll_settlement_snapshot
  ON public.base_payroll_settlements;
CREATE TRIGGER prepare_base_payroll_settlement_snapshot
  BEFORE INSERT ON public.base_payroll_settlements
  FOR EACH ROW
  EXECUTE FUNCTION private.prepare_base_payroll_settlement_snapshot();

DROP TRIGGER IF EXISTS capture_base_payroll_settlement_lines
  ON public.base_payroll_settlements;
CREATE TRIGGER capture_base_payroll_settlement_lines
  AFTER INSERT ON public.base_payroll_settlements
  FOR EACH ROW
  EXECUTE FUNCTION private.capture_base_payroll_settlement_lines();

-- Best-effort backfill for settlements created before line snapshots existed.
-- The frozen settlement totals remain authoritative if old production was ever
-- edited; all new settlements are captured atomically by the trigger above.
UPDATE public.base_payroll_settlements AS settlement
SET worker_name_snapshot = worker.name,
    advance_balance_before = settlement.advance_deducted,
    remaining_advance_balance = 0
FROM public.base_production_workers AS worker
WHERE worker.org_id = settlement.org_id
  AND worker.id = settlement.worker_id
  AND settlement.worker_name_snapshot IS NULL;

INSERT INTO public.base_payroll_settlement_lines (
  org_id, settlement_id, worker_id, production_date, shift,
  machine_id, machine_label, job_id, costing_label, meters,
  worker_rate_snapshot, gross_pay, source_kind, source_id
)
SELECT
  source.org_id,
  source.settlement_id,
  source.worker_id,
  source.production_date,
  source.shift,
  source.machine_id,
  source.machine_label,
  source.job_id,
  source.costing_label,
  round(source.meters, 2),
  round(source.worker_rate_snapshot, 2),
  round(source.meters * source.worker_rate_snapshot, 2),
  source.source_kind,
  source.source_id
FROM (
  SELECT settlement.org_id, settlement.id AS settlement_id, settlement.worker_id,
         entry.production_date, NULL::text AS shift, NULL::uuid AS machine_id,
         'Unassigned machine'::text AS machine_label, entry.job_id,
         COALESCE(job.quality_label, 'Production job')::text AS costing_label,
         entry.meters, entry.worker_rate_snapshot,
         'legacy_entry'::text AS source_kind, entry.id AS source_id
  FROM public.base_payroll_settlements AS settlement
  JOIN public.base_production_entries AS entry
    ON entry.org_id = settlement.org_id
   AND entry.worker_id = settlement.worker_id
   AND entry.production_date BETWEEN settlement.period_start AND settlement.period_end
  LEFT JOIN public.base_production_jobs AS job
    ON job.org_id = entry.org_id AND job.id = entry.job_id

  UNION ALL

  SELECT settlement.org_id, settlement.id, settlement.worker_id,
         batch.production_date, batch.shift, daily.machine_id,
         COALESCE(daily.machine_label, 'Unassigned machine')::text,
         daily.job_id, COALESCE(daily.job_label, job.quality_label, 'Production job')::text,
         daily.meters, daily.worker_rate_snapshot,
         'worker_total'::text, daily.id
  FROM public.base_payroll_settlements AS settlement
  JOIN public.base_daily_production_entries AS daily
    ON daily.org_id = settlement.org_id
   AND daily.worker_id = settlement.worker_id
   AND daily.entry_status = 'entered'
   AND daily.allocation_mode = 'worker_total'
  JOIN public.base_production_batches AS batch
    ON batch.org_id = daily.org_id AND batch.id = daily.batch_id
   AND batch.production_date BETWEEN settlement.period_start AND settlement.period_end
  LEFT JOIN public.base_production_jobs AS job
    ON job.org_id = daily.org_id AND job.id = daily.job_id

  UNION ALL

  SELECT settlement.org_id, settlement.id, settlement.worker_id,
         batch.production_date, batch.shift, allocation.machine_id,
         allocation.machine_label, allocation.job_id, allocation.job_label,
         allocation.meters, allocation.worker_rate_snapshot,
         'machine_allocation'::text, allocation.id
  FROM public.base_payroll_settlements AS settlement
  JOIN public.base_daily_production_allocations AS allocation
    ON allocation.org_id = settlement.org_id
   AND allocation.worker_id = settlement.worker_id
  JOIN public.base_daily_production_entries AS daily
    ON daily.org_id = allocation.org_id
   AND daily.id = allocation.entry_id
   AND daily.entry_status = 'entered'
   AND daily.allocation_mode = 'machine_breakdown'
  JOIN public.base_production_batches AS batch
    ON batch.org_id = daily.org_id AND batch.id = daily.batch_id
   AND batch.production_date BETWEEN settlement.period_start AND settlement.period_end
) AS source
ON CONFLICT (settlement_id, source_kind, source_id) DO NOTHING;

ALTER TABLE public.base_payroll_settlements
  ALTER COLUMN worker_name_snapshot SET NOT NULL,
  ALTER COLUMN advance_balance_before SET NOT NULL,
  ALTER COLUMN remaining_advance_balance SET NOT NULL;

REVOKE ALL ON FUNCTION private.prepare_base_payroll_settlement_snapshot()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.capture_base_payroll_settlement_lines()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.base_payroll_settlement_lines IS
  'Immutable worker-machine-costing earning lines captured with each Base payroll settlement.';
