import type { QueryClient } from '@tanstack/react-query'

// A tiny client-only registry lets logout/account deletion clear the active
// cache without importing the full query provider into every route's client
// graph. The provider sets this when a query-using subtree mounts.
export let globalQueryClient: QueryClient | null = null

export function setGlobalQueryClient(client: QueryClient | null) {
    globalQueryClient = client
}
