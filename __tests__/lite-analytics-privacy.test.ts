import { describe, expect, it } from 'vitest'
import {
  PLAN_ANALYTICS_EVENTS,
  isPlanAnalyticsEvent,
  type PlanAnalyticsEventName,
  type PlanAnalyticsProperties,
} from '../lib/plan-analytics'

describe('LST-07: Privacy-Safe Telemetry & Analytics Contract', () => {
  const REQUIRED_LITE_EVENTS: PlanAnalyticsEventName[] = [
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
  ]

  it('recognizes all required Weavly Lite telemetry events', () => {
    REQUIRED_LITE_EVENTS.forEach(event => {
      expect(isPlanAnalyticsEvent(event)).toBe(true)
      expect(PLAN_ANALYTICS_EVENTS).toContain(event)
    })
  })

  it('enforces that event properties strictly exclude sensitive business content', () => {
    const FORBIDDEN_CONTENT_KEYS = [
      'party_name',
      'customer_name',
      'quality_name',
      'fabric_name',
      'yarn_name',
      'yarn_rate',
      'price_per_m',
      'selling_price',
      'cost_per_m',
      'margin_pct',
      'expected_profit',
      'notes',
      'internal_notes',
      'customer_terms',
      'construction_details',
      'warp_rows',
      'weft_rows',
      'form_values',
    ]

    function validatePrivacySafeProperties(props: PlanAnalyticsProperties): boolean {
      const keys = Object.keys(props)
      for (const key of keys) {
        if (FORBIDDEN_CONTENT_KEYS.includes(key.toLowerCase())) {
          return false
        }
      }
      return true
    }

    // Safe sample events
    const sampleValidResultEvent: PlanAnalyticsProperties = {
      has_quantity: true,
      workspace: 'lite_or_base',
    }
    expect(validatePrivacySafeProperties(sampleValidResultEvent)).toBe(true)

    const sampleSaveEvent: PlanAnalyticsProperties = {
      record_kind: 'costing',
      is_new_version: false,
    }
    expect(validatePrivacySafeProperties(sampleSaveEvent)).toBe(true)

    const sampleExportEvent: PlanAnalyticsProperties = {
      mode: 'customer',
    }
    expect(validatePrivacySafeProperties(sampleExportEvent)).toBe(true)

    // Unsafe samples containing sensitive business data
    const unsafeSample1: PlanAnalyticsProperties = {
      quality_name: '58" Poly Satin 75x80',
      price_per_m: 42.5,
    }
    expect(validatePrivacySafeProperties(unsafeSample1)).toBe(false)

    const unsafeSample2: PlanAnalyticsProperties = {
      party_name: 'Shree Ram Textiles',
      yarn_rate: 110,
    }
    expect(validatePrivacySafeProperties(unsafeSample2)).toBe(false)
  })
})
