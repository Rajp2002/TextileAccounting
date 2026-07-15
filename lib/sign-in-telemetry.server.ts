import 'server-only'

import { cookies } from 'next/headers'
import { isSignInTraceId, SIGN_IN_TRACE_COOKIE } from '@/lib/sign-in-trace'

type SignInLogValue = string | number | boolean | null | undefined

function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
}

function roundMs(value: number) {
    return Math.round(value * 10) / 10
}

export class SignInServerTimer {
    private readonly startedAt = nowMs()
    private readonly phases: Record<string, number> = {}
    private logged = false

    constructor(
        private readonly event: string,
        private readonly traceId: string | null
    ) {}

    async measure<R>(phase: string, operation: () => R): Promise<Awaited<R>> {
        if (!this.traceId) return await operation()

        const startedAt = nowMs()
        try {
            return await operation()
        } finally {
            this.phases[`${phase}_ms`] = roundMs((this.phases[`${phase}_ms`] ?? 0) + nowMs() - startedAt)
        }
    }

    log(outcome: string, extra: Record<string, SignInLogValue> = {}) {
        if (!this.traceId || this.logged) return
        this.logged = true

        console.info(JSON.stringify({
            level: 'info',
            event: this.event,
            trace_id: this.traceId,
            outcome,
            total_ms: roundMs(nowMs() - this.startedAt),
            ...this.phases,
            ...extra,
        }))
    }
}

export function createSignInServerTimer(event: string, traceId: unknown) {
    return new SignInServerTimer(event, isSignInTraceId(traceId) ? traceId : null)
}

export async function createSignInServerTimerFromCookie(event: string) {
    const cookieStore = await cookies()
    return createSignInServerTimer(event, cookieStore.get(SIGN_IN_TRACE_COOKIE)?.value)
}

export async function persistSignInTraceCookie(traceId: unknown) {
    if (!isSignInTraceId(traceId)) return

    const cookieStore = await cookies()
    cookieStore.set(SIGN_IN_TRACE_COOKIE, traceId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 120,
    })
}
