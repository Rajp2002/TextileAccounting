'use client'

import { useEffect } from 'react'
import { subscribeMobileViewport } from '@/lib/mobile-viewport'

export function MobileViewport() {
    // Keep portal dimensions current even on auth screens without navigation.
    useEffect(() => subscribeMobileViewport(() => {}), [])
    return null
}
