export type PerfPhase = 'authSession' | 'profileOrgTier' | 'businessData'
export type PerfSurface = 'server' | 'client'

type PerfLogValue = string | number | boolean | null | undefined
type PerfLogExtra = Record<string, PerfLogValue>

const PHASE_LOG_KEYS: Record<PerfPhase, string> = {
    authSession: 'auth_session_ms',
    profileOrgTier: 'profile_org_tier_ms',
    businessData: 'business_data_ms',
}

function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
}

function roundMs(value: number) {
    return Math.round(value * 10) / 10
}

function formatValue(value: PerfLogValue) {
    if (value === undefined) return undefined
    if (typeof value === 'string') return JSON.stringify(value)
    return String(value)
}

function formatFields(fields: PerfLogExtra) {
    return Object.entries(fields)
        .map(([key, value]) => {
            const formatted = formatValue(value)
            return formatted === undefined ? null : `${key}=${formatted}`
        })
        .filter((value): value is string => Boolean(value))
        .join(' ')
}

export function isPerfLoggingEnabled() {
    if (process.env.NODE_ENV === 'development') return true

    // The explicit flag is server-only by default. Client bundles still log in dev.
    if (typeof window === 'undefined' && process.env.WEAVLY_PERF_LOGS === 'true') return true

    return false
}

export class PerfTimer {
    private readonly enabled = isPerfLoggingEnabled()
    private readonly startedAt = nowMs()
    private readonly phaseTimes: Record<PerfPhase, number> = {
        authSession: 0,
        profileOrgTier: 0,
        businessData: 0,
    }
    private supabaseCalls = 0

    constructor(
        private readonly route: string,
        private readonly surface: PerfSurface = 'server'
    ) {}

    async measure<R>(
        phase: PerfPhase,
        operation: () => R,
        supabaseCalls = 0
    ): Promise<Awaited<R>> {
        if (!this.enabled) return await operation()

        const start = nowMs()
        try {
            return await operation()
        } finally {
            this.phaseTimes[phase] += nowMs() - start
            this.supabaseCalls += supabaseCalls
        }
    }

    addSupabaseCalls(count: number) {
        if (!this.enabled) return
        this.supabaseCalls += count
    }

    log(extra: PerfLogExtra = {}) {
        if (!this.enabled) return

        const totalKey = this.surface === 'server' ? 'total_server_load_ms' : 'total_client_load_ms'
        const fields: PerfLogExtra = {
            route: this.route,
            surface: this.surface,
            [PHASE_LOG_KEYS.authSession]: roundMs(this.phaseTimes.authSession),
            [PHASE_LOG_KEYS.profileOrgTier]: roundMs(this.phaseTimes.profileOrgTier),
            [PHASE_LOG_KEYS.businessData]: roundMs(this.phaseTimes.businessData),
            [totalKey]: roundMs(nowMs() - this.startedAt),
            supabase_calls: this.supabaseCalls,
            ...extra,
        }

        console.info(`[perf] ${formatFields(fields)}`)
    }
}

export function createPerfTimer(route: string, surface: PerfSurface = 'server') {
    return new PerfTimer(route, surface)
}

export async function measurePerf<R>(
    options: {
        route: string
        surface?: PerfSurface
        phase: PerfPhase
        label?: string
        supabaseCalls?: number
        extra?: PerfLogExtra
    },
    operation: () => R
): Promise<Awaited<R>> {
    const timer = createPerfTimer(options.route, options.surface ?? 'server')
    let failed = false

    try {
        return await timer.measure(options.phase, operation, options.supabaseCalls ?? 0)
    } catch (error) {
        failed = true
        throw error
    } finally {
        timer.log({
            label: options.label,
            failed,
            ...options.extra,
        })
    }
}
