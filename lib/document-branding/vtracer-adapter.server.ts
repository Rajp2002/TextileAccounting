import 'server-only'

import { convertBuffer } from '@visioncortex/vtracer'
import { sanitizeTracedSvg, type SanitizedLogoSvg, type SvgValidationErrorCode } from './svg-sanitize'

/** Pinned in package.json; recorded on every asset so a library update can be traced. */
export const VTRACER_VERSION = '1.0.0-alpha.4'

/**
 * Tested tracing profiles. `color-v1` keeps the logo's colours: colour
 * clustering, spline curves, small specks removed, at most 16 colours. A
 * black-and-white profile is deliberately not chosen automatically: on a
 * transparent logo it fills the background black, and turning a coloured logo
 * monochrome would change the brand.
 */
export const TRACE_PROFILES = {
  'color-v1': {
    clustering: 'color-cluster',
    hierarchical: 'stacked',
    mode: 'spline',
    filterSpeckle: 4,
    colorPrecision: 6,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 4,
    spliceThreshold: 45,
    maxColors: 16,
    pathPrecision: 2,
    optimize: 1,
  },
} as const

export type TraceProfileName = keyof typeof TRACE_PROFILES

export type TraceResult =
  | { ok: true; value: SanitizedLogoSvg; durationMs: number; processorVersion: string; profile: TraceProfileName }
  | { ok: false; code: 'trace_failed' | SvgValidationErrorCode; durationMs: number; processorVersion: string; profile: TraceProfileName }

/**
 * Trace a validated, normalised PNG into a sanitised SVG. This adapter owns
 * only the tracing call and the output check: permissions, plan access,
 * storage and document layout belong to its callers, so the library can be
 * swapped without touching them.
 */
export function traceLogoToSvg(png: Buffer, profile: TraceProfileName = 'color-v1'): TraceResult {
  const started = Date.now()
  let raw: string
  try {
    raw = convertBuffer(png, { ...TRACE_PROFILES[profile] })
  } catch {
    return { ok: false, code: 'trace_failed', durationMs: Date.now() - started, processorVersion: VTRACER_VERSION, profile }
  }
  const sanitized = sanitizeTracedSvg(raw)
  const durationMs = Date.now() - started
  if (!sanitized.ok) return { ok: false, code: sanitized.code, durationMs, processorVersion: VTRACER_VERSION, profile }
  return { ok: true, value: sanitized.value, durationMs, processorVersion: VTRACER_VERSION, profile }
}
