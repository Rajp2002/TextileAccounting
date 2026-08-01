-- Sprint 1: make costing identity, no-change saves, and historical economics
-- explicit at the database boundary.
--
-- This migration is forward-only. Sprint 0 snapshot columns remain the source
-- of truth for saved economics; these additions only record the save context
-- needed to explain that truth to an owner.

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS costing_input_fingerprint text,
  ADD COLUMN IF NOT EXISTS factory_profile_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS estimator_quotes_costing_identity_idx
  ON public.estimator_quotes(org_id, record_kind, template_id, created_at DESC)
  WHERE record_kind = 'costing';

COMMENT ON COLUMN public.estimator_quotes.costing_input_fingerprint IS
  'Canonical fingerprint of costing inputs used to make same-value Save New Costing Version a safe no-op. Not displayed as a customer label.';

COMMENT ON COLUMN public.estimator_quotes.factory_profile_updated_at IS
  'Factory baseline timestamp captured when this costing was saved. Changing the baseline never rewrites this historical row.';

-- A costing row may still be archived, favourited, linked to downstream
-- usage, or reconciled by an audit. Its financial inputs and canonical result
-- may not be edited in place.
CREATE OR REPLACE FUNCTION public.protect_costing_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF OLD.record_kind IS DISTINCT FROM 'costing' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Historical costing snapshots cannot be deleted. Archive the snapshot instead.';
  END IF;

  v_old := to_jsonb(OLD) - ARRAY[
    'updated_at',
    'is_archived',
    'is_favorite',
    'status',
    'order_id',
    'market_run_id',
    'reconciliation_status',
    'reconciliation_note',
    'reconciled_at'
  ];
  v_new := to_jsonb(NEW) - ARRAY[
    'updated_at',
    'is_archived',
    'is_favorite',
    'status',
    'order_id',
    'market_run_id',
    'reconciliation_status',
    'reconciliation_note',
    'reconciled_at'
  ];

  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'Historical costing snapshots are immutable. Save a new costing version for changed economics.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_costing_snapshot_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS estimator_quotes_protect_costing_snapshot ON public.estimator_quotes;
CREATE TRIGGER estimator_quotes_protect_costing_snapshot
  BEFORE UPDATE OR DELETE ON public.estimator_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_costing_snapshot_update();

-- The Base quality helper is still needed for legacy/direct inserts, but a
-- revision must never refresh the reusable quality implicitly. The explicit
-- Save Version & Update Quality action owns that decision.
CREATE OR REPLACE FUNCTION public.sync_base_costing_to_saved_quality()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_template_id uuid;
  v_normalized_name text;
BEGIN
  IF NEW.record_kind IS DISTINCT FROM 'costing'
     OR NEW.source_quote_id IS NOT NULL
     OR NEW.template_id IS NOT NULL
     OR NULLIF(btrim(NEW.quality_label), '') IS NULL
     OR public.org_has_subscription_tier(NEW.org_id, 'premium')
     OR NOT public.org_has_subscription_tier(NEW.org_id, 'base') THEN
    RETURN NEW;
  END IF;

  v_normalized_name := lower(regexp_replace(btrim(NEW.quality_label), '\s+', ' ', 'g'));

  SELECT template.id
  INTO v_template_id
  FROM public.estimator_templates AS template
  WHERE template.org_id = NEW.org_id
    AND template.is_active = true
    AND lower(regexp_replace(btrim(template.name), '\s+', ' ', 'g')) = v_normalized_name
  FOR UPDATE;

  IF v_template_id IS NULL THEN
    BEGIN
      INSERT INTO public.estimator_templates (
        org_id,
        name,
        warp_rows,
        weft_rows,
        per_pick_cost_paise,
        tape_length_m,
        warp_crimp_pct,
        yarn_shortage_pct,
        overhead_override_per_m,
        loom_type,
        loom_rpm,
        loom_power_kw,
        sizing_mode,
        hours_per_shift,
        yarn_denier,
        calculated_yarn_denier,
        beam_ends,
        ppi,
        reed_space,
        weft_denier,
        default_yarn_rate,
        gsm,
        is_active
      ) VALUES (
        NEW.org_id,
        regexp_replace(btrim(NEW.quality_label), '\s+', ' ', 'g'),
        NEW.warp_rows,
        NEW.weft_rows,
        NEW.per_pick_cost_paise,
        NEW.tape_length_m,
        NEW.warp_crimp_pct,
        NEW.yarn_shortage_pct,
        NEW.overhead_override_per_m,
        NEW.loom_type,
        NEW.estimator_rpm,
        NEW.estimator_power_kw,
        NEW.sizing_mode,
        NEW.hours_per_shift,
        NEW.yarn_denier,
        NEW.yarn_denier,
        COALESCE((NEW.warp_rows -> 0 ->> 'beamEnds')::numeric, 0),
        NEW.ppi,
        COALESCE((NEW.weft_rows -> 0 ->> 'reedSpace')::numeric, 0),
        COALESCE((NEW.weft_rows -> 0 ->> 'calcDenier')::numeric, NEW.yarn_denier),
        NEW.yarn_rate_per_kg,
        COALESCE(NEW.gsm, 80),
        true
      )
      RETURNING id INTO v_template_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT template.id
      INTO v_template_id
      FROM public.estimator_templates AS template
      WHERE template.org_id = NEW.org_id
        AND template.is_active = true
        AND lower(regexp_replace(btrim(template.name), '\s+', ' ', 'g')) = v_normalized_name;
    END;
  END IF;

  NEW.template_id := v_template_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_base_costing_to_saved_quality() FROM PUBLIC, anon, authenticated;

-- One transaction for every Base costing save. This function owns:
--   * source/version locking,
--   * same-value no-op detection,
--   * stale-save rejection,
--   * optional explicit Saved Quality update,
--   * immutable snapshot insertion.
CREATE OR REPLACE FUNCTION public.save_estimator_costing_revision_v2(
  p_quote_payload jsonb,
  p_source_quote_id uuid DEFAULT NULL,
  p_expected_source_updated_at timestamptz DEFAULT NULL,
  p_template_id uuid DEFAULT NULL,
  p_expected_template_updated_at timestamptz DEFAULT NULL,
  p_update_saved_quality boolean DEFAULT false,
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
  v_template_id uuid := p_template_id;
  v_group_id uuid;
  v_version integer;
  v_identity text;
  v_fingerprint text := NULLIF(p_quote_payload ->> 'costing_input_fingerprint', '');
  v_template_updated_at timestamptz;
  v_quality_updated boolean := false;
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

  v_request_id := NULLIF(p_quote_payload ->> 'client_request_id', '')::uuid;
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'The costing save request is missing its retry identity.';
  END IF;

  SELECT *
  INTO v_quote
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id
    AND quote.client_request_id = v_request_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'quoteId', v_quote.id,
      'updatedAt', v_quote.updated_at,
      'createdAt', v_quote.created_at,
      'versionNumber', v_quote.version_number,
      'templateId', v_quote.template_id,
      'outcome', 'idempotent_replay',
      'idempotentReplay', true,
      'noChange', false,
      'qualityUpdated', p_update_saved_quality
    );
  END IF;

  -- Lock the Saved Quality before the costing lineage. Version-only saves do
  -- not require its timestamp because they deliberately leave the quality
  -- unchanged; an explicit quality update does.
  IF v_template_id IS NOT NULL THEN
    SELECT *
    INTO v_template
    FROM public.estimator_templates AS template
    WHERE template.id = v_template_id
      AND template.org_id = v_org_id
      AND template.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'This Saved Quality no longer exists or is inactive.';
    END IF;

    IF p_update_saved_quality THEN
      IF p_expected_template_updated_at IS NULL
         OR v_template.updated_at IS DISTINCT FROM p_expected_template_updated_at THEN
        RAISE EXCEPTION 'This Saved Quality changed in another tab. Refresh it before saving again.';
      END IF;
    END IF;

    -- A second request with the same retry identity may have been waiting on
    -- this quality lock while the first request committed. Re-check after the
    -- lock so a double-click is reported as the same save, not as a stale edit.
    SELECT *
    INTO v_quote
    FROM public.estimator_quotes AS quote
    WHERE quote.org_id = v_org_id
      AND quote.client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'quoteId', v_quote.id,
        'updatedAt', v_quote.updated_at,
        'createdAt', v_quote.created_at,
        'versionNumber', v_quote.version_number,
        'templateId', v_quote.template_id,
        'templateUpdatedAt', v_template.updated_at,
        'outcome', 'idempotent_replay',
        'idempotentReplay', true,
        'noChange', false,
        'qualityUpdated', p_update_saved_quality
      );
    END IF;
  ELSIF p_update_saved_quality THEN
    RAISE EXCEPTION 'Select a Saved Quality before updating its recipe.';
  END IF;

  IF p_update_saved_quality THEN
    -- The name is intentionally excluded. A different construction is a new
    -- Saved Quality, not a rename of this identity.
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
    WHERE template.id = v_template_id
      AND template.org_id = v_org_id
    RETURNING template.updated_at INTO v_template_updated_at;

    v_quality_updated := true;
  ELSE
    v_template_updated_at := v_template.updated_at;
  END IF;

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

    -- The source lock serializes two edits of the same historical costing.
    -- Re-check the request after waiting for it to avoid turning a duplicate
    -- retry into a misleading "newer version" error.
    SELECT *
    INTO v_quote
    FROM public.estimator_quotes AS quote
    WHERE quote.org_id = v_org_id
      AND quote.client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'quoteId', v_quote.id,
        'updatedAt', v_quote.updated_at,
        'createdAt', v_quote.created_at,
        'versionNumber', v_quote.version_number,
        'templateId', v_quote.template_id,
        'outcome', 'idempotent_replay',
        'idempotentReplay', true,
        'noChange', false,
        'qualityUpdated', p_update_saved_quality
      );
    END IF;

    IF p_expected_source_updated_at IS NULL
       OR v_source.updated_at IS DISTINCT FROM p_expected_source_updated_at THEN
      RAISE EXCEPTION 'This costing changed in another tab. Reload the saved costing before saving again.';
    END IF;

    IF v_template_id IS NULL THEN
      v_template_id := v_source.template_id;
    ELSIF v_source.template_id IS NOT NULL AND v_source.template_id IS DISTINCT FROM v_template_id THEN
      RAISE EXCEPTION 'The selected Saved Quality does not match the costing being edited.';
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
  ELSE
    v_identity := v_org_id::text || ':' || COALESCE(v_template_id::text, lower(btrim(p_quote_payload ->> 'quality_label')));
    PERFORM pg_advisory_xact_lock(hashtextextended(v_identity, 0));

    -- The advisory lock serializes new saves for the same quality/label.
    -- Re-checking here closes the same-request race for two tabs that submit
    -- before either response returns.
    SELECT *
    INTO v_quote
    FROM public.estimator_quotes AS quote
    WHERE quote.org_id = v_org_id
      AND quote.client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'quoteId', v_quote.id,
        'updatedAt', v_quote.updated_at,
        'createdAt', v_quote.created_at,
        'versionNumber', v_quote.version_number,
        'templateId', v_quote.template_id,
        'outcome', 'idempotent_replay',
        'idempotentReplay', true,
        'noChange', false,
        'qualityUpdated', p_update_saved_quality
      );
    END IF;

    SELECT *
    INTO v_latest
    FROM public.estimator_quotes AS quote
    WHERE quote.org_id = v_org_id
      AND quote.record_kind = 'costing'
      AND (
        (v_template_id IS NOT NULL AND quote.template_id = v_template_id)
        OR (v_template_id IS NULL
            AND quote.template_id IS NULL
            AND lower(btrim(quote.quality_label)) = lower(btrim(p_quote_payload ->> 'quality_label')))
      )
    ORDER BY quote.version_number DESC, quote.created_at DESC, quote.id DESC
    LIMIT 1
    FOR UPDATE;

    v_group_id := COALESCE(v_latest.costing_group_id, v_latest.id, gen_random_uuid());
  END IF;

  IF v_latest.id IS NOT NULL
     AND v_fingerprint IS NOT NULL
     AND v_latest.costing_input_fingerprint IS NOT DISTINCT FROM v_fingerprint THEN
    RETURN jsonb_build_object(
      'success', true,
      'quoteId', v_latest.id,
      'updatedAt', v_latest.updated_at,
      'createdAt', v_latest.created_at,
      'versionNumber', v_latest.version_number,
      'templateId', COALESCE(v_template_id, v_latest.template_id),
      'templateUpdatedAt', v_template_updated_at,
      'outcome', 'no_change',
      'idempotentReplay', false,
      'noChange', true,
      'qualityUpdated', v_quality_updated
    );
  END IF;

  v_version := CASE
    WHEN p_source_quote_id IS NOT NULL THEN COALESCE(v_source.version_number, 1) + 1
    ELSE COALESCE(v_latest.version_number, 0) + 1
  END;

  v_quote := jsonb_populate_record(NULL::public.estimator_quotes, p_quote_payload);
  v_quote.id := gen_random_uuid();
  v_quote.org_id := v_org_id;
  v_quote.record_kind := 'costing';
  v_quote.template_id := v_template_id;
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
    'templateId', v_quote.template_id,
    'templateUpdatedAt', v_template_updated_at,
    'outcome', 'saved',
    'idempotentReplay', false,
    'noChange', false,
    'qualityUpdated', v_quality_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_estimator_costing_revision_v2(
  jsonb, uuid, timestamptz, uuid, timestamptz, boolean, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_estimator_costing_revision_v2(
  jsonb, uuid, timestamptz, uuid, timestamptz, boolean, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.save_estimator_costing_revision_v2(
  jsonb, uuid, timestamptz, uuid, timestamptz, boolean, jsonb
) IS 'Atomically saves an immutable Base costing version, returns no_change for identical economics, rejects stale edits, and updates a Saved Quality only when explicitly requested.';

-- New Saved Quality + its initial v1 costing are one transaction. A lost
-- response is safe because the costing request id is checked before the name
-- insert on retry.
CREATE OR REPLACE FUNCTION public.create_saved_quality_with_initial_costing_v1(
  p_template_payload jsonb,
  p_quote_payload jsonb
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
  v_existing public.estimator_quotes%ROWTYPE;
  v_template public.estimator_templates%ROWTYPE;
  v_template_input public.estimator_templates%ROWTYPE;
  v_result jsonb;
  v_name text;
BEGIN
  SELECT membership.org_id
  INTO v_org_id
  FROM public.profiles AS membership
  WHERE membership.id = v_user_id
    AND membership.role::text = 'owner';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Only an organization owner can create a Saved Quality.';
  END IF;
  IF NOT public.org_has_subscription_tier(v_org_id, 'base') THEN
    RAISE EXCEPTION 'An active Weavly Estimator subscription is required to save qualities.';
  END IF;
  IF public.check_org_lockdown(v_org_id) THEN
    RAISE EXCEPTION 'This organization is temporarily locked. Saved Qualities cannot be changed until access is restored.';
  END IF;
  IF COALESCE(p_quote_payload ->> 'record_kind', '') <> 'costing' THEN
    RAISE EXCEPTION 'A Saved Quality must start with a Cost Estimate.';
  END IF;

  v_request_id := NULLIF(p_quote_payload ->> 'client_request_id', '')::uuid;
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'The Saved Quality request is missing its retry identity.';
  END IF;

  -- Serialize retries of the same new-quality request before the name check.
  -- This prevents a double-click whose first response is lost from waiting
  -- on the unique name index and surfacing a misleading duplicate error.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':' || v_request_id::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id
    AND quote.client_request_id = v_request_id
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'templateId', v_existing.template_id,
      'quoteId', v_existing.id,
      'updatedAt', v_existing.updated_at,
      'versionNumber', v_existing.version_number,
      'outcome', 'idempotent_replay',
      'idempotentReplay', true
    );
  END IF;

  v_template_input := jsonb_populate_record(NULL::public.estimator_templates, COALESCE(p_template_payload, '{}'::jsonb));
  v_name := regexp_replace(COALESCE(btrim(v_template_input.name), ''), '\s+', ' ', 'g');
  IF v_name = '' THEN
    RAISE EXCEPTION 'Quality name is required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.estimator_templates AS template
    WHERE template.org_id = v_org_id
      AND template.is_active = true
      AND lower(regexp_replace(btrim(template.name), '\s+', ' ', 'g')) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'A saved quality with this name already exists. Choose Start From and give the new quality a different name.';
  END IF;

  INSERT INTO public.estimator_templates (
    org_id,
    name,
    warp_rows,
    weft_rows,
    per_pick_cost_paise,
    tape_length_m,
    warp_crimp_pct,
    yarn_shortage_pct,
    overhead_override_per_m,
    loom_type,
    loom_rpm,
    loom_power_kw,
    sizing_mode,
    hours_per_shift,
    yarn_denier,
    calculated_yarn_denier,
    beam_ends,
    ppi,
    reed_space,
    weft_denier,
    default_yarn_rate,
    gsm,
    is_active
  ) VALUES (
    v_org_id,
    v_name,
    v_template_input.warp_rows,
    v_template_input.weft_rows,
    v_template_input.per_pick_cost_paise,
    v_template_input.tape_length_m,
    v_template_input.warp_crimp_pct,
    v_template_input.yarn_shortage_pct,
    v_template_input.overhead_override_per_m,
    v_template_input.loom_type,
    v_template_input.loom_rpm,
    v_template_input.loom_power_kw,
    v_template_input.sizing_mode,
    v_template_input.hours_per_shift,
    v_template_input.yarn_denier,
    v_template_input.calculated_yarn_denier,
    v_template_input.beam_ends,
    v_template_input.ppi,
    v_template_input.reed_space,
    v_template_input.weft_denier,
    v_template_input.default_yarn_rate,
    COALESCE(v_template_input.gsm, 80),
    true
  )
  RETURNING * INTO v_template;

  SELECT public.save_estimator_costing_revision_v2(
    p_quote_payload || jsonb_build_object('template_id', v_template.id),
    NULL,
    NULL,
    v_template.id,
    NULL,
    false,
    '{}'::jsonb
  ) INTO v_result;

  RETURN v_result || jsonb_build_object('templateId', v_template.id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_saved_quality_with_initial_costing_v1(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_saved_quality_with_initial_costing_v1(jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_saved_quality_with_initial_costing_v1(jsonb, jsonb) IS
  'Atomically creates a Base Saved Quality and its first immutable Cost Estimate snapshot.';
