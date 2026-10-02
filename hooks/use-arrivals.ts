'use client'

import { useEffect, useState } from 'react'
import { detectArrivals } from '@/lib/arrivals'

const ARRIVAL_MS = 1600

/**
 * Ids that joined `ids` after the first render, for long enough to play the
 * `ui-row-arrive` highlight. Pass the full, unfiltered list so filtering never
 * looks like an arrival.
 */
export function useArrivals(ids: readonly string[]): ReadonlySet<string> {
    const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(ids))
    const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set())

    // Derived from the previous render's list, so it is computed while rendering.
    const fresh = detectArrivals(seen, ids)
    if (fresh.length > 0) {
        setSeen(new Set([...seen, ...fresh]))
        setArrived(new Set([...arrived, ...fresh]))
    }

    useEffect(() => {
        if (arrived.size === 0) return
        const timer = window.setTimeout(() => setArrived(new Set()), ARRIVAL_MS)
        return () => window.clearTimeout(timer)
    }, [arrived])

    return arrived
}
