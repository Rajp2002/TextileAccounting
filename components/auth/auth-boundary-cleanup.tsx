'use client'

import { useEffect } from 'react'
import { scheduleClientSessionCleanup } from '@/lib/client-storage-cleanup'
import { readLogoutTrace, recordLogoutCleanupCompleted } from '@/lib/logout-trace'

export function AuthBoundaryCleanup({ scope }: { scope: string | null }) {
    useEffect(() => {
        // This component mounts only after server-side identity and tenant
        // checks have completed. It is therefore the safe startup point for
        // quarantined legacy IndexedDB cleanup.
        scheduleClientSessionCleanup({
            scope,
            clearScope: false,
            onComplete: (result) => {
                const trace = readLogoutTrace()
                if (trace) recordLogoutCleanupCompleted(trace.traceId, result)
            },
        })
    }, [scope])

    return null
}
