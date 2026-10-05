// Deliberately has no network transport or authentication. The real Free hook
// runs, with only its cross-tab subscription replaced by an inert subscription.
export function createClient() {
    return { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }), signOut: async () => ({ error: null }), getUser: async () => ({ data: { user: null }, error: null }), getSession: async () => ({ data: { session: null }, error: null }) } }
}
