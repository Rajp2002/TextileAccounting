-- Base Phase 4: preserve an atomic, owner-visible receipt for every daily
-- production save and correction. The existing authoritative save function is
-- retained as an internal implementation detail and is no longer callable
-- directly through the Data API.

CREATE TABLE public.base_production_batch_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  change_kind text NOT NULL CHECK (change_kind IN ('created', 'corrected')),
  correction_reason text CHECK (
    correction_reason IS NULL
    OR char_length(btrim(correction_reason)) BETWEEN 3 AND 240
  ),
  before_snapshot jsonb,
  after_snapshot jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (batch_id, revision_number),
  CONSTRAINT base_production_batch_revisions_batch_same_org_fkey
    FOREIGN KEY (org_id, batch_id)
    REFERENCES public.base_production_batches(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_production_batch_revisions_reason_check
    CHECK (
      (change_kind = 'created' AND correction_reason IS NULL AND before_snapshot IS NULL)
      OR
      (change_kind = 'corrected' AND correction_reason IS NOT NULL AND before_snapshot IS NOT NULL)
    )
);

CREATE INDEX base_production_batch_revisions_org_batch_idx
  ON public.base_production_batch_revisions(org_id, batch_id, revision_number DESC);
CREATE INDEX base_production_batch_revisions_changed_by_idx
  ON public.base_production_batch_revisions(changed_by)
  WHERE changed_by IS NOT NULL;

ALTER TABLE public.base_production_batch_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.base_production_batch_revisions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.base_production_batch_revisions TO authenticated;

CREATE POLICY base_production_batch_revisions_owner_read
  ON public.base_production_batch_revisions
  FOR SELECT
  TO authenticated
  USING ((SELECT private.base_production_core_access(org_id)));

CREATE OR REPLACE FUNCTION private.base_production_batch_snapshot(
  p_org_id uuid,
  p_batch_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $function$
  SELECT jsonb_build_object(
    'total_meters', COALESCE(SUM(COALESCE(entry.meters, 0)), 0),
    'entered_count', COUNT(*) FILTER (WHERE entry.entry_status = 'entered'),
    'zero_count', COUNT(*) FILTER (WHERE entry.entry_status = 'zero'),
    'absent_count', COUNT(*) FILTER (WHERE entry.entry_status = 'absent'),
    'worker_count', COUNT(*),
    'entries', COALESCE(jsonb_agg(
      jsonb_build_object(
        'worker_id', entry.worker_id,
        'entry_status', entry.entry_status,
        'meters', entry.meters,
        'worker_rate_snapshot', entry.worker_rate_snapshot,
        'allocation_mode', entry.allocation_mode,
        'notes', entry.notes,
        'allocations', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'machine_id', allocation.machine_id,
            'machine_label', allocation.machine_label,
            'job_id', allocation.job_id,
            'job_label', allocation.job_label,
            'meters', allocation.meters,
            'worker_rate_snapshot', allocation.worker_rate_snapshot
          ) ORDER BY allocation.machine_label, allocation.id)
          FROM public.base_daily_production_allocations AS allocation
          WHERE allocation.org_id = entry.org_id
            AND allocation.entry_id = entry.id
        ), '[]'::jsonb)
      ) ORDER BY entry.worker_id
    ) FILTER (WHERE entry.id IS NOT NULL), '[]'::jsonb)
  )
  FROM public.base_production_batches AS batch
  LEFT JOIN public.base_daily_production_entries AS entry
    ON entry.org_id = batch.org_id
   AND entry.batch_id = batch.id
  WHERE batch.org_id = p_org_id
    AND batch.id = p_batch_id;
$function$;

REVOKE ALL ON FUNCTION private.base_production_batch_snapshot(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.require_base_production_correction_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_reason text := NULLIF(btrim(current_setting('app.base_correction_reason', true)), '');
BEGIN
  -- Cascading workspace/batch deletion is not a production correction. The
  -- parent row is already absent when its cascade reaches this child trigger.
  IF NOT EXISTS (
    SELECT 1
    FROM public.base_production_batches AS batch
    WHERE batch.org_id = OLD.org_id
      AND batch.id = OLD.batch_id
  ) THEN
    RETURN OLD;
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'Explain why this saved production sheet is being corrected'
      USING ERRCODE = '22023';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS require_base_production_correction_reason
  ON public.base_daily_production_entries;
CREATE TRIGGER require_base_production_correction_reason
  BEFORE DELETE ON public.base_daily_production_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.require_base_production_correction_reason();

REVOKE ALL ON FUNCTION private.require_base_production_correction_reason()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_base_daily_production_with_reason(
  p_production_date date,
  p_shift text,
  p_client_request_id uuid,
  p_entries jsonb,
  p_correction_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_existing_batch_id uuid;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_result jsonb;
  v_batch_id uuid;
  v_revision_number integer;
  v_reason text := NULLIF(btrim(p_correction_reason), '');
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NOT NULL AND (char_length(v_reason) < 3 OR char_length(v_reason) > 240) THEN
    RAISE EXCEPTION 'Correction reason must be between 3 and 240 characters'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-daily:' || p_production_date::text || ':' || p_shift, 0)
  );

  SELECT batch.id
  INTO v_existing_batch_id
  FROM public.base_production_batches AS batch
  WHERE batch.org_id = v_org_id
    AND batch.production_date = p_production_date
    AND batch.shift = p_shift
  FOR UPDATE;

  IF v_existing_batch_id IS NOT NULL THEN
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'Explain why this saved production sheet is being corrected'
        USING ERRCODE = '22023';
    END IF;
    v_before_snapshot := private.base_production_batch_snapshot(v_org_id, v_existing_batch_id);
  ELSE
    v_reason := NULL;
  END IF;

  PERFORM set_config('app.base_correction_reason', COALESCE(v_reason, ''), true);

  v_result := public.save_base_daily_production(
    p_production_date,
    p_shift,
    p_client_request_id,
    p_entries
  );

  IF COALESCE((v_result ->> 'idempotent')::boolean, false) THEN
    RETURN v_result;
  END IF;

  v_batch_id := (v_result ->> 'batch_id')::uuid;
  v_after_snapshot := private.base_production_batch_snapshot(v_org_id, v_batch_id);

  SELECT COALESCE(MAX(revision.revision_number), 0) + 1
  INTO v_revision_number
  FROM public.base_production_batch_revisions AS revision
  WHERE revision.org_id = v_org_id
    AND revision.batch_id = v_batch_id;

  INSERT INTO public.base_production_batch_revisions (
    org_id,
    batch_id,
    revision_number,
    change_kind,
    correction_reason,
    before_snapshot,
    after_snapshot,
    changed_by
  )
  VALUES (
    v_org_id,
    v_batch_id,
    v_revision_number,
    CASE WHEN v_existing_batch_id IS NULL THEN 'created' ELSE 'corrected' END,
    v_reason,
    v_before_snapshot,
    v_after_snapshot,
    auth.uid()
  );

  RETURN v_result || jsonb_build_object(
    'revision_number', v_revision_number,
    'change_kind', CASE WHEN v_existing_batch_id IS NULL THEN 'created' ELSE 'corrected' END
  );
END;
$function$;

-- Keep the legacy writer available for initial saves so this migration can be
-- deployed before the application without downtime. The delete trigger above
-- blocks every correction unless the new audited wrapper supplies a reason.
REVOKE ALL ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION public.save_base_daily_production_with_reason(date, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production_with_reason(date, text, uuid, jsonb, text)
  TO authenticated;

COMMENT ON TABLE public.base_production_batch_revisions IS
  'Immutable owner-visible receipts for Base daily production creation and correction.';
COMMENT ON FUNCTION public.save_base_daily_production_with_reason(date, text, uuid, jsonb, text) IS
  'Atomically saves Base production and records the before/after correction receipt.';
