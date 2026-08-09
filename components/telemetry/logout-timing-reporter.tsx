'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
    clearLogoutTrace,
    markLogoutTraceStage,
    readLogoutTrace,
    type LogoutClientStage,
    type LogoutTrace,
} from '@/lib/logout-trace'

function reportStage(trace: LogoutTrace, stage: LogoutClientStage, observedAt: number) {
    const duration = (value: number | undefined) => value ? value - trace.clickedAt : null

    void fetch('/api/telemetry/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
            traceId: trace.traceId,
            stage,
            tapToFeedbackMs: 0,
            tapToCacheNamespaceRotatedMs: duration(trace.namespaceRotatedAt),
            tapToSignoutNavigationStartedMs: duration(trace.signoutNavigationStartedAt),
            tapToLoginPaintedMs: duration(trace.loginPaintedAt),
            tapToLoginPrimaryReadyMs: duration(trace.loginPrimaryReadyAt),
            tapToLegacyCleanupCompletedMs: duration(trace.cleanupCompletedAt),
            cleanupSucceeded: trace.cleanupSucceeded ?? null,
            observedMs: observedAt - trace.clickedAt,
        }),
    }).catch(() => {
        // Best-effort telemetry: never surface failures to the user.
    })
}

export function LogoutTimingReporter() {
    const pathname = usePathname()

    useEffect(() => {
        if (!pathname.startsWith('/login')) return

        const initialTrace = readLogoutTrace()
        if (!initialTrace) return

        let cancelled = false
        let firstFrame = 0
        let secondFrame = 0
        let cleanupPoll = 0
        let cleanupTimeout = 0
        const reported = new Set<LogoutClientStage>()

        const report = (stage: LogoutClientStage, observedAt = Date.now()) => {
            if (cancelled || reported.has(stage)) return
            const trace = readLogoutTrace()
            if (!trace || trace.traceId !== initialTrace.traceId) return
            reported.add(stage)
            reportStage(trace, stage, observedAt)
        }

        const maybeReportCleanup = () => {
            const trace = readLogoutTrace()
            if (trace?.traceId === initialTrace.traceId && trace.cleanupCompletedAt) {
                report('legacy_cleanup_completed', trace.cleanupCompletedAt)
                window.clearInterval(cleanupPoll)
                window.clearTimeout(cleanupTimeout)
                if (reported.has('login_primary_ready')) clearLogoutTrace()
            }
        }

        firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                if (cancelled) return

                const painted = markLogoutTraceStage(initialTrace.traceId, 'login_painted')
                report('login_painted', painted.loginPaintedAt)

                if (document.querySelector('[data-login-primary="true"]:not([disabled])')) {
                    const ready = markLogoutTraceStage(initialTrace.traceId, 'login_primary_ready')
                    report('login_primary_ready', ready.loginPrimaryReadyAt)
                }

                maybeReportCleanup()
                cleanupPoll = window.setInterval(maybeReportCleanup, 100)
                cleanupTimeout = window.setTimeout(() => {
                    maybeReportCleanup()
                    window.clearInterval(cleanupPoll)
                    if (reported.has('login_primary_ready')) clearLogoutTrace()
                }, 10_000)
            })
        })

        return () => {
            cancelled = true
            window.cancelAnimationFrame(firstFrame)
            window.cancelAnimationFrame(secondFrame)
            window.clearInterval(cleanupPoll)
            window.clearTimeout(cleanupTimeout)
        }
    }, [pathname])

    return null
}
