export const PLAN_ANALYTICS_EVENTS = [
  'estimator_opened',
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

/** Fire-and-forget browser event; the server derives the organization and plan. */
export function trackPlanEvent(eventName: PlanAnalyticsEventName, properties: PlanAnalyticsProperties = {}) {
  if (typeof window === 'undefined') return
  void fetch('/api/analytics/plan-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ eventName, properties }),
    keepalive: true,
  }).catch(() => undefined)
}
