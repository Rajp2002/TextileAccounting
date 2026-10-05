export function createClient() { return { auth: {
resend: async () => ({ error: new URL(location.href).searchParams.has('rate-limit') ? { message: 'Too many requests. Please wait a minute before trying again.', status: 429 } : null }),
getSession: async () => ({ data: { session: null } }),
onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
getUser: async () => ({ data: { user: null } }),
} } }
