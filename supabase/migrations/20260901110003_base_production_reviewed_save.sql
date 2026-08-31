-- Retain request receipts after later corrections, and compare the revision
-- under the same shift lock used by the audited writer.
CREATE TABLE public.base_production_save_receipts (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, client_request_id),
  FOREIGN KEY (org_id, batch_id) REFERENCES public.base_production_batches(org_id, id) ON DELETE CASCADE
);
CREATE INDEX base_production_save_receipts_batch_idx ON public.base_production_save_receipts(org_id, batch_id);
ALTER TABLE public.base_production_save_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.base_production_save_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_base_daily_production_reviewed(
  p_production_date date,
  p_shift text,
  p_client_request_id uuid,
  p_entries jsonb,
  p_correction_reason text,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_updated_at timestamptz;
  v_payload jsonb;
  v_receipt public.base_production_save_receipts%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  IF p_production_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('day', 'night') OR p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A date, shift and request identifier are required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':base-daily:' || p_production_date::text || ':' || p_shift, 0));
  v_payload := jsonb_build_object('date', p_production_date, 'shift', p_shift, 'entries', p_entries,
    'reason', p_correction_reason, 'expected_updated_at', p_expected_updated_at);
  SELECT * INTO v_receipt FROM public.base_production_save_receipts
  WHERE org_id = v_org_id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF v_receipt.request_payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'This save request already recorded different production. Reload the shift.' USING ERRCODE = '40001';
    END IF;
    RETURN v_receipt.response || jsonb_build_object('idempotent', true);
  END IF;
  SELECT updated_at INTO v_updated_at FROM public.base_production_batches
  WHERE org_id = v_org_id AND production_date = p_production_date AND shift = p_shift FOR UPDATE;
  IF v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The production shift changed after it was opened. Reload before correcting it.' USING ERRCODE = '40001';
  END IF;
  v_result := public.save_base_daily_production_with_reason(p_production_date, p_shift, p_client_request_id, p_entries, p_correction_reason);
  INSERT INTO public.base_production_save_receipts(org_id, client_request_id, batch_id, request_payload, response)
  VALUES (v_org_id, p_client_request_id, (v_result ->> 'batch_id')::uuid, v_payload, v_result);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz) TO authenticated;
