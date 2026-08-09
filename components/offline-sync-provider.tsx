'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineSyncProvider({ children, scope }: { children: React.ReactNode; scope?: string | null }) {
    // Initialize background sync
    useOfflineSync(scope)
    const isOnline = useOnlineStatus()

    return (
        <>
            {!isOnline && (
                <div className="bg-yellow-100 text-yellow-800 text-xs px-4 py-2 text-center">
                    You are offline. Cached screens may remain visible, but new factory changes are online-only.
                </div>
            )}
            {children}
        </>
    )
}
