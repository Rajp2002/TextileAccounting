'use client'

import { useLayoutEffect } from 'react'
import { registerPwaRefreshGuard } from '@/lib/pwa-refresh-safety'

export function usePwaRefreshGuard(guard: () => boolean) {
  // Only committed editor state can approve a reload; abandoned renders cannot.
  useLayoutEffect(() => registerPwaRefreshGuard(guard), [guard])
}
