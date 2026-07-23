-- In the Base product, a saved costing is also the reusable fabric quality.
-- Full Suite keeps the explicit quality/costing distinction because its
-- quotation and production workflows use those records independently.

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
  ELSE
    -- Saving another costing with the same quality name refreshes the reusable
    -- recipe to the latest costing while historical snapshots remain immutable.
    UPDATE public.estimator_templates
    SET warp_rows = NEW.warp_rows,
        weft_rows = NEW.weft_rows,
        per_pick_cost_paise = NEW.per_pick_cost_paise,
        tape_length_m = NEW.tape_length_m,
        warp_crimp_pct = NEW.warp_crimp_pct,
        yarn_shortage_pct = NEW.yarn_shortage_pct,
        overhead_override_per_m = NEW.overhead_override_per_m,
        loom_type = NEW.loom_type,
        loom_rpm = NEW.estimator_rpm,
        loom_power_kw = NEW.estimator_power_kw,
        sizing_mode = NEW.sizing_mode,
        hours_per_shift = NEW.hours_per_shift,
        yarn_denier = NEW.yarn_denier,
        calculated_yarn_denier = NEW.yarn_denier,
        beam_ends = COALESCE((NEW.warp_rows -> 0 ->> 'beamEnds')::numeric, beam_ends),
        ppi = NEW.ppi,
        reed_space = COALESCE((NEW.weft_rows -> 0 ->> 'reedSpace')::numeric, reed_space),
        weft_denier = COALESCE((NEW.weft_rows -> 0 ->> 'calcDenier')::numeric, weft_denier),
        default_yarn_rate = NEW.yarn_rate_per_kg,
        gsm = COALESCE(NEW.gsm, gsm),
        updated_at = now()
    WHERE id = v_template_id;
  END IF;

  NEW.template_id := v_template_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_base_costing_to_saved_quality() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS estimator_quotes_sync_base_saved_quality ON public.estimator_quotes;
CREATE TRIGGER estimator_quotes_sync_base_saved_quality
  BEFORE INSERT ON public.estimator_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_base_costing_to_saved_quality();

-- Repair existing Base costings. Keep the newest costing recipe for each
-- normalized quality name and link the complete costing history to it.
WITH current_base_orgs AS (
  SELECT DISTINCT subscription.org_id
  FROM public.org_subscriptions AS subscription
  WHERE subscription.plan_tier = 'base'
    AND subscription.status IN (
      'active', 'authenticated', 'pending', 'paused',
      'halted', 'cancelled', 'completed'
    )
    AND (subscription.current_start IS NULL OR subscription.current_start <= now())
    AND (
      (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
      OR subscription.current_end + interval '24 hours' >= now()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_subscriptions AS higher
      WHERE higher.org_id = subscription.org_id
        AND higher.plan_tier IN ('premium', 'trial')
        AND higher.status IN (
          'active', 'authenticated', 'pending', 'paused',
          'halted', 'cancelled', 'completed'
        )
        AND (higher.current_start IS NULL OR higher.current_start <= now())
        AND (
          (higher.current_end IS NULL AND higher.status IN ('active', 'authenticated'))
          OR higher.current_end + CASE
            WHEN higher.plan_tier = 'trial' THEN interval '0 seconds'
            ELSE interval '24 hours'
          END >= now()
        )
    )
), latest_costings AS (
  SELECT DISTINCT ON (
    quote.org_id,
    lower(regexp_replace(btrim(quote.quality_label), '\s+', ' ', 'g'))
  ) quote.*
  FROM public.estimator_quotes AS quote
  JOIN current_base_orgs AS base_org ON base_org.org_id = quote.org_id
  WHERE quote.record_kind = 'costing'
    AND quote.template_id IS NULL
    AND NULLIF(btrim(quote.quality_label), '') IS NOT NULL
  ORDER BY
    quote.org_id,
    lower(regexp_replace(btrim(quote.quality_label), '\s+', ' ', 'g')),
    quote.updated_at DESC,
    quote.created_at DESC
)
INSERT INTO public.estimator_templates (
  org_id, name, warp_rows, weft_rows, per_pick_cost_paise, tape_length_m,
  warp_crimp_pct, yarn_shortage_pct, overhead_override_per_m, loom_type,
  loom_rpm, loom_power_kw, sizing_mode, hours_per_shift, yarn_denier,
  calculated_yarn_denier, beam_ends, ppi, reed_space, weft_denier,
  default_yarn_rate, gsm, is_active
)
SELECT
  costing.org_id,
  regexp_replace(btrim(costing.quality_label), '\s+', ' ', 'g'),
  costing.warp_rows,
  costing.weft_rows,
  costing.per_pick_cost_paise,
  costing.tape_length_m,
  costing.warp_crimp_pct,
  costing.yarn_shortage_pct,
  costing.overhead_override_per_m,
  costing.loom_type,
  costing.estimator_rpm,
  costing.estimator_power_kw,
  costing.sizing_mode,
  costing.hours_per_shift,
  costing.yarn_denier,
  costing.yarn_denier,
  COALESCE((costing.warp_rows -> 0 ->> 'beamEnds')::numeric, 0),
  costing.ppi,
  COALESCE((costing.weft_rows -> 0 ->> 'reedSpace')::numeric, 0),
  COALESCE((costing.weft_rows -> 0 ->> 'calcDenier')::numeric, costing.yarn_denier),
  costing.yarn_rate_per_kg,
  COALESCE(costing.gsm, 80),
  true
FROM latest_costings AS costing
WHERE NOT EXISTS (
  SELECT 1
  FROM public.estimator_templates AS template
  WHERE template.org_id = costing.org_id
    AND template.is_active = true
    AND lower(regexp_replace(btrim(template.name), '\s+', ' ', 'g'))
      = lower(regexp_replace(btrim(costing.quality_label), '\s+', ' ', 'g'))
);

WITH current_base_orgs AS (
  SELECT DISTINCT subscription.org_id
  FROM public.org_subscriptions AS subscription
  WHERE subscription.plan_tier = 'base'
    AND subscription.status IN (
      'active', 'authenticated', 'pending', 'paused',
      'halted', 'cancelled', 'completed'
    )
    AND (subscription.current_start IS NULL OR subscription.current_start <= now())
    AND (
      (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
      OR subscription.current_end + interval '24 hours' >= now()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_subscriptions AS higher
      WHERE higher.org_id = subscription.org_id
        AND higher.plan_tier IN ('premium', 'trial')
        AND higher.status IN (
          'active', 'authenticated', 'pending', 'paused',
          'halted', 'cancelled', 'completed'
        )
        AND (higher.current_start IS NULL OR higher.current_start <= now())
        AND (
          (higher.current_end IS NULL AND higher.status IN ('active', 'authenticated'))
          OR higher.current_end + CASE
            WHEN higher.plan_tier = 'trial' THEN interval '0 seconds'
            ELSE interval '24 hours'
          END >= now()
        )
    )
)
UPDATE public.estimator_quotes AS quote
SET template_id = template.id
FROM public.estimator_templates AS template, current_base_orgs AS base_org
WHERE quote.org_id = base_org.org_id
  AND quote.org_id = template.org_id
  AND quote.record_kind = 'costing'
  AND quote.template_id IS NULL
  AND template.is_active = true
  AND lower(regexp_replace(btrim(template.name), '\s+', ' ', 'g'))
    = lower(regexp_replace(btrim(quote.quality_label), '\s+', ' ', 'g'));

COMMENT ON FUNCTION public.sync_base_costing_to_saved_quality() IS
  'Makes every Base-plan costing a reusable saved quality and links the costing snapshot to it; Full Suite behavior is unchanged.';
