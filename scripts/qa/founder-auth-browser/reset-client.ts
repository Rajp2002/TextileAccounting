// Synthetic transport for the actual recovery form; no hosted Auth calls.
export function createClient() {
    return { auth: {
        getSession: async () => ({ data: { session: { user: { id: 'synthetic-recovery-user' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        updateUser: async (input: { password: string }) => (await fetch('/fixture/reset-password', { method: 'POST', body: JSON.stringify(input) })).json(),
        signOut: async () => (await fetch('/fixture/reset-signout', { method: 'POST' })).json(),
    } }
}
