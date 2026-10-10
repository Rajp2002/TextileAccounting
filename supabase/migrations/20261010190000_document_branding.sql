-- Custom document branding for paid plans: the factory's business profile
-- (address, GSTIN, phone, bank details, default quotation terms), its
-- uploaded logo and which documents carry that logo.
--
-- Server code reads and writes these tables with the service role, after
-- requireRole() has resolved the owner's org from their database profile and
-- the plan has been checked for the document_branding capability. No browser
-- role can read or write them, and no Storage policy exposes the bucket.
--
-- Logo files live in the private `document-branding` bucket under
-- {org_id}/logos/{asset_id}/…; the object paths below are never sent to the
-- browser. A new upload is a new asset row: the active logo keeps printing
-- until the owner approves a replacement.

CREATE TABLE public.document_branding_logo_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'processing', 'ready_for_review', 'active', 'superseded', 'failed', 'rejected'
  )),
  original_object_path text CHECK (original_object_path IS NULL OR length(original_object_path) <= 200),
  -- Normalised PNG (orientation applied, metadata removed, bounded size).
  fallback_object_path text CHECK (fallback_object_path IS NULL OR length(fallback_object_path) <= 200),
  -- Sanitised VTracer output and the PNG rendered from it for PDFs.
  svg_object_path text CHECK (svg_object_path IS NULL OR length(svg_object_path) <= 200),
  svg_raster_object_path text CHECK (svg_raster_object_path IS NULL OR length(svg_raster_object_path) <= 200),
  source_mime_type text CHECK (source_mime_type IS NULL OR source_mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  source_size_bytes integer CHECK (source_size_bytes IS NULL OR source_size_bytes BETWEEN 1 AND 4194304),
  width integer CHECK (width IS NULL OR width BETWEEN 1 AND 4096),
  height integer CHECK (height IS NULL OR height BETWEEN 1 AND 4096),
  -- Display size of the normalised logo, used for the aspect ratio in documents.
  display_width integer CHECK (display_width IS NULL OR display_width BETWEEN 1 AND 4096),
  display_height integer CHECK (display_height IS NULL OR display_height BETWEEN 1 AND 4096),
  svg_size_bytes integer CHECK (svg_size_bytes IS NULL OR svg_size_bytes > 0),
  svg_path_count integer CHECK (svg_path_count IS NULL OR svg_path_count >= 0),
  -- Mean pixel difference between the original and the traced logo, 0-100.
  svg_difference_pct numeric(6, 2) CHECK (svg_difference_pct IS NULL OR svg_difference_pct BETWEEN 0 AND 100),
  recommended_variant text CHECK (recommended_variant IS NULL OR recommended_variant IN ('svg', 'raster')),
  selected_variant text CHECK (selected_variant IS NULL OR selected_variant IN ('svg', 'raster')),
  processor_version text CHECK (processor_version IS NULL OR length(processor_version) <= 60),
  trace_profile text CHECK (trace_profile IS NULL OR length(trace_profile) <= 60),
  error_code text CHECK (error_code IS NULL OR error_code ~ '^[a-z_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CONSTRAINT document_branding_logo_assets_org_id_id_key UNIQUE (org_id, id),
  CONSTRAINT document_branding_logo_assets_active_is_usable CHECK (
    status <> 'active' OR (approved_at IS NOT NULL AND selected_variant IS NOT NULL AND fallback_object_path IS NOT NULL)
  ),
  CONSTRAINT document_branding_logo_assets_svg_choice_has_svg CHECK (
    selected_variant IS DISTINCT FROM 'svg' OR (svg_object_path IS NOT NULL AND svg_raster_object_path IS NOT NULL)
  )
);

CREATE UNIQUE INDEX document_branding_logo_assets_one_active_per_org
  ON public.document_branding_logo_assets(org_id)
  WHERE status = 'active';
CREATE INDEX document_branding_logo_assets_org_created_idx
  ON public.document_branding_logo_assets(org_id, created_at DESC);

CREATE TABLE public.document_branding_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_logo_asset_id uuid,
  quotation_logo_enabled boolean NOT NULL DEFAULT true,
  internal_cost_sheet_logo_enabled boolean NOT NULL DEFAULT true,
  delivery_challan_logo_enabled boolean NOT NULL DEFAULT true,
  business_address text CHECK (business_address IS NULL OR length(business_address) <= 400),
  gstin text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  email text CHECK (email IS NULL OR length(email) <= 160),
  bank_details text CHECK (bank_details IS NULL OR length(bank_details) <= 400),
  default_quotation_terms text CHECK (default_quotation_terms IS NULL OR length(default_quotation_terms) <= 2000),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The active logo must belong to the same factory.
  CONSTRAINT document_branding_settings_active_logo_same_org
    FOREIGN KEY (org_id, active_logo_asset_id)
    REFERENCES public.document_branding_logo_assets(org_id, id)
);

ALTER TABLE public.document_branding_logo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_branding_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_branding_logo_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.document_branding_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_branding_logo_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_branding_settings TO service_role;

COMMENT ON TABLE public.document_branding_logo_assets IS
  'Uploaded factory logos and their processed versions. Service role only; one active logo per organization.';
COMMENT ON TABLE public.document_branding_settings IS
  'Business profile and logo preferences printed on quotations, cost sheets and delivery challans. Service role only.';

-- ── Activate an approved logo ───────────────────────────────────────────────
-- Switches the active logo in one transaction. The previous active logo stays
-- active until this commits; concurrent approvals serialize on the settings
-- row, so the approval that commits last wins.
CREATE FUNCTION public.activate_document_branding_logo(
  p_org_id uuid,
  p_asset_id uuid,
  p_variant text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_asset public.document_branding_logo_assets%ROWTYPE;
BEGIN
  IF p_org_id IS NULL OR p_asset_id IS NULL THEN
    RAISE EXCEPTION 'BRANDING_ASSET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_variant IS NULL OR p_variant NOT IN ('svg', 'raster') THEN
    RAISE EXCEPTION 'BRANDING_VARIANT_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.document_branding_settings(org_id, updated_by)
  VALUES (p_org_id, p_actor_id)
  ON CONFLICT (org_id) DO NOTHING;

  PERFORM 1 FROM public.document_branding_settings
  WHERE org_id = p_org_id
  FOR UPDATE;

  SELECT * INTO v_asset
  FROM public.document_branding_logo_assets
  WHERE id = p_asset_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRANDING_ASSET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  -- An active logo may switch between its traced and uploaded versions.
  IF v_asset.status NOT IN ('ready_for_review', 'active') THEN
    RAISE EXCEPTION 'BRANDING_ASSET_NOT_READY' USING ERRCODE = '55000';
  END IF;
  IF v_asset.fallback_object_path IS NULL
     OR (p_variant = 'svg' AND (v_asset.svg_object_path IS NULL OR v_asset.svg_raster_object_path IS NULL)) THEN
    RAISE EXCEPTION 'BRANDING_VARIANT_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  UPDATE public.document_branding_logo_assets
  SET status = 'superseded', updated_at = now()
  WHERE org_id = p_org_id AND status = 'active' AND id <> p_asset_id;

  UPDATE public.document_branding_logo_assets
  SET status = 'active',
      selected_variant = p_variant,
      approved_at = coalesce(approved_at, now()),
      updated_at = now()
  WHERE id = p_asset_id AND org_id = p_org_id;

  UPDATE public.document_branding_settings
  SET active_logo_asset_id = p_asset_id,
      updated_by = p_actor_id,
      updated_at = now()
  WHERE org_id = p_org_id;

  RETURN jsonb_build_object('asset_id', p_asset_id, 'variant', p_variant);
END;
$function$;

-- ── Remove the active logo ──────────────────────────────────────────────────
-- Documents go back to the business-name masthead; exports keep working.
CREATE FUNCTION public.clear_document_branding_logo(
  p_org_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_previous uuid;
BEGIN
  SELECT active_logo_asset_id INTO v_previous
  FROM public.document_branding_settings
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('removed', false);
  END IF;

  UPDATE public.document_branding_settings
  SET active_logo_asset_id = NULL,
      updated_by = p_actor_id,
      updated_at = now()
  WHERE org_id = p_org_id;

  UPDATE public.document_branding_logo_assets
  SET status = 'superseded', updated_at = now()
  WHERE org_id = p_org_id AND status = 'active';

  RETURN jsonb_build_object('removed', v_previous IS NOT NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_document_branding_logo(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_document_branding_logo(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_document_branding_logo(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_document_branding_logo(uuid, uuid) TO service_role;

-- ── Private bucket ──────────────────────────────────────────────────────────
-- No storage.objects policy names this bucket, so only the service role can
-- read or write it. The size limit matches the upload limit in
-- lib/document-branding/limits.ts.
DO $$
BEGIN
  IF pg_catalog.to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'document-branding',
      'document-branding',
      false,
      4194304,
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
