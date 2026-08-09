'use client'

import { useCallback, useEffect } from 'react'
import { discardPendingMutations, getPendingMutations } from '@/lib/db'
import { toast } from 'sonner'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { isPrincipalCacheScope } from '@/lib/auth-cache-scope'

export function useOfflineSync(scope?: string | null) {
    const isOnline = useOnlineStatus()
    const syncMutations = useCallback(async () => {
        if (!isPrincipalCacheScope(scope)) return

        const pendingMutations = await getPendingMutations(scope)

        if (pendingMutations.length === 0) return

        await discardPendingMutations(scope)
        toast.error(
            `${pendingMutations.length} unsupported offline change${pendingMutations.length === 1 ? '' : 's'} discarded. Re-enter it while online.`
        )
    }, [scope])

    useEffect(() => {
        if (!isOnline) return
        void syncMutations()
    }, [isOnline, syncMutations])
}
