'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState } from 'react'
import { setGlobalQueryClient } from '@/lib/query-client-registry'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => {
        const client = new QueryClient({
            defaultOptions: {
                queries: {
                    gcTime: 1000 * 60 * 60 * 24,
                    staleTime: 1000 * 60 * 5,
                    networkMode: 'offlineFirst',
                },
                mutations: {
                    networkMode: 'offlineFirst',
                },
            },
        })
        setGlobalQueryClient(client)
        return client
    })

    const [persister] = useState(() => (
        typeof window !== 'undefined'
            ? createSyncStoragePersister({ storage: window.localStorage })
            : null
    ))

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: persister! }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}
