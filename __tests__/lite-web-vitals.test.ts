import { describe, expect, it } from 'vitest'
import {
  classifyWebVital,
  getDeviceClass,
  sanitizeWebVitalPayload,
} from '../lib/web-vitals'

describe('LST-12 & LST-13: Web Vitals Instrumentation & Privacy Safety', () => {
  it('correctly classifies LCP thresholds according to Google Web Vitals guidelines', () => {
    expect(classifyWebVital('LCP', 1500)).toBe('good')
    expect(classifyWebVital('LCP', 2500)).toBe('good')
    expect(classifyWebVital('LCP', 3000)).toBe('needs-improvement')
    expect(classifyWebVital('LCP', 4000)).toBe('needs-improvement')
    expect(classifyWebVital('LCP', 4500)).toBe('poor')
  })

  it('correctly classifies INP thresholds according to Google Web Vitals guidelines', () => {
    expect(classifyWebVital('INP', 100)).toBe('good')
    expect(classifyWebVital('INP', 200)).toBe('good')
    expect(classifyWebVital('INP', 350)).toBe('needs-improvement')
    expect(classifyWebVital('INP', 500)).toBe('needs-improvement')
    expect(classifyWebVital('INP', 600)).toBe('poor')
  })

  it('correctly classifies CLS thresholds according to Google Web Vitals guidelines', () => {
    expect(classifyWebVital('CLS', 0.05)).toBe('good')
    expect(classifyWebVital('CLS', 0.1)).toBe('good')
    expect(classifyWebVital('CLS', 0.18)).toBe('needs-improvement')
    expect(classifyWebVital('CLS', 0.25)).toBe('needs-improvement')
    expect(classifyWebVital('CLS', 0.35)).toBe('poor')
  })

  it('categorizes device classes properly across responsive viewport widths', () => {
    expect(getDeviceClass(320)).toBe('mobile')
    expect(getDeviceClass(390)).toBe('mobile')
    expect(getDeviceClass(430)).toBe('mobile')
    expect(getDeviceClass(768)).toBe('tablet')
    expect(getDeviceClass(1024)).toBe('desktop')
    expect(getDeviceClass(1440)).toBe('desktop')
  })

  it('strictly validates that telemetry payloads contain only non-sensitive metrics', () => {
    const safePayload: Record<string, unknown> = {
      name: 'LCP',
      value: 1240.5,
      rating: 'good',
      route: '/owner/estimator',
      deviceClass: 'desktop',
      language: 'hi',
      metricId: 'v5-1788134400000-1234567890123',
      scope: 'document',
    }
    expect(sanitizeWebVitalPayload(safePayload)).toBe(true)

    const unsafePayload1: Record<string, unknown> = {
      ...safePayload,
      party_name: 'Sundaram Weaves',
    }
    expect(sanitizeWebVitalPayload(unsafePayload1)).toBe(false)

    const unsafePayload2: Record<string, unknown> = {
      ...safePayload,
      yarn_rate: 115,
    }
    expect(sanitizeWebVitalPayload(unsafePayload2)).toBe(false)
  })
})
