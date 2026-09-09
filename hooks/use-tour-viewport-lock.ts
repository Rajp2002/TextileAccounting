'use client'

import { useEffect, type RefObject } from 'react'
import { lockTourViewport } from '@/lib/tutorial-viewport-lock'

export function useTourViewportLock(active: boolean, panel: RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        if (!active || !panel.current) return
        return lockTourViewport(panel.current)
    }, [active, panel])
}
