'use client'

import { useEffect, useRef } from 'react'
import { createRouteMilestoneTracker, diagnosticRoute } from '@/lib/route-milestones'

type RouteMilestonesProps = {
    route: string
    shellVisible: boolean
    primaryUsable: boolean
    secondaryReady?: boolean
}

function mark(name: string) {
    try {
        if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
            // Keep long-lived installed sessions bounded without clearing unrelated marks.
            if (performance.getEntriesByName(name, 'mark').length >= 100) performance.clearMarks(name)
            performance.mark(name)
        }
    } catch {
        // Performance marks are diagnostic only and must never affect the UI.
    }
}

export function RouteMilestones({
    route,
    shellVisible,
    primaryUsable,
    secondaryReady = false,
}: RouteMilestonesProps) {
    const record = useRef(createRouteMilestoneTracker(mark))

    useEffect(() => {
        record.current(route, { shell: shellVisible, primary: primaryUsable, secondary: secondaryReady })
    }, [primaryUsable, route, secondaryReady, shellVisible])

    return (
        <span
            aria-hidden="true"
            className="sr-only"
            data-route={diagnosticRoute(route)}
            data-route-shell-visible={shellVisible ? 'true' : 'false'}
            data-route-primary-usable={primaryUsable ? 'true' : 'false'}
            data-route-secondary-ready={secondaryReady ? 'true' : 'false'}
        />
    )
}
