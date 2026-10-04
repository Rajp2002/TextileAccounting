'use client'

import { mayPersistQuery } from '@/lib/sensitive-routes'
import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
    AUTH_CACHE_VERSION,
    getQueryPersistenceKey,
    isPrincipalCacheScope,
} from '@/lib/auth-cache-scope'
import {
    setGlobalQueryClient,
    unregisterQueryClient,
} from '@/lib/query-client-registry'

type QueryProviderProps = {
    children: React.ReactNode
    /** A scope derived from server-verified identity. */
    scope?: string | null
}

export default function QueryProvider({ children, scope }: QueryProviderProps) {
    const verifiedScope = isPrincipalCacheScope(scope) ? scope : null

    return verifiedScope
        ? <ScopedQueryProvider key={verifiedScope} scope={verifiedScope}>{children}</ScopedQueryProvider>
        : <MemoryQueryProvider key="memory-only">{children}</MemoryQueryProvider>
}

function createQueryClient() {
    return new QueryClient({
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
}

function QueryClientRegistration({ queryClient, scope }: { queryClient: QueryClient; scope: string | null }) {
    useEffect(() => {
        setGlobalQueryClient(queryClient, scope)
        return () => unregisterQueryClient(queryClient)
    }, [queryClient, scope])

    return null
}

function subscribeToHydration(callback: () => void) {
    const timeout = window.setTimeout(callback, 0)
    return () => window.clearTimeout(timeout)
}

function getClientHydrationSnapshot() {
    return true
}

function getServerHydrationSnapshot() {
    return false
}

function MemoryQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => {
        return createQueryClient()
    })

    return (
        <QueryClientProvider client={queryClient}>
            <QueryClientRegistration queryClient={queryClient} scope={null} />
            {children}
        </QueryClientProvider>
    )
}

function ScopedQueryProvider({ children, scope }: { children: React.ReactNode; scope: string }) {
    const [queryClient] = useState(createQueryClient)
    const hydrated = useSyncExternalStore(
        subscribeToHydration,
        getClientHydrationSnapshot,
        getServerHydrationSnapshot,
    )
    const persister = useMemo<ReturnType<typeof createSyncStoragePersister> | null>(() => {
        if (!hydrated) return null

        try {
            return createSyncStoragePersister({
                storage: window.localStorage,
                key: getQueryPersistenceKey(scope),
            })
        } catch {
            // A storage-restricted browser remains safe with the in-memory
            // client; persistence is an enhancement, never an auth dependency.
            return null
        }
    }, [hydrated, scope])

    if (!persister) {
        return (
            <QueryClientProvider client={queryClient}>
                <QueryClientRegistration queryClient={queryClient} scope={scope} />
                {children}
            </QueryClientProvider>
        )
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, buster: AUTH_CACHE_VERSION, dehydrateOptions: { shouldDehydrateQuery: query => mayPersistQuery(query) && defaultShouldDehydrateQuery(query), shouldDehydrateMutation: () => false } }}
        >
            <QueryClientRegistration queryClient={queryClient} scope={scope} />
            {children}
        </PersistQueryClientProvider>
    )
}
