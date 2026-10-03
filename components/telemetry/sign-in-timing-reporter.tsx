'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
    isSignInTraceId,
    normalizeSignInDestination,
    SIGN_IN_TRACE_STORAGE_KEY,
    type SignInClientStage,
} from '@/lib/sign-in-trace'

type StoredSignInTrace = {
    traceId: string
    destination: string
    clickStartedAt: number
    actionCompletedAt: number
    authRoundTripMs: number
    cleanupWaitMs: number
    routePaintedAt?: number
}

function readTrace(): StoredSignInTrace | null {
    try {
        const raw = window.sessionStorage.getItem(SIGN_IN_TRACE_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<StoredSignInTrace>

        if (
            !isSignInTraceId(parsed.traceId) ||
            normalizeSignInDestination(parsed.destination) === '/other' ||
            typeof parsed.clickStartedAt !== 'number' ||
            typeof parsed.actionCompletedAt !== 'number' ||
            typeof parsed.authRoundTripMs !== 'number' ||
            typeof parsed.cleanupWaitMs !== 'number'
        ) {
            window.sessionStorage.removeItem(SIGN_IN_TRACE_STORAGE_KEY)
            return null
        }

        return parsed as StoredSignInTrace
    } catch {
        return null
    }
}

function writeTrace(trace: StoredSignInTrace) {
    try {
        window.sessionStorage.setItem(SIGN_IN_TRACE_STORAGE_KEY, JSON.stringify(trace))
    } catch {
        // Telemetry must never affect sign-in or dashboard use.
    }
}

function clearTrace() {
    try {
        window.sessionStorage.removeItem(SIGN_IN_TRACE_STORAGE_KEY)
    } catch {
        // Telemetry must never affect sign-in or dashboard use.
    }
}

function reportStage(trace: StoredSignInTrace, stage: SignInClientStage, observedAt: number) {
    const routePaintMs = trace.routePaintedAt
        ? trace.routePaintedAt - trace.actionCompletedAt
        : observedAt - trace.actionCompletedAt

    void fetch('/api/telemetry/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
            traceId: trace.traceId,
            stage,
            route: trace.destination,
            totalMs: observedAt - trace.clickStartedAt,
            authRoundTripMs: trace.authRoundTripMs,
            cleanupWaitMs: trace.cleanupWaitMs,
            routePaintMs,
            dashboardReadyMs: observedAt - trace.actionCompletedAt,
            postRouteDataMs: trace.routePaintedAt ? observedAt - trace.routePaintedAt : 0,
        }),
    }).catch(() => {
        // Best-effort telemetry: never surface failures to the user.
    })
}

export function SignInTimingReporter() {
    const pathname = usePathname()

    useEffect(() => {
        const trace = readTrace()
        if (!trace || normalizeSignInDestination(pathname) !== trace.destination) return

        let cancelled = false
        let firstFrame = 0
        let secondFrame = 0
        let timeout = 0
        let observer: MutationObserver | null = null

        const finish = (stage: 'dashboard_ready' | 'readiness_timeout') => {
            if (cancelled) return
            cancelled = true
            observer?.disconnect()
            window.clearTimeout(timeout)
            reportStage(trace, stage, Date.now())
            clearTrace()
        }

        firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                if (cancelled) return

                const paintedAt = Date.now()
                trace.routePaintedAt = paintedAt
                writeTrace(trace)
                reportStage(trace, 'route_painted', paintedAt)

                if (document.querySelector('[data-signin-ready="true"]')) {
                    finish('dashboard_ready')
                    return
                }

                observer = new MutationObserver(() => {
                    if (document.querySelector('[data-signin-ready="true"]')) {
                        finish('dashboard_ready')
                    }
                })
                observer.observe(document.body, { childList: true, subtree: true })
                timeout = window.setTimeout(() => finish('readiness_timeout'), 20_000)
            })
        })

        return () => {
            cancelled = true
            window.cancelAnimationFrame(firstFrame)
            window.cancelAnimationFrame(secondFrame)
            window.clearTimeout(timeout)
            observer?.disconnect()
        }
    }, [pathname])

    return null
}
