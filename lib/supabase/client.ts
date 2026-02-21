import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
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
        // Log warning only in development or if strict mode isn't required 
        // to avoid noise during build if this is expected
        if (typeof window !== 'undefined') {
            console.warn('Supabase env vars missing or invalid. Using fallback for build.')
        }

        return createBrowserClient(
            'https://placeholder.supabase.co',
            key || 'placeholder-key'
        )
    }

    return createBrowserClient(url!, key!)
}
