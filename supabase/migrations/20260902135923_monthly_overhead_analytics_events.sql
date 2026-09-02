BEGIN;

ALTER TABLE public.factory_cost_profile
  ALTER COLUMN overhead_override_per_m TYPE numeric(18,6);

COMMENT ON COLUMN public.factory_cost_profile.overhead_override_per_m IS
  'Canonical current costing overhead in INR/metre. overhead_mode records whether it was entered manually or derived from the retained monthly assumptions.';

ALTER TABLE public.plan_usage_events
  DROP CONSTRAINT plan_usage_events_event_name_check;

ALTER TABLE public.plan_usage_events
  ADD CONSTRAINT plan_usage_events_event_name_check
  CHECK (event_name IN (
    'estimator_opened', 'blank_start', 'saved_quality_start',
    'saved_quality_selected', 'current_rate_applied', 'rate_review_requested',
    'valid_result_reached', 'save_attempted', 'save_succeeded', 'save_failed',
    'save_outcome_unknown', 'new_version_created', 'export_preview_opened',
    'export_completed', 'export_failed', 'draft_detected', 'draft_restored',
    'draft_discarded', 'costing_started', 'costing_completed', 'costing_saved',
    'costing_reopened', 'costing_recalculated', 'quality_created', 'quality_reused',
    'rate_book_viewed', 'rate_book_action', 'production_cta_viewed',
    'production_cta_clicked', 'upgrade_screen_opened', 'base_pricing_viewed',
    'upgrade_initiated', 'upgrade_completed', 'production_created',
    'production_created_from_costing', 'production_status_updated',
    'production_quantity_updated', 'production_completed', 'production_viewed',
    'production_activity', 'monthly_overhead_modal_opened',
    'monthly_overhead_config_saved', 'monthly_overhead_custom_expense_added',
    'derived_overhead_applied', 'overhead_source_changed_to_manual',
    'overhead_source_changed_to_monthly'
  ));

COMMIT;
