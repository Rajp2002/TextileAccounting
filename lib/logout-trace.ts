import type { ClientSessionCleanupResult } from './client-storage-cleanup'

export const LOGOUT_TRACE_STORAGE_KEY = 'weavly:logout-trace'

export type LogoutClientStage =
    | 'logout_clicked'
    | 'cache_namespace_rotated'
    | 'signout_navigation_started'
    | 'login_painted'
    | 'login_primary_ready'
    | 'legacy_cleanup_completed'

export type LogoutTrace = {
    traceId: string
    clickedAt: number
    namespaceRotatedAt?: number
    signoutNavigationStartedAt?: number
    loginPaintedAt?: number
    loginPrimaryReadyAt?: number
    cleanupCompletedAt?: number
    cleanupSucceeded?: boolean
}

const STAGE_FIELDS: Record<LogoutClientStage, keyof LogoutTrace> = {
    logout_clicked: 'clickedAt',
    cache_namespace_rotated: 'namespaceRotatedAt',
    signout_navigation_started: 'signoutNavigationStartedAt',
    login_painted: 'loginPaintedAt',
    login_primary_ready: 'loginPrimaryReadyAt',
    legacy_cleanup_completed: 'cleanupCompletedAt',
}

function now() {
    return Date.now()
}

function markPerformance(name: string) {
    try {
        if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
            performance.mark(name)
        }
    } catch {
        // Transition marks are diagnostic only.
    }
}

export function createLogoutTraceId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = crypto.getRandomValues(new Uint8Array(16))
        return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
    }

    return `logout-${now()}-${Math.random().toString(16).slice(2)}`
}

export function isLogoutTraceId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9-]{20,80}$/i.test(value)
}

export function readLogoutTrace(): LogoutTrace | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.sessionStorage.getItem(LOGOUT_TRACE_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<LogoutTrace>
        if (!isLogoutTraceId(parsed.traceId) || typeof parsed.clickedAt !== 'number') return null
        return parsed as LogoutTrace
    } catch {
        return null
    }
}

function writeLogoutTrace(trace: LogoutTrace) {
    try {
        window.sessionStorage.setItem(LOGOUT_TRACE_STORAGE_KEY, JSON.stringify(trace))
    } catch {
        // Telemetry must never delay or fail auth transitions.
    }
}

export function startLogoutTrace(traceId: string) {
    const trace: LogoutTrace = { traceId, clickedAt: now() }
    writeLogoutTrace(trace)
    markPerformance('logout_clicked')
    return trace
}

export function markLogoutTraceStage(
    traceId: string,
    stage: LogoutClientStage,
    extra: Partial<Pick<LogoutTrace, 'cleanupSucceeded'>> = {},
) {
    const trace = readLogoutTrace()
    const nextTrace: LogoutTrace = trace?.traceId === traceId
        ? trace
        : { traceId, clickedAt: now() }
    const timestamp = now()
    const mutableTrace = nextTrace as unknown as Record<string, unknown>
    mutableTrace[STAGE_FIELDS[stage]] = timestamp
    if (stage === 'legacy_cleanup_completed' && extra.cleanupSucceeded !== undefined) {
        nextTrace.cleanupSucceeded = extra.cleanupSucceeded
    }
    writeLogoutTrace(nextTrace)
    markPerformance(stage)
    return nextTrace
}

export function recordLogoutCleanupCompleted(traceId: string, result: ClientSessionCleanupResult) {
    return markLogoutTraceStage(traceId, 'legacy_cleanup_completed', {
        cleanupSucceeded: result.errors.length === 0,
    })
}

export function clearLogoutTrace() {
    try {
        window.sessionStorage.removeItem(LOGOUT_TRACE_STORAGE_KEY)
    } catch {
        // Telemetry cleanup is best effort.
    }
}
