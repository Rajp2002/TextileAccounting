'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        gcTime: 1000 * 60 * 60 * 24, // 24 hours
                        staleTime: 1000 * 60 * 5, // 5 minutes
                        networkMode: 'offlineFirst',
                    },
                    mutations: {
                        networkMode: 'offlineFirst',
                    },
                },
            })
    )

    // Synchronous init — localStorage is always available in the browser,
    // so there's no need for a useEffect cycle that causes a flash.
    const [persister] = useState(() =>
        typeof window !== 'undefined'
            ? createSyncStoragePersister({ storage: window.localStorage })
            : null
    )

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: persister! }}
        >
            {children}
        </PersistQueryClientProvider>
    )
}
