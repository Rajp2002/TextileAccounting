'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
    // Initialize background sync
    useOfflineSync()
    const isOnline = useOnlineStatus()

    return (
        <>
            {!isOnline && (
                <div className="bg-yellow-100 text-yellow-800 text-xs px-4 py-2 text-center">
                    ⚡ You are offline — changes will sync when reconnected
                </div>
            )}
            {children}
        </>
    )
}
