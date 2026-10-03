import { sanitizeTimingMs } from '@/lib/sign-in-trace'

/**
 * Why an installed-app intro ended and how far its start-up got, sent once per
 * launch by the pre-paint policy's handle (lib/intro/intro-policy.ts) so a
 * launch that shows only a black screen can be explained from the logs.
 * Timings are `performance.now()` readings: milliseconds since the launch began.
 */
export const INTRO_TELEMETRY_PATH = '/api/telemetry/intro'

const MAX_REPORT_LENGTH = 1_000
const MAX_DETAIL_LENGTH = 160

const END_REASONS = new Set([
    'complete',
    'skip',
    'interaction',
    'watchdog',
    'error',
    'degrade',
    'context_lost',
    'pagehide',
    'unmount',
    'runtime_failed',
    'aborted',
])

/** Report key -> log field. `d` and `end` are set by the handle itself. */
const STEPS = {
    d: 'decided_ms',
    dcl: 'dcl_ms',
    effect: 'effect_ms',
    runtime: 'runtime_ms',
    init: 'init_ms',
    images: 'images_ms',
    gl: 'gl_ms',
    started: 'started_ms',
    frame1: 'first_frame_ms',
    end: 'end_ms',
} as const

/** Start-up steps the page marks as it reaches them. */
export type IntroStep = Exclude<keyof typeof STEPS, 'd' | 'end'>

export type IntroReport = {
    surface: 'app-login'
    reason: string
    detail: string | null
    forced: boolean
} & Record<(typeof STEPS)[keyof typeof STEPS], number | null>

export function parseIntroReport(text: string): IntroReport | null {
    if (text.length > MAX_REPORT_LENGTH) return null
    let body: unknown
    try {
        body = JSON.parse(text)
    } catch {
        return null
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    const report = body as Record<string, unknown>
    if (report.s !== 'app-login' || typeof report.reason !== 'string' || !END_REASONS.has(report.reason)) return null

    const detail = typeof report.detail === 'string'
        ? report.detail.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_DETAIL_LENGTH) || null
        : null
    const steps = Object.fromEntries(
        Object.entries(STEPS).map(([key, field]) => [field, sanitizeTimingMs(report[key])]),
    ) as Record<(typeof STEPS)[keyof typeof STEPS], number | null>

    return { surface: 'app-login', reason: report.reason, detail, forced: report.forced === true, ...steps }
}
