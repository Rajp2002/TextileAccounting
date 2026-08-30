/**
 * Web Vitals Telemetry Instrumentation for Weavly Lite
 *
 * Implements privacy-safe client-side monitoring for:
 * - LCP (Largest Contentful Paint)
 * - INP (Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 *
 * Enforces strict data minimization: only route, device class, active language,
 * and entitlement are attached. Zero business content or user identity.
 */

export type WebVitalMetricName = 'LCP' | 'INP' | 'CLS'
export type DeviceClass = 'mobile' | 'tablet' | 'desktop'
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor'

export interface WebVitalMetric {
  name: WebVitalMetricName
  value: number
  rating: WebVitalRating
  route: string
  deviceClass: DeviceClass
  language: 'en' | 'hi' | 'gu'
  entitlement: 'lite' | 'base' | 'full'
  timestamp: number
}

export const WEB_VITALS_THRESHOLDS: Record<WebVitalMetricName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
}

export function classifyWebVital(name: WebVitalMetricName, value: number): WebVitalRating {
  const threshold = WEB_VITALS_THRESHOLDS[name]
  if (!threshold) return 'good'
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

export function getDeviceClass(width: number): DeviceClass {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

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
  'notes',
  'user_id',
  'email',
  'phone',
]

export function sanitizeWebVitalPayload(payload: Record<string, unknown>): boolean {
  const keys = Object.keys(payload)
  for (const key of keys) {
    if (FORBIDDEN_CONTENT_KEYS.includes(key.toLowerCase())) {
      return false
    }
  }
  return true
}

export function reportWebVital(metric: WebVitalMetric) {
  if (typeof window === 'undefined') return

  const payload = {
    name: metric.name,
    value: Math.round(metric.value * 100) / 100,
    rating: metric.rating,
    route: metric.route,
    deviceClass: metric.deviceClass,
    language: metric.language,
    entitlement: metric.entitlement,
    timestamp: metric.timestamp,
  }

  if (!sanitizeWebVitalPayload(payload)) return

  void fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined)
}

export function initWebVitals(options: {
  route: string
  language?: 'en' | 'hi' | 'gu'
  entitlement?: 'lite' | 'base' | 'full'
  onReport?: (metric: WebVitalMetric) => void
}): () => void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => undefined
  }

  const route = options.route || '/owner/estimator'
  const language = options.language || 'en'
  const entitlement = options.entitlement || 'lite'
  const deviceClass = getDeviceClass(window.innerWidth || 1024)
  const onReport = options.onReport || reportWebVital

  const observers: PerformanceObserver[] = []

  // 1. LCP Observer
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
      if (lastEntry && Number.isFinite(lastEntry.startTime)) {
        const value = lastEntry.startTime
        onReport({
          name: 'LCP',
          value,
          rating: classifyWebVital('LCP', value),
          route,
          deviceClass,
          language,
          entitlement,
          timestamp: Date.now(),
        })
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    observers.push(lcpObserver)
  } catch {
    // Observer not supported in this environment
  }

  // 2. CLS Observer
  try {
    let clsValue = 0
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
        if (!layoutShift.hadRecentInput && layoutShift.value) {
          clsValue += layoutShift.value
        }
      }
      onReport({
        name: 'CLS',
        value: clsValue,
        rating: classifyWebVital('CLS', clsValue),
        route,
        deviceClass,
        language,
        entitlement,
        timestamp: Date.now(),
      })
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
    observers.push(clsObserver)
  } catch {
    // Observer not supported
  }

  // 3. INP / Interaction Observer
  try {
    let maxDuration = 0
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const eventEntry = entry as PerformanceEntry & { duration?: number }
        if (eventEntry.duration && eventEntry.duration > maxDuration) {
          maxDuration = eventEntry.duration
          onReport({
            name: 'INP',
            value: maxDuration,
            rating: classifyWebVital('INP', maxDuration),
            route,
            deviceClass,
            language,
            entitlement,
            timestamp: Date.now(),
          })
        }
      }
    })
    inpObserver.observe({ type: 'event', buffered: true })
    observers.push(inpObserver)
  } catch {
    // Observer not supported
  }

  return () => {
    observers.forEach((observer) => {
      try {
        observer.disconnect()
      } catch {
        // Disconnect safe ignore
      }
    })
  }
}
