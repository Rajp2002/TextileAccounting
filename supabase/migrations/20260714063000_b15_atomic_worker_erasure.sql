-- B15: make worker erasure atomic, tenant-bound, and complete for stored PII.
-- Historical production, payroll, advance, attendance, and audit metadata stay
-- linked to the durable worker ID; personal fields and historical audit payload
-- copies are redacted in the same transaction.

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ;

ALTER TABLE public.fixed_workers
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.require_worker_age_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.erased_at IS NOT NULL THEN
    IF NEW.name <> 'ERASED WORKER'
       OR NEW.is_active IS DISTINCT FROM FALSE
       OR NEW.date_of_birth IS NOT NULL
       OR NEW.age_verification_method IS NOT NULL
       OR NEW.age_verification_reference IS NOT NULL
       OR NEW.age_verified_at IS NOT NULL
       OR NEW.age_verified_by IS NOT NULL
       OR NEW.whatsapp_number IS NOT NULL
       OR NEW.esi_number IS NOT NULL
       OR NEW.pf_number IS NOT NULL THEN
      RAISE EXCEPTION 'erased worker records cannot retain personal fields'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.date_of_birth IS NULL
     OR NEW.age_verification_method IS NULL
     OR NULLIF(btrim(NEW.age_verification_reference), '') IS NULL
     OR length(btrim(NEW.age_verification_reference)) < 4
     OR NEW.age_verified_at IS NULL
     OR NEW.age_verified_by IS NULL THEN
    RAISE EXCEPTION 'verified date of birth and age evidence reference are required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'worker must be at least 18 years old'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.date_of_birth < DATE '1900-01-01' OR NEW.date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'worker date of birth is outside the supported range'
      USING ERRCODE = '23514';
  END IF;

  NEW.age_verification_reference := btrim(NEW.age_verification_reference);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_workers_age_verification ON public.workers;
CREATE TRIGGER require_workers_age_verification
  BEFORE INSERT OR UPDATE OF date_of_birth, age_verification_method,
    age_verification_reference, age_verified_at, age_verified_by, erased_at
  ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.require_worker_age_verification();

DROP TRIGGER IF EXISTS require_fixed_workers_age_verification ON public.fixed_workers;
CREATE TRIGGER require_fixed_workers_age_verification
  BEFORE INSERT OR UPDATE OF date_of_birth, age_verification_method,
    age_verification_reference, age_verified_at, age_verified_by, erased_at
  ON public.fixed_workers
  FOR EACH ROW EXECUTE FUNCTION public.require_worker_age_verification();

CREATE OR REPLACE FUNCTION public.erase_worker_pii_atomic(
  p_worker_id BIGINT,
  p_worker_type TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_phone TEXT;
  v_erased_at TIMESTAMPTZ := clock_timestamp();
  v_history_rows BIGINT := 0;
  v_audit_rows BIGINT := 0;
  v_history_audit_rows BIGINT := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'authenticated actor mismatch' USING ERRCODE = '42501';
  END IF;

  IF p_worker_type NOT IN ('meter', 'fixed') OR p_worker_id IS NULL OR p_worker_id <= 0 THEN
    RAISE EXCEPTION 'invalid worker erasure target' USING ERRCODE = '22023';
  END IF;

  SELECT p.org_id
    INTO v_org_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'owner role required' USING ERRCODE = '42501';
  END IF;

  IF p_worker_type = 'meter' THEN
    SELECT w.whatsapp_number
      INTO v_phone
    FROM public.workers w
    WHERE w.id = p_worker_id
      AND w.org_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'worker not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.workers
    SET name = 'ERASED WORKER',
        is_active = FALSE,
        whatsapp_number = NULL,
        esi_number = NULL,
        pf_number = NULL,
        date_of_birth = NULL,
        age_verification_method = NULL,
        age_verification_reference = NULL,
        age_verified_at = NULL,
        age_verified_by = NULL,
        erased_at = v_erased_at
    WHERE id = p_worker_id AND org_id = v_org_id;

    UPDATE public.worker_consent_artifacts
    SET worker_id = NULL,
        ip_address = NULL,
        erased_at = v_erased_at
    WHERE org_id = v_org_id
      AND worker_id = p_worker_id;

    SELECT count(*) INTO v_history_rows
    FROM public.production_logs
    WHERE org_id = v_org_id
      AND COALESCE(meter_worker_id, worker_id) = p_worker_id;

    UPDATE public.production_logs
    SET client_ip = NULL
    WHERE org_id = v_org_id
      AND COALESCE(meter_worker_id, worker_id) = p_worker_id;
  ELSE
    SELECT w.whatsapp_number
      INTO v_phone
    FROM public.fixed_workers w
    WHERE w.id = p_worker_id
      AND w.org_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'worker not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.fixed_workers
    SET name = 'ERASED WORKER',
        is_active = FALSE,
        whatsapp_number = NULL,
        esi_number = NULL,
        pf_number = NULL,
        date_of_birth = NULL,
        age_verification_method = NULL,
        age_verification_reference = NULL,
        age_verified_at = NULL,
        age_verified_by = NULL,
        erased_at = v_erased_at
    WHERE id = p_worker_id AND org_id = v_org_id;

    SELECT count(*) INTO v_history_rows
    FROM public.attendance
    WHERE org_id = v_org_id
      AND fixed_worker_id = p_worker_id;

    UPDATE public.attendance
    SET client_ip = NULL
    WHERE org_id = v_org_id
      AND fixed_worker_id = p_worker_id;
  END IF;

  IF v_phone IS NOT NULL THEN
    UPDATE public.notification_consents
    SET phone = NULL,
        person_id = 'erased:' || p_worker_type || ':' || p_worker_id::TEXT,
        consent_status = 'opted_out',
        withdrawn_at = COALESCE(withdrawn_at, v_erased_at),
        updated_at = v_erased_at
    WHERE org_id = v_org_id
      AND person_type = 'worker'
      AND person_id = p_worker_id::TEXT
      AND phone = v_phone;

    UPDATE public.whatsapp_delivery_log
    SET recipient_phone = '[REDACTED]',
        payload_snapshot = jsonb_build_object('erased', TRUE)
    WHERE org_id = v_org_id
      AND recipient_phone = v_phone;
  END IF;

  UPDATE public.audit_log
  SET old_data = CASE WHEN old_data IS NULL THEN NULL ELSE
        (old_data - 'whatsapp_number' - 'esi_number' - 'pf_number'
          - 'date_of_birth' - 'age_verification_method'
          - 'age_verification_reference' - 'age_verified_at' - 'age_verified_by')
        || jsonb_build_object('name', '[ERASED]') END,
      new_data = CASE WHEN new_data IS NULL THEN NULL ELSE
        (new_data - 'whatsapp_number' - 'esi_number' - 'pf_number'
          - 'date_of_birth' - 'age_verification_method'
          - 'age_verification_reference' - 'age_verified_at' - 'age_verified_by')
        || jsonb_build_object('name', '[ERASED]') END
  WHERE org_id = v_org_id
    AND table_name = CASE WHEN p_worker_type = 'meter' THEN 'workers' ELSE 'fixed_workers' END
    AND record_id = p_worker_id::TEXT;
  GET DIAGNOSTICS v_audit_rows = ROW_COUNT;

  -- The retained history rows may already have audit snapshots containing the
  -- request IP, and clearing client_ip creates another UPDATE audit row. Remove
  -- that privacy field from every audit copy for the affected durable records.
  UPDATE public.audit_log
  SET old_data = CASE WHEN old_data IS NULL THEN NULL ELSE old_data - 'client_ip' END,
      new_data = CASE WHEN new_data IS NULL THEN NULL ELSE new_data - 'client_ip' END
  WHERE org_id = v_org_id
    AND (
      (
        p_worker_type = 'meter'
        AND table_name = 'production_logs'
        AND record_id IN (
          SELECT pl.id::TEXT
          FROM public.production_logs pl
          WHERE pl.org_id = v_org_id
            AND COALESCE(pl.meter_worker_id, pl.worker_id) = p_worker_id
        )
      )
      OR (
        p_worker_type = 'fixed'
        AND table_name = 'attendance'
        AND record_id IN (
          SELECT a.id::TEXT
          FROM public.attendance a
          WHERE a.org_id = v_org_id
            AND a.fixed_worker_id = p_worker_id
        )
      )
    );
  GET DIAGNOSTICS v_history_audit_rows = ROW_COUNT;
  v_audit_rows := v_audit_rows + v_history_audit_rows;

  INSERT INTO public.audit_log (
    org_id, table_name, record_id, action, new_data, changed_by, changed_at
  ) VALUES (
    v_org_id,
    CASE WHEN p_worker_type = 'meter' THEN 'workers' ELSE 'fixed_workers' END,
    p_worker_id::TEXT,
    'dpdp.erasure',
    jsonb_build_object(
      'worker_type', p_worker_type,
      'erased_fields', jsonb_build_array(
        'name', 'whatsapp_number', 'esi_number', 'pf_number',
        'date_of_birth', 'age_verification_method',
        'age_verification_reference', 'age_verified_at', 'age_verified_by'
      ),
      'history_rows_preserved', v_history_rows,
      'prior_audit_rows_redacted', v_audit_rows,
      'erased_at', v_erased_at
    ),
    p_actor_id,
    v_erased_at
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'worker_id', p_worker_id,
    'worker_type', p_worker_type,
    'history_rows_preserved', v_history_rows,
    'audit_rows_preserved_and_redacted', v_audit_rows,
    'erased_at', v_erased_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.erase_worker_pii_atomic(BIGINT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.erase_worker_pii_atomic(BIGINT, TEXT, UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.erase_worker_pii_atomic(BIGINT, TEXT, UUID) IS
  'Atomically anonymizes worker PII and retained payload copies while preserving tenant-scoped production/payroll/audit history.';
