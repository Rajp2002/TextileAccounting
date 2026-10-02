'use client'

import { useLayoutEffect } from 'react'
import { registerPwaInstallBlocker } from '@/lib/pwa-workflow-success'

/** Keep reminders away from unfinished work using the committed editor state. */
export function usePwaInstallBlocker(blocked: boolean) {
    useLayoutEffect(() => registerPwaInstallBlocker(() => blocked), [blocked])
}
