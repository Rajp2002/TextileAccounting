'use client'

import { useSyncExternalStore } from 'react'
import { getMobileKeyboardSnapshot, getServerMobileKeyboardSnapshot, subscribeMobileViewport } from '@/lib/mobile-viewport'

/** Subscribe only to keyboard changes, not every viewport scroll/resize. */
export function useMobileKeyboard() {
    return useSyncExternalStore(subscribeMobileViewport, getMobileKeyboardSnapshot, getServerMobileKeyboardSnapshot)
}
