-- A paid Base payroll period makes its daily machine sheets immutable. Keep the
-- batch status aligned with the settlement boundary so the database, server
-- guard, and owner UI communicate the same state.

CREATE OR REPLACE FUNCTION private.finalize_base_production_batches_after_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
  UPDATE public.base_production_batches AS batch
  SET status = 'finalized',
      updated_by = COALESCE(NEW.created_by, batch.updated_by),
      updated_at = now()
  WHERE batch.org_id = NEW.org_id
    AND batch.production_date >= NEW.period_start
    AND batch.production_date <= NEW.period_end
    AND batch.status IS DISTINCT FROM 'finalized'
    AND EXISTS (
      SELECT 1
      FROM public.base_daily_production_entries AS entry
      WHERE entry.org_id = batch.org_id
        AND entry.batch_id = batch.id
        AND entry.worker_id = NEW.worker_id
    );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.finalize_base_production_batches_after_settlement()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS base_payroll_settlement_finalize_batches
  ON public.base_payroll_settlements;

CREATE TRIGGER base_payroll_settlement_finalize_batches
  AFTER INSERT ON public.base_payroll_settlements
  FOR EACH ROW
  EXECUTE FUNCTION private.finalize_base_production_batches_after_settlement();

COMMENT ON FUNCTION private.finalize_base_production_batches_after_settlement() IS
  'Finalizes Base daily batches covered by a newly inserted worker payroll settlement.';
