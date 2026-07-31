-- Sprint 1: make the optional "save costing + update saved quality" action atomic.
--
-- A costing snapshot and its reusable Saved Quality are different records with
-- different lifecycles. This RPC deliberately updates the quality recipe only
-- when the owner explicitly asks for it; the costing row remains immutable.

CREATE OR REPLACE FUNCTION public.save_estimator_costing_revision_with_quality(
  p_quote_payload jsonb,
  p_source_quote_id uuid DEFAULT NULL,
  p_expected_source_updated_at timestamptz DEFAULT NULL,
  p_template_id uuid DEFAULT NULL,
  p_expected_template_updated_at timestamptz DEFAULT NULL,
  p_template_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_request_id uuid;
  v_source public.estimator_quotes%ROWTYPE;
  v_latest public.estimator_quotes%ROWTYPE;
  v_quote public.estimator_quotes%ROWTYPE;
  v_template public.estimator_templates%ROWTYPE;
  v_group_id uuid;
  v_version integer;
  v_identity text;
  v_template_updated_at timestamptz;
BEGIN
  SELECT membership.org_id
  INTO v_org_id
  FROM public.profiles AS membership
  WHERE membership.id = v_user_id
    AND membership.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can save a costing version.';
  END IF;

  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator subscription is required to save costings.';
  END IF;

  IF public.check_org_lockdown(v_org_id) THEN
    RAISE EXCEPTION 'This organization is temporarily locked. Costings cannot be changed until access is restored.';
  END IF;

  IF COALESCE(p_quote_payload ->> 'record_kind', '') <> 'costing' THEN
    RAISE EXCEPTION 'Only costing records can use the costing version save action.';
  END IF;

  IF p_template_id IS NULL THEN
    RAISE EXCEPTION 'Select a Saved Quality before updating its recipe.';
  END IF;

  v_request_id := NULLIF(p_quote_payload ->> 'client_request_id', '')::uuid;
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'The costing save request is missing its retry identity.';
  END IF;

  -- A lost response is safe to retry. The previous transaction either
  -- committed both records or committed neither record.
  SELECT *
  INTO v_quote
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id
    AND quote.client_request_id = v_request_id
  LIMIT 1;

  IF FOUND THEN
    SELECT *
    INTO v_template
    FROM public.estimator_templates AS template
    WHERE template.id = p_template_id
      AND template.org_id = v_org_id;

    RETURN jsonb_build_object(
      'success', true,
      'quoteId', v_quote.id,
      'updatedAt', v_quote.updated_at,
      'createdAt', v_quote.created_at,
      'versionNumber', v_quote.version_number,
      'templateUpdatedAt', v_template.updated_at,
      'idempotentReplay', true
    );
  END IF;

  -- Lock the quality before the costing lineage. Every caller follows this
  -- order, preventing a two-tab save from partially overwriting the recipe.
  SELECT *
  INTO v_template
  FROM public.estimator_templates AS template
  WHERE template.id = p_template_id
    AND template.org_id = v_org_id
    AND template.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This Saved Quality no longer exists or is inactive.';
  END IF;

  IF p_expected_template_updated_at IS NULL
     OR v_template.updated_at IS DISTINCT FROM p_expected_template_updated_at THEN
    RAISE EXCEPTION 'This Saved Quality changed in another tab. Refresh it before saving again.';
  END IF;

  -- Merge only the approved recipe fields. The quality name is intentionally
  -- not updated here: a different quality gets a new Saved Quality.
  v_template := jsonb_populate_record(v_template, COALESCE(p_template_payload, '{}'::jsonb));

  UPDATE public.estimator_templates AS template
  SET warp_rows = v_template.warp_rows,
      weft_rows = v_template.weft_rows,
      per_pick_cost_paise = v_template.per_pick_cost_paise,
      tape_length_m = v_template.tape_length_m,
      warp_crimp_pct = v_template.warp_crimp_pct,
      yarn_shortage_pct = v_template.yarn_shortage_pct,
      overhead_override_per_m = v_template.overhead_override_per_m,
      loom_type = v_template.loom_type,
      loom_rpm = v_template.loom_rpm,
      loom_power_kw = v_template.loom_power_kw,
      sizing_mode = v_template.sizing_mode,
      hours_per_shift = v_template.hours_per_shift,
      yarn_denier = v_template.yarn_denier,
      calculated_yarn_denier = v_template.calculated_yarn_denier,
      beam_ends = v_template.beam_ends,
      ppi = v_template.ppi,
      reed_space = v_template.reed_space,
      weft_denier = v_template.weft_denier,
      default_yarn_rate = v_template.default_yarn_rate,
      updated_at = now()
  WHERE template.id = p_template_id
    AND template.org_id = v_org_id
  RETURNING template.updated_at INTO v_template_updated_at;

  v_template.updated_at := v_template_updated_at;

  IF p_source_quote_id IS NOT NULL THEN
    SELECT *
    INTO v_source
    FROM public.estimator_quotes AS quote
    WHERE quote.id = p_source_quote_id
      AND quote.org_id = v_org_id
      AND quote.record_kind = 'costing'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The costing being edited no longer exists.';
    END IF;

    IF p_expected_source_updated_at IS NULL
       OR v_source.updated_at IS DISTINCT FROM p_expected_source_updated_at THEN
      RAISE EXCEPTION 'This costing changed in another tab. Reload the saved costing before saving again.';
    END IF;

    v_group_id := COALESCE(v_source.costing_group_id, v_source.id);

    SELECT *
    INTO v_latest
    FROM public.estimator_quotes AS quote
    WHERE quote.org_id = v_org_id
      AND quote.record_kind = 'costing'
      AND quote.costing_group_id = v_group_id
    ORDER BY quote.version_number DESC, quote.created_at DESC, quote.id DESC
    LIMIT 1
    FOR UPDATE;

    IF v_latest.id IS DISTINCT FROM v_source.id THEN
      RAISE EXCEPTION 'A newer costing version already exists. Reload it before saving again.';
    END IF;

    v_version := COALESCE(v_source.version_number, 1) + 1;
  ELSE
    v_identity := v_org_id::text || ':' || p_template_id::text;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_identity, 0));

    SELECT *
    INTO v_latest
    FROM public.estimator_quotes AS quote
    WHERE quote.org_id = v_org_id
      AND quote.record_kind = 'costing'
      AND quote.template_id = p_template_id
    ORDER BY quote.version_number DESC, quote.created_at DESC, quote.id DESC
    LIMIT 1
    FOR UPDATE;

    v_group_id := COALESCE(v_latest.costing_group_id, v_latest.id, gen_random_uuid());
    v_version := COALESCE(v_latest.version_number, 0) + 1;
  END IF;

  v_quote := jsonb_populate_record(NULL::public.estimator_quotes, p_quote_payload);
  v_quote.id := gen_random_uuid();
  v_quote.org_id := v_org_id;
  v_quote.record_kind := 'costing';
  v_quote.template_id := p_template_id;
  v_quote.source_quote_id := p_source_quote_id;
  v_quote.costing_group_id := v_group_id;
  v_quote.version_number := v_version;
  v_quote.is_archived := false;
  v_quote.is_favorite := false;
  v_quote.created_at := now();
  v_quote.updated_at := now();

  INSERT INTO public.estimator_quotes
  SELECT v_quote.*
  RETURNING * INTO v_quote;

  RETURN jsonb_build_object(
    'success', true,
    'quoteId', v_quote.id,
    'updatedAt', v_quote.updated_at,
    'createdAt', v_quote.created_at,
    'versionNumber', v_quote.version_number,
    'templateUpdatedAt', v_template.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_estimator_costing_revision_with_quality(
  jsonb, uuid, timestamptz, uuid, timestamptz, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_estimator_costing_revision_with_quality(
  jsonb, uuid, timestamptz, uuid, timestamptz, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.save_estimator_costing_revision_with_quality(
  jsonb, uuid, timestamptz, uuid, timestamptz, jsonb
) IS 'Atomically creates an immutable costing revision and, only when explicitly requested, updates the matching Saved Quality recipe without changing its name.';
