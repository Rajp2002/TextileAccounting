'use client'

import { useCallback, useEffect } from 'react'
import { db } from '@/lib/db'
import { toast } from 'sonner'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function useOfflineSync() {
    const isOnline = useOnlineStatus()
    const syncMutations = useCallback(async () => {
        const pendingMutations = await db.mutations.where('synced').equals(0).toArray()

        if (pendingMutations.length === 0) return

        await db.mutations.where('synced').equals(0).delete()
        toast.error(
            `${pendingMutations.length} unsupported offline change${pendingMutations.length === 1 ? '' : 's'} discarded. Re-enter it while online.`
        )
    }, [])

    useEffect(() => {
        if (!isOnline) return
        void syncMutations()
    }, [isOnline, syncMutations])
}
