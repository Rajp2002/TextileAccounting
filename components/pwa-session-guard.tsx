'use client'

import { usePwaSessionGuard } from '@/hooks/use-pwa-session-guard'

/**
 * Thin client component wrapper around usePwaSessionGuard.
 * Mount this inside any server layout that needs PWA session protection.
 * It renders nothing — it only runs the guard logic as a side effect.
 */
export function PwaSessionGuard() {
    usePwaSessionGuard()
    return null
}
