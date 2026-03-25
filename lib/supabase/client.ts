import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
    if (client) return client

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        // In production, missing env vars must be a hard failure — a placeholder
        // client would silently accept all data while sending it nowhere.
        throw new Error(
            '[Supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
            'Check your .env.local or Vercel environment variable configuration.'
        )
    }

    client = createBrowserClient(url, key)
    return client
}


