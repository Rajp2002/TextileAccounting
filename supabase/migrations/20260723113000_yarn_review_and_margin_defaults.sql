-- Organization-wide review cadence and selling-margin defaults.

ALTER TABLE public.factory_cost_profile
  ADD COLUMN IF NOT EXISTS yarn_review_interval_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS default_margin_pct numeric(5,2) NOT NULL DEFAULT 10.00;

ALTER TABLE public.factory_cost_profile
  DROP CONSTRAINT IF EXISTS factory_cost_profile_yarn_review_interval_days_check,
  ADD CONSTRAINT factory_cost_profile_yarn_review_interval_days_check
    CHECK (yarn_review_interval_days BETWEEN 1 AND 1095),
  DROP CONSTRAINT IF EXISTS factory_cost_profile_default_margin_pct_check,
  ADD CONSTRAINT factory_cost_profile_default_margin_pct_check
    CHECK (default_margin_pct >= 0 AND default_margin_pct <= 99.99);

COMMENT ON COLUMN public.factory_cost_profile.yarn_review_interval_days IS
  'Default review cadence for active yarn rates. Individual yarns may be overridden in the Yarn Rate Book.';
COMMENT ON COLUMN public.factory_cost_profile.default_margin_pct IS
  'Target selling margin pre-filled into each new cost estimate.';

CREATE OR REPLACE FUNCTION public.sync_yarn_review_interval_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.yarn_review_interval_days IS DISTINCT FROM OLD.yarn_review_interval_days THEN
    UPDATE public.cost_rate_book
       SET review_interval_days = NEW.yarn_review_interval_days,
           updated_at = now()
     WHERE org_id = NEW.factory_id
       AND category IN ('yarn_warp', 'yarn_weft')
       AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_yarn_review_interval_from_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_yarn_review_interval_from_profile ON public.factory_cost_profile;
CREATE TRIGGER sync_yarn_review_interval_from_profile
  AFTER UPDATE OF yarn_review_interval_days ON public.factory_cost_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_yarn_review_interval_from_profile();

-- Costing snapshots can discover a yarn inside a database trigger, before the
-- rate-book page is opened. Make those inserts inherit the configured cadence.
CREATE OR REPLACE FUNCTION public.apply_yarn_review_interval_to_discovered_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.category IN ('yarn_warp', 'yarn_weft')
     AND NEW.source = 'Saved costing' THEN
    SELECT profile.yarn_review_interval_days
      INTO NEW.review_interval_days
      FROM public.factory_cost_profile AS profile
     WHERE profile.factory_id = NEW.org_id;
    NEW.review_interval_days := COALESCE(NEW.review_interval_days, 90);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_yarn_review_interval_to_discovered_rate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apply_yarn_review_interval_to_discovered_rate ON public.cost_rate_book;
CREATE TRIGGER apply_yarn_review_interval_to_discovered_rate
  BEFORE INSERT ON public.cost_rate_book
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_yarn_review_interval_to_discovered_rate();
