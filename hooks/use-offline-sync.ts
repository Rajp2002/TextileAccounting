'use client'

import { useEffect } from 'react'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function useOfflineSync() {
    const isOnline = useOnlineStatus()
    const supabase = createClient()

    useEffect(() => {
        if (isOnline) {
            syncMutations()
        }
    }, [isOnline])

    const syncMutations = async () => {
        const pendingMutations = await db.mutations.where('synced').equals(0).toArray()

        if (pendingMutations.length === 0) return

        toast.info(`Syncing ${pendingMutations.length} offline changes...`)

        // 🔐 F-2 fix: Fetch the current user's org_id to force-inject into all mutations
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            toast.error('Cannot sync: not authenticated')
            return
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single()

        if (!profile?.org_id) {
            toast.error('Cannot sync: no org_id found for user')
            return
        }

        for (const mutation of pendingMutations) {
            try {
                const { table, type, data } = mutation
                const mutationData = data as Record<string, any>
                let error = null

                // Force-overwrite org_id with the authenticated user's org_id
                const securedData = { ...mutationData, org_id: profile.org_id }

                if (type === 'INSERT') {
                    const { error: insertError } = await supabase.from(table).insert({
                        ...securedData,
                        created_by: user.id
                    })
                    error = insertError
                } else if (type === 'UPDATE') {
                    // Assuming data has an id
                    const { id } = mutationData
                    const { id: _ignore, ...updateData } = securedData as Record<string, any>
                    const { error: updateError } = await supabase.from(table).update(updateData).eq('id', id)
                    error = updateError
                } else if (type === 'DELETE') {
                    const { id } = mutationData
                    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
                    error = deleteError
                }

                if (error) {
                    console.error('Sync failed for mutation', mutation, error)
                } else {
                    await db.mutations.update(mutation.id!, { synced: true })
                    await db.mutations.delete(mutation.id!) // Clear processed
                }
            } catch (err) {
                console.error('Unexpected error syncing', err)
            }
        }

        toast.success('Offline changes synced!')
    }
}
