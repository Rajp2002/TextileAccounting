-- Created with Supabase CLI, then ordered immediately after the repository's
-- existing 20260901110000 migration (the repository is ahead of wall-clock time).
BEGIN;
ALTER TABLE public.plan_usage_events DROP CONSTRAINT plan_usage_events_event_name_check;
ALTER TABLE public.plan_usage_events ADD CONSTRAINT plan_usage_events_event_name_check
  CHECK (event_name IN (
    'estimator_opened',
    'blank_start',
    'saved_quality_start',
    'saved_quality_selected',
    'current_rate_applied',
    'rate_review_requested',
    'valid_result_reached',
    'save_attempted',
    'save_succeeded',
    'save_failed',
    'save_outcome_unknown',
    'new_version_created',
    'export_preview_opened',
    'export_completed',
    'export_failed',
    'draft_detected',
    'draft_restored',
    'draft_discarded',
    'costing_started',
    'costing_completed',
    'costing_saved',
    'costing_reopened',
    'costing_recalculated',
    'quality_created',
    'quality_reused',
    'rate_book_viewed',
    'rate_book_action',
    'production_cta_viewed',
    'production_cta_clicked',
    'upgrade_screen_opened',
    'base_pricing_viewed',
    'upgrade_initiated',
    'upgrade_completed',
    'production_created',
    'production_created_from_costing',
    'production_status_updated',
    'production_quantity_updated',
    'production_completed',
    'production_viewed',
    'production_activity'
  ));

CREATE TABLE public.web_vital_samples (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_id text NOT NULL CHECK (metric_id ~ '^v5-[0-9]{13}-[0-9]{13}$'),
  name text NOT NULL CHECK (name IN ('LCP', 'INP', 'CLS')),
  value double precision NOT NULL CHECK (value >= 0 AND value <= 86400000),
  rating text NOT NULL CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  route text NOT NULL CHECK (route = '/owner/estimator'),
  scope text NOT NULL CHECK (scope = 'document'),
  device_class text NOT NULL CHECK (device_class IN ('mobile', 'tablet', 'desktop')),
  language text NOT NULL CHECK (language IN ('en', 'hi', 'gu')),
  plan_tier text NOT NULL CHECK (plan_tier IN ('none', 'trial', 'lite', 'base', 'premium')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, metric_id, name)
);
ALTER TABLE public.web_vital_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_vital_samples FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.web_vital_samples TO service_role;
COMMENT ON TABLE public.web_vital_samples IS
  'Document-lifetime Web Vitals for estimator-entry documents; not SPA route metrics. No actor or business content. Latest value per anonymous metric instance.';
COMMIT;
