'use client'

import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { measurePerf } from '@/lib/perf'
import { useSettingsBootstrap } from '@/components/providers/settings-bootstrap-provider'

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
export function useUserProfile(perfRouteName?: string) {
    const supabase = createClient()
    const mounted = useHydrated()
    const settingsBootstrap = useSettingsBootstrap()

    const userQuery = useQuery({
        queryKey: ['auth_user_id'],
        enabled: mounted,
        queryFn: async () => {
            const getUserId = async () => {
                const { data: { user } } = await supabase.auth.getUser()
                return user?.id || null
            }

            return perfRouteName
                ? measurePerf(
                    {
                        route: perfRouteName,
                        surface: 'client',
                        phase: 'authSession',
                        label: 'useUserProfile.auth_user_id',
                        supabaseCalls: 1,
                    },
                    getUserId
                )
                : getUserId()
        },
        initialData: settingsBootstrap?.profile.userId,
        staleTime: 1000 * 60 * 30,
    })

    const userId = userQuery.data

    const query = useQuery({
        queryKey: ['user_profile_id', userId],
        enabled: mounted && !!userId,
        queryFn: async () => {
            const getProfile = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('org_id, role, full_name, phone, whatsapp_number, whatsapp_opted_in')
                    .eq('id', userId!)
                    .single()

                if (error) throw error
                return { ...data, userId }
            }

            return perfRouteName
                ? measurePerf(
                    {
                        route: perfRouteName,
                        surface: 'client',
                        phase: 'profileOrgTier',
                        label: 'useUserProfile.profile',
                        supabaseCalls: 1,
                    },
                    getProfile
                )
                : getProfile()
        },
        initialData: settingsBootstrap?.profile,
        staleTime: 1000 * 60 * 30,
    })

    // Settings now receives a tenant-scoped server bootstrap payload from its
    // layout. Keep that payload visible during the first client render instead
    // of replacing the whole page with a hydration-only skeleton. Other
    // callers without bootstrap data retain the previous loading behavior.
    const bootstrapProfile = settingsBootstrap?.profile
    const profile = mounted ? (query.data ?? bootstrapProfile) : bootstrapProfile

    return {
        ...query,
        data: profile,
        isLoading: !profile && (!mounted || userQuery.isLoading || query.isLoading),
        isPending: !profile && (!mounted || userQuery.isPending || query.isPending),
    }
}
