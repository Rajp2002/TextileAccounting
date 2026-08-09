'use client'

import { useEffect, useRef } from 'react'

type RouteMilestonesProps = {
    route: string
    shellVisible: boolean
    primaryUsable: boolean
    secondaryReady?: boolean
}

function mark(name: string) {
    try {
        if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
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
    const marked = useRef({ shell: false, primary: false, secondary: false })

    useEffect(() => {
        if (shellVisible && !marked.current.shell) {
            marked.current.shell = true
            mark('route_shell_visible')
            mark(`route_shell_visible:${route}`)
        }
        if (primaryUsable && !marked.current.primary) {
            marked.current.primary = true
            mark('route_primary_usable')
            mark(`route_primary_usable:${route}`)
        }
        if (secondaryReady && !marked.current.secondary) {
            marked.current.secondary = true
            mark('route_secondary_ready')
            mark(`route_secondary_ready:${route}`)
        }
    }, [primaryUsable, route, secondaryReady, shellVisible])

    return (
        <span
            aria-hidden="true"
            className="sr-only"
            data-route={route}
            data-route-shell-visible={shellVisible ? 'true' : 'false'}
            data-route-primary-usable={primaryUsable ? 'true' : 'false'}
            data-route-secondary-ready={secondaryReady ? 'true' : 'false'}
        />
    )
}
