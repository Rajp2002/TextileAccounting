import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
    if (client) return client

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Helper to validate URL
    const isValidUrl = (urlString: string | undefined) => {
        if (!urlString) return false
        try {
            const u = new URL(urlString)
            return u.protocol === 'http:' || u.protocol === 'https:'
        } catch {
            return false
        }
    }

    if (!isValidUrl(url) || !key) {
        console.error('[Supabase Client] ENV VARS MISSING!', { url: url ?? 'UNDEFINED', keyPresent: !!key })

        if (typeof window !== 'undefined') {
            console.error('NEXT_PUBLIC_SUPABASE_URL:', url)
            console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY present:', !!key)
        }

        return createBrowserClient(
            'https://placeholder.supabase.co',
            key || 'placeholder-key'
        )
    }

    client = createBrowserClient(url!, key!)
    return client
}

