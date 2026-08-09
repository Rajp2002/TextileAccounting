import type { QueryClient } from '@tanstack/react-query'

// A tiny client-only registry lets logout/account deletion clear the active
// cache without importing the full query provider into every route's client
// graph. The provider sets this when a query-using subtree mounts.
export let globalQueryClient: QueryClient | null = null
let activeQueryScope: string | null = null

export function setGlobalQueryClient(client: QueryClient | null, scope: string | null = null) {
    globalQueryClient = client
    activeQueryScope = client ? scope : null
}

export function getActiveQueryScope() {
    return activeQueryScope
}

export function unregisterQueryClient(client: QueryClient) {
    if (globalQueryClient !== client) return

    globalQueryClient = null
    activeQueryScope = null
}

/**
 * Detach the active cache namespace synchronously at the logout boundary.
 * Physical storage deletion is deliberately handled by the caller later.
 */
export function detachActiveQueryNamespace() {
    const retiredScope = activeQueryScope
    globalQueryClient?.clear()
    globalQueryClient = null
    activeQueryScope = null
    return retiredScope
}
