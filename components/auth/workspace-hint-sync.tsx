'use client'

import { useEffect } from 'react'

/**
 * Rendered by a workspace layout that found the Proxy routing hint out of
 * date. The route handler re-derives the value from the server-side plan, so
 * a failed or repeated request only costs one extra hop on the next launch.
 */
export function WorkspaceHintSync() {
    useEffect(() => {
        void fetch('/api/workspace-hint', {
            method: 'POST',
            cache: 'no-store',
            credentials: 'same-origin',
            keepalive: true,
        }).catch(() => {})
    }, [])

    return null
}
