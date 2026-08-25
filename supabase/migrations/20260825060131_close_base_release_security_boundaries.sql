-- Close the two High release blockers found by the Base-plan production run.
--
-- 1. Production-order RPCs must enforce Full Suite entitlement at the RPC
--    boundary, not rely on the UI or on downstream table triggers.
-- 2. A Base owner must not be able to label arbitrary client JSON as a
--    verified canonical costing. Only a server action that recomputed the
--    costing may register the exact payload accepted by the save RPC.

-- ---------------------------------------------------------------------------
-- Server attestations for canonical Base costing payloads
-- ---------------------------------------------------------------------------

CREATE TABLE public.estimator_costing_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX estimator_costing_attestations_expiry_idx
  ON public.estimator_costing_attestations(expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.estimator_costing_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estimator_costing_attestations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimator_costing_attestations
  TO service_role;

CREATE OR REPLACE FUNCTION public.register_estimator_costing_attestation(
  p_user_id uuid,
  p_org_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_attestation_id uuid;
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    RAISE EXCEPTION 'Costing attestations are server-only'
      USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object'
     OR COALESCE(p_payload ->> 'record_kind', '') <> 'costing'
     OR NULLIF(p_payload ->> 'client_request_id', '') IS NULL THEN
    RAISE EXCEPTION 'A complete costing payload is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS membership
    WHERE membership.id = p_user_id
      AND membership.org_id = p_org_id
      AND membership.role::text = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the current organization owner can save a costing'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.org_has_subscription_tier(p_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator subscription is required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.estimator_costing_attestations (org_id, user_id, payload)
  VALUES (p_org_id, p_user_id, p_payload)
  RETURNING id INTO v_attestation_id;

  RETURN v_attestation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.register_estimator_costing_attestation(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_estimator_costing_attestation(uuid, uuid, jsonb)
  TO service_role;

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS server_attestation_id uuid;

COMMENT ON COLUMN public.estimator_quotes.server_attestation_id IS
  'Single-use server attestation that bound the exact canonical costing payload. Not customer-facing.';

-- Base quote creation is owned by the SECURITY DEFINER revision RPC. Removing
-- direct INSERT prevents a browser client from bypassing that boundary while
-- preserving tenant-scoped SELECT and the established metadata UPDATE paths.
REVOKE INSERT ON TABLE public.estimator_quotes FROM authenticated;

-- Superseded by save_estimator_costing_revision_v2. Leaving this older
-- mass-population entry point executable would bypass the attestation check.
REVOKE ALL ON FUNCTION public.save_estimator_costing_revision_with_quality(
  jsonb, uuid, timestamptz, uuid, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;

-- Add the attestation check and an explicit payload-key allowlist to the
-- established atomic save function without copying its large concurrency body.
DO $harden_costing_save$
DECLARE
  v_function record;
  v_body text;
BEGIN
  SELECT
    proc.oid,
    proc.prosrc,
    proc.provolatile,
    pg_get_function_arguments(proc.oid) AS arguments,
    pg_get_function_result(proc.oid) AS result_type
  INTO STRICT v_function
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  JOIN pg_language AS language ON language.oid = proc.prolang
  WHERE namespace.nspname = 'public'
    AND language.lanname = 'plpgsql'
    AND proc.proname = 'save_estimator_costing_revision_v2';

  v_body := replace(
    v_function.prosrc,
    E'  IF COALESCE(p_quote_payload ->> \'record_kind\', \'\') <> \'costing\' THEN',
    E'  IF EXISTS (\n'
      || E'    SELECT 1 FROM jsonb_object_keys(p_quote_payload) AS supplied(key)\n'
      || E'    WHERE supplied.key <> ALL (ARRAY[\n'
      || E'      \'org_id\', \'record_kind\', \'party_name\', \'quality_label\', \'template_id\',\n'
      || E'      \'warp_instruction\', \'weft_instruction\', \'warp_rows\', \'weft_rows\',\n'
      || E'      \'per_pick_cost_paise\', \'tape_length_m\', \'warp_crimp_pct\', \'yarn_shortage_pct\',\n'
      || E'      \'warping_rate_per_kg\', \'sizing_rate_per_kg\', \'winding_rate_per_kg\',\n'
      || E'      \'processing_rate_per_m\', \'finishing_rate_per_m\', \'overhead_items\',\n'
      || E'      \'monthly_output_m\', \'overhead_override_per_m\', \'overhead_pct\',\n'
      || E'      \'commission_pct\', \'transport_per_m\', \'order_quantity_m\', \'profit_margin_pct\',\n'
      || E'      \'enabled_sections\', \'loom_type\', \'estimator_rpm\', \'estimator_power_kw\',\n'
      || E'      \'hours_per_shift\', \'sizing_mode\', \'loom_count\', \'monthly_working_days\',\n'
      || E'      \'avg_output_per_loom_per_day\', \'calculation_version\', \'rounding_policy\',\n'
      || E'      \'production_cost_per_meter\', \'overhead_per_meter\', \'commission_cost_per_meter\',\n'
      || E'      \'break_even_price_per_meter\', \'expected_profit_per_meter\', \'expected_profit_total\',\n'
      || E'      \'actual_margin_percent\', \'costing_result_snapshot\', \'reconciliation_status\',\n'
      || E'      \'reconciliation_note\', \'reconciled_at\', \'landed_cost_per_meter\',\n'
      || E'      \'quote_price_per_meter\', \'intended_margin_percent\', \'meters\', \'status\',\n'
      || E'      \'client_request_id\', \'worker_rate_per_m\', \'costing_input_fingerprint\',\n'
      || E'      \'factory_profile_updated_at\', \'ppi\', \'yarn_denier\', \'yarn_rate_per_kg\',\n'
      || E'      \'server_attestation_id\'\n'
      || E'    ])\n'
      || E'  ) THEN\n'
      || E'    RAISE EXCEPTION \'The costing payload contains unsupported fields.\' USING ERRCODE = \'22023\';\n'
      || E'  END IF;\n\n'
      || E'  UPDATE public.estimator_costing_attestations AS attestation\n'
      || E'  SET consumed_at = now()\n'
      || E'  WHERE attestation.id = NULLIF(p_quote_payload ->> \'server_attestation_id\', \'\')::uuid\n'
      || E'    AND attestation.org_id = v_org_id\n'
      || E'    AND attestation.user_id = v_user_id\n'
      || E'    AND (attestation.payload - \'template_id\') = (p_quote_payload - ARRAY[\'server_attestation_id\', \'template_id\'])\n'
      || E'    AND attestation.consumed_at IS NULL\n'
      || E'    AND attestation.expires_at > now();\n\n'
      || E'  IF NOT FOUND THEN\n'
      || E'    RAISE EXCEPTION \'The costing payload was not verified by the server. Refresh and try again.\' USING ERRCODE = \'42501\';\n'
      || E'  END IF;\n\n'
      || E'  IF COALESCE(p_quote_payload ->> \'record_kind\', \'\') <> \'costing\' THEN'
  );

  IF v_body = v_function.prosrc THEN
    RAISE EXCEPTION 'Could not add the costing attestation boundary';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.save_estimator_costing_revision_v2(%s) '
      || 'RETURNS %s LANGUAGE plpgsql VOLATILE SECURITY DEFINER '
      || 'SET search_path = pg_catalog, public AS %L',
    v_function.arguments,
    v_function.result_type,
    v_body
  );
END;
$harden_costing_save$;

-- The legacy order RPC remains available only to trusted backend maintenance.
DO $restrict_legacy_order_rpc$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT pg_get_function_identity_arguments(proc.oid) AS identity_arguments
    FROM pg_proc AS proc
    JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'start_party_order_from_estimator'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.start_party_order_from_estimator(%s) FROM PUBLIC, anon, authenticated',
      v_function.identity_arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.start_party_order_from_estimator(%s) TO service_role',
      v_function.identity_arguments
    );
  END LOOP;
END;
$restrict_legacy_order_rpc$;

-- The current RPC remains callable by authenticated Full Suite owners, but it
-- now checks live owner membership and entitlement before any production write.
DO $guard_current_order_rpc$
DECLARE
  v_function record;
  v_body text;
  v_volatility text;
BEGIN
  SELECT
    proc.oid,
    proc.prosrc,
    proc.provolatile,
    pg_get_function_arguments(proc.oid) AS arguments,
    pg_get_function_result(proc.oid) AS result_type
  INTO STRICT v_function
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  JOIN pg_language AS language ON language.oid = proc.prolang
  WHERE namespace.nspname = 'public'
    AND language.lanname = 'plpgsql'
    AND proc.proname = 'start_party_order_from_estimator_v2';

  v_body := regexp_replace(
    v_function.prosrc,
    '\mBEGIN\M',
    E'BEGIN\n  PERFORM public.assert_premium_rpc_access(v_org_id);',
    'i'
  );
  IF v_body = v_function.prosrc THEN
    RAISE EXCEPTION 'Could not add the Full Suite order guard';
  END IF;

  v_volatility := CASE v_function.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    ELSE 'VOLATILE'
  END;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.start_party_order_from_estimator_v2(%s) '
      || 'RETURNS %s LANGUAGE plpgsql %s SECURITY DEFINER '
      || 'SET search_path = pg_catalog, public AS %L',
    v_function.arguments,
    v_function.result_type,
    v_volatility,
    v_body
  );
END;
$guard_current_order_rpc$;
