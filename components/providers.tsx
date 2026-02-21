'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState, useEffect } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        gcTime: 1000 * 60 * 60 * 24, // 24 hours
                        staleTime: 1000 * 60 * 5, // 5 minutes
                        networkMode: 'offlineFirst', // Serve cached data immediately when offline
                    },
                    mutations: {
                        networkMode: 'offlineFirst',
                    },
                },
            })
    )

    const [persister, setPersister] = useState<any>(null)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const localStoragePersister = createSyncStoragePersister({
                storage: window.localStorage,
            })
            setPersister(localStoragePersister)
        }
    }, [])

    if (!persister) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}
