-- Fixed-salary staff: the joining date can be corrected after the worker is added.
--
-- It stays fixed once it carries money or records: the change is refused when
-- the worker has a paid settlement, or when the new date would leave a later
-- salary change, a recorded day off or recorded production before employment.
-- The first salary-history entry, and the effective date when no raise has been
-- recorded, move with the joining date so the salary rate starts on the new day.
-- Everything else in the guard is unchanged from 20260903162305.

CREATE OR REPLACE FUNCTION private.guard_base_staff_compensation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, private AS $$
DECLARE
  v_latest_paid date;
  v_history jsonb;
  v_effective_from date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text || ':base-payroll:' || NEW.id::text, 0));
  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.pay_type IS DISTINCT FROM OLD.pay_type THEN
      RAISE EXCEPTION 'Worker organization and pay type cannot be changed. Add a separate worker record.' USING ERRCODE = '22023';
    END IF;
    IF NEW.salary_history IS DISTINCT FROM OLD.salary_history THEN
      RAISE EXCEPTION 'Salary history is maintained automatically.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.pay_type = 'piece_rate' THEN
    NEW.monthly_salary := 0;
    NEW.salary_history := '[]'::jsonb;
    RETURN NEW;
  END IF;
  NEW.rate_per_meter := 0;
  IF NEW.start_date IS NULL OR NEW.monthly_salary <= 0 THEN
    RAISE EXCEPTION 'Enter a joining date and positive monthly salary.' USING ERRCODE = '22023';
  END IF;
  IF NOT NEW.is_active AND NEW.end_date IS NULL THEN
    RAISE EXCEPTION 'Enter the last working day before making salaried staff inactive.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.salary_effective_from := NEW.start_date;
    NEW.salary_history := jsonb_build_array(jsonb_build_object('effective_from', NEW.start_date, 'monthly_salary', NEW.monthly_salary));
  ELSE
    SELECT max(period_end) INTO v_latest_paid FROM public.base_payroll_settlements
    WHERE org_id = NEW.org_id AND worker_id = NEW.id AND status = 'paid';
    v_history := OLD.salary_history;
    v_effective_from := OLD.salary_effective_from;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      IF v_latest_paid IS NOT NULL THEN
        RAISE EXCEPTION 'Joining date cannot change after salary has been paid. Reverse the payment first.' USING ERRCODE = '22023';
      END IF;
      IF jsonb_array_length(v_history) > 1 AND NEW.start_date >= (v_history->1->>'effective_from')::date THEN
        RAISE EXCEPTION 'Joining date must be before the first salary change.' USING ERRCODE = '22023';
      END IF;
      IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
        RAISE EXCEPTION 'Last working day cannot be before joining date.' USING ERRCODE = '22023';
      END IF;
      IF NEW.start_date > OLD.start_date THEN
        IF EXISTS (SELECT 1 FROM public.base_staff_days_off
                   WHERE org_id = NEW.org_id AND worker_id = NEW.id AND off_date < NEW.start_date) THEN
          RAISE EXCEPTION 'Clear days off before the new joining date first.' USING ERRCODE = '22023';
        END IF;
        IF EXISTS (SELECT 1 FROM public.base_daily_production_entries entry
                   JOIN public.base_production_batches batch ON batch.org_id = entry.org_id AND batch.id = entry.batch_id
                   WHERE entry.org_id = NEW.org_id AND entry.worker_id = NEW.id AND batch.production_date < NEW.start_date)
          OR EXISTS (SELECT 1 FROM public.base_production_entries
                     WHERE org_id = NEW.org_id AND worker_id = NEW.id AND production_date < NEW.start_date) THEN
          RAISE EXCEPTION 'Production is recorded for this worker before the new joining date.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF jsonb_array_length(v_history) > 0 THEN
        v_history := jsonb_set(v_history, '{0,effective_from}', to_jsonb(NEW.start_date));
      END IF;
      IF v_effective_from IS NULL OR v_effective_from = OLD.start_date THEN
        v_effective_from := NEW.start_date;
      END IF;
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date AND (NEW.end_date IS NULL OR NEW.end_date < v_latest_paid) THEN
      RAISE EXCEPTION 'Last working day cannot remove paid days or reopen a closed employment period.' USING ERRCODE = '22023';
    END IF;
    IF OLD.end_date IS NOT NULL AND NOT OLD.is_active AND NEW.is_active THEN
      RAISE EXCEPTION 'Add a separate record for a new employment period.' USING ERRCODE = '22023';
    END IF;
    IF NEW.monthly_salary IS DISTINCT FROM OLD.monthly_salary THEN
      IF NEW.salary_effective_from IS NULL OR NEW.salary_effective_from <= v_effective_from
        OR NEW.salary_effective_from < (now() AT TIME ZONE 'Asia/Kolkata')::date
        OR NEW.salary_effective_from <= v_latest_paid THEN
        RAISE EXCEPTION 'Salary changes need an effective date from today onward, after the previous rate and all paid periods.' USING ERRCODE = '22023';
      END IF;
      NEW.salary_history := v_history || jsonb_build_array(jsonb_build_object('effective_from', NEW.salary_effective_from, 'monthly_salary', NEW.monthly_salary));
    ELSE
      NEW.salary_history := v_history;
      NEW.salary_effective_from := v_effective_from;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_staff_compensation() FROM PUBLIC, anon, authenticated, service_role;
