export const PLAN_ANALYTICS_EVENTS = [
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
  'production_activity',
] as const

export type PlanAnalyticsEventName = typeof PLAN_ANALYTICS_EVENTS[number]
export type PlanAnalyticsProperties = Record<string, string | number | boolean | null>

export function isPlanAnalyticsEvent(value: unknown): value is PlanAnalyticsEventName {
  return typeof value === 'string' && (PLAN_ANALYTICS_EVENTS as readonly string[]).includes(value)
}

const journeyRules: Record<string, Record<string, readonly (string | boolean)[]>> = {
  estimator_opened: { workspace: ['full_suite', 'standalone_costing'] },
  blank_start: {}, saved_quality_start: {},
  saved_quality_selected: { has_rates: [true, false] },
  current_rate_applied: { rate_source: ['saved_recipe_rates', 'proposed_recipe_rates'] },
  rate_review_requested: {},
  valid_result_reached: { has_quantity: [true, false], journey_source: ['blank', 'saved_quality', 'saved_costing', 'restored_draft'] },
  save_attempted: { record_kind: ['costing', 'quotation'], is_new_version: [true, false] },
  save_succeeded: { record_kind: ['costing', 'quotation'], is_new_version: [true, false] },
  save_failed: { record_kind: ['costing', 'quotation'] },
  save_outcome_unknown: { record_kind: ['costing', 'quotation'] },
  new_version_created: { record_kind: ['costing', 'quotation'] },
  export_preview_opened: { mode: ['internal', 'customer'] },
  export_completed: { mode: ['internal', 'customer'] },
  export_failed: { mode: ['internal', 'customer'] },
  draft_detected: {}, draft_restored: {}, draft_discarded: {},
}

/** Journey events accept categorical context only, never arbitrary text or money. */
export function isPlanAnalyticsProperties(event: PlanAnalyticsEventName, value: unknown): value is PlanAnalyticsProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rules = journeyRules[event]
  return Object.entries(value).every(([key, item]) => {
    if (rules) return Object.hasOwn(rules, key) && rules[key].includes(item as string | boolean)
    return key.length > 0 && key.length <= 64 && (typeof item === 'string'
      || (typeof item === 'number' && Number.isFinite(item)) || typeof item === 'boolean' || item === null)
  })
}

/** Fire-and-forget browser event; the server derives the organization and plan. */
export async function trackPlanEvent(eventName: PlanAnalyticsEventName, properties: PlanAnalyticsProperties = {}): Promise<boolean> {
  if (typeof window === 'undefined' || !isPlanAnalyticsProperties(eventName, properties)) return false
  try {
    const response = await fetch('/api/analytics/plan-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ eventName, properties }),
      keepalive: true,
    })
    return response.ok
  } catch { return false }
}
