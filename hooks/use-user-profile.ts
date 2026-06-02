'use client'

import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

function subscribeToHydration(callback: () => void) {
    const timeout = window.setTimeout(callback, 0)
    return () => window.clearTimeout(timeout)
}

function getClientSnapshot() {
    return true
}

function getServerSnapshot() {
    return false
}

function useHydrated() {
    return useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot)
}

/**
 * Shared hook for the user profile query.
 * Eliminates the duplicate `user_profile` queryFn in every page component
 * and uses a 30-minute staleTime since profiles rarely change mid-session.
 */
export function useUserProfile() {
    const supabase = createClient()
    const mounted = useHydrated()

    const query = useQuery({
        queryKey: ['user_profile_id'], // Placeholder key we'll refresh
        enabled: mounted,
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('profiles')
                .select('org_id, role, full_name, phone, whatsapp_number, whatsapp_opted_in')
                .eq('id', user.id)
                .single()

            if (error) throw error
            return { ...data, userId: user.id }
        },
        staleTime: 1000 * 60 * 30, // 30 minutes — profile rarely changes
    })

    return {
        ...query,
        data: mounted ? query.data : undefined,
        isLoading: !mounted || query.isLoading,
        isPending: !mounted || query.isPending,
    }
}
