'use client'

import { useEffect, useRef } from 'react'
import { scheduleClientSessionCleanup } from '@/lib/client-storage-cleanup'
import { readLogoutTrace, recordLogoutCleanupCompleted } from '@/lib/logout-trace'

export function AuthBoundaryCleanup({ scope }: { scope: string | null }) {
    const scheduledScopeRef = useRef<string | null | undefined>(undefined)

    useEffect(() => {
        // React Strict Mode replays effects in development. Cleanup is
        // deferred and idempotent, so a second schedule only adds IndexedDB
        // work and makes the post-login transition visibly noisier.
        if (scheduledScopeRef.current === scope) return
        scheduledScopeRef.current = scope

        // This component mounts only after server-side identity and tenant
        // checks have completed. It is therefore the safe startup point for
        // quarantined legacy IndexedDB cleanup.
        scheduleClientSessionCleanup({
            scope,
            clearScope: false,
            preservePwaSession: true,
            onComplete: (result) => {
                const trace = readLogoutTrace()
                if (trace) recordLogoutCleanupCompleted(trace.traceId, result)
            },
        })
    }, [scope])

    return null
}
