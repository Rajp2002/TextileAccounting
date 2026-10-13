-- A worker given a last working day, or made inactive, stops holding looms after it.
--
-- Until now their dated machine assignments stayed open. Every later daily sheet for
-- that shift seated them on their looms and sent their (blank) row, and
-- private.guard_base_piece_worker rejected the whole batch with "Choose an approved
-- operator available for this date and shift." (Base walkthrough, 2026-10-13).
--
-- Assignments are dated, so they are ended, not deleted:
--   * a still-active worker keeps each loom through the last working day, so the sheet
--     and backdated corrections up to that day still seat them, and a replacement can
--     be assigned from the next day (the row is no longer "current" for the
--     one-worker-per-loom-shift index);
--   * an inactive worker, an assignment that only starts after the last day, and an
--     assignment the operator guard would no longer accept are retired (active = false),
--     the way delete_base_worker_machine_assignment and the shift rotation end rows.
-- A worker made inactive without a last working day is treated as leaving yesterday,
-- matching delete_base_worker_machine_assignment.

CREATE OR REPLACE FUNCTION private.end_departed_base_worker_assignments(p_org_id uuid, p_worker_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_worker public.base_production_workers%ROWTYPE;
  v_last_day date;
  v_ended integer;
BEGIN
  SELECT * INTO v_worker
  FROM public.base_production_workers AS worker
  WHERE worker.org_id = p_org_id AND worker.id = p_worker_id;

  IF NOT FOUND OR (v_worker.is_active AND v_worker.end_date IS NULL) THEN
    RETURN 0;
  END IF;

  v_last_day := coalesce(v_worker.end_date, (now() AT TIME ZONE 'Asia/Kolkata')::date - 1);

  -- Only rows that still reach past the last day change, so a repeat call is a no-op.
  UPDATE public.base_worker_machine_assignments AS assignment
  SET active = (
        v_worker.is_active
        AND assignment.effective_from <= v_last_day
        -- Mirror private.guard_base_piece_worker: a row it would reject is retired
        -- instead, so recording a departure can never be blocked by older data.
        AND v_worker.operator_eligible
        AND (v_worker.operator_effective_from IS NULL OR assignment.effective_from >= v_worker.operator_effective_from)
        AND (v_worker.start_date IS NULL OR assignment.effective_from >= v_worker.start_date)
        AND (v_worker.shift_availability = 'both' OR assignment.shift = v_worker.shift_availability)
      ),
      effective_to = GREATEST(assignment.effective_from, v_last_day),
      updated_by = auth.uid(),
      updated_at = now()
  WHERE assignment.org_id = p_org_id
    AND assignment.worker_id = p_worker_id
    AND assignment.active IS TRUE
    AND (assignment.effective_to IS NULL OR assignment.effective_to > v_last_day);

  GET DIAGNOSTICS v_ended = ROW_COUNT;
  RETURN v_ended;
END;
$function$;

REVOKE ALL ON FUNCTION private.end_departed_base_worker_assignments(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.end_departed_base_worker_assignments(uuid, uuid) IS
  'Ends a departed Base worker''s machine assignments after their last working day (yesterday when made inactive without one). Idempotent; called by the worker update trigger and the one-time reconcile.';

-- Runs in the same transaction as the owner's worker update, after the BEFORE
-- guards have accepted the new end date and active flag.
CREATE OR REPLACE FUNCTION private.end_base_worker_assignments_on_departure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Checked on every save, not only on a change, so re-saving a worker who already
  -- left also repairs looms they were left holding.
  IF NEW.end_date IS NOT NULL OR NOT NEW.is_active THEN
    PERFORM private.end_departed_base_worker_assignments(NEW.org_id, NEW.id);
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION private.end_base_worker_assignments_on_departure()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER end_base_worker_assignments_on_departure
  AFTER UPDATE OF end_date, is_active ON public.base_production_workers
  FOR EACH ROW EXECUTE FUNCTION private.end_base_worker_assignments_on_departure();

-- Reconcile looms already left behind (for example a worker whose last working day
-- passed while their night assignments stayed open), so the blocked shifts save once
-- this migration is applied.
DO $reconcile$
DECLARE
  v_worker record;
BEGIN
  FOR v_worker IN
    SELECT DISTINCT worker.org_id, worker.id
    FROM public.base_production_workers AS worker
    JOIN public.base_worker_machine_assignments AS assignment
      ON assignment.org_id = worker.org_id
     AND assignment.worker_id = worker.id
     AND assignment.active IS TRUE
    WHERE worker.end_date IS NOT NULL OR NOT worker.is_active
    ORDER BY worker.org_id, worker.id
  LOOP
    PERFORM private.end_departed_base_worker_assignments(v_worker.org_id, v_worker.id);
  END LOOP;
END;
$reconcile$;
