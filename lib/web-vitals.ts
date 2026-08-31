/** Content-free document-level telemetry. No URLs, DOM entries or user IDs. */
export type WebVitalMetricName = 'LCP' | 'INP' | 'CLS'
export type DeviceClass = 'mobile' | 'tablet' | 'desktop'
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor'
export interface WebVitalMetric {
  name: WebVitalMetricName
  value: number
  rating: WebVitalRating
  metricId: string
  route: '/owner/estimator'
  scope: 'document'
  deviceClass: DeviceClass
  language: 'en' | 'hi' | 'gu'
}
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, INP: { good: 200, poor: 500 }, CLS: { good: 0.1, poor: 0.25 },
}
export function classifyWebVital(name: WebVitalMetricName, value: number): WebVitalRating {
  const threshold = WEB_VITALS_THRESHOLDS[name]
  return value <= threshold.good ? 'good' : value <= threshold.poor ? 'needs-improvement' : 'poor'
}
export function getDeviceClass(width: number): DeviceClass {
  return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
}
export function sanitizeWebVitalPayload(payload: unknown): payload is WebVitalMetric {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const p = payload as Record<string, unknown>
  const keys = ['name', 'value', 'rating', 'metricId', 'route', 'scope', 'deviceClass', 'language']
  return Object.keys(p).length === keys.length && Object.keys(p).every(key => keys.includes(key))
    && ['LCP', 'INP', 'CLS'].includes(String(p.name))
    && typeof p.value === 'number' && Number.isFinite(p.value) && p.value >= 0 && p.value <= 86_400_000
    && p.rating === classifyWebVital(p.name as WebVitalMetricName, p.value)
    && typeof p.metricId === 'string' && /^v5-\d{13}-\d{13}$/.test(p.metricId)
    && p.route === '/owner/estimator' && p.scope === 'document'
    && ['mobile', 'tablet', 'desktop'].includes(String(p.deviceClass))
    && ['en', 'hi', 'gu'].includes(String(p.language))
}
export async function reportWebVital(metric: WebVitalMetric): Promise<boolean> {
  if (typeof window === 'undefined' || !sanitizeWebVitalPayload(metric)) return false
  try {
    const response = await fetch('/api/analytics/web-vitals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric), keepalive: true,
    })
    return response.ok
  } catch { return false }
}

let initialized = false
export function initWebVitals(options: {
  route: '/owner/estimator'
  language?: 'en' | 'hi' | 'gu'
  onReport?: (metric: WebVitalMetric) => void
}): () => void {
  const noop = () => undefined
  if (typeof window === 'undefined' || initialized) return noop
  const navigation = performance.getEntriesByType('navigation')[0]
  // Buffered entries belong to the original document, not a later SPA route.
  if (!navigation || new URL(navigation.name).pathname !== options.route) return noop
  initialized = true
  const context = { route: options.route, scope: 'document' as const,
    deviceClass: getDeviceClass(window.innerWidth), language: options.language ?? 'en' }
  void import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
    const report = (metric: import('web-vitals').Metric) => {
      if (metric.name !== 'LCP' && metric.name !== 'INP' && metric.name !== 'CLS') return
      const payload: WebVitalMetric = { ...context, name: metric.name, value: metric.value,
        rating: classifyWebVital(metric.name, metric.value), metricId: metric.id }
      void (options.onReport ?? reportWebVital)(payload)
    }
    onCLS(report)
    onINP(report)
    onLCP(report)
  }).catch(() => { initialized = false })
  // Intentionally document lifetime, including SPA navigation and hidden
  // reports. Register once, not once per React mount/language change.
  return noop
}
