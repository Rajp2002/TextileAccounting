/**
 * Supabase SSR stores the session in one auth cookie or a set of numbered
 * chunks. PKCE verifier cookies are intentionally excluded: they do not prove
 * that a browser already has an authenticated session.
 */
export function isSupabaseAuthSessionCookie(
    name: string,
    projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID
): boolean {
    if (projectId) {
        const authCookieName = `sb-${projectId}-auth-token`
        return name === authCookieName || name.startsWith(`${authCookieName}.`)
    }

    return /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name)
}

const TERMINAL_AUTH_SESSION_ERROR_CODES = new Set([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
    'session_expired',
])

/**
 * These Auth errors mean the browser's cookie can no longer be refreshed.
 * Retrying the same cookie only repeats the failed request, so Proxy should
 * expire the complete chunked session and let the browser sign in again.
 */
export function getTerminalAuthSessionErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null

    const code = 'code' in error && typeof error.code === 'string'
        ? error.code
        : null

    return code && TERMINAL_AUTH_SESSION_ERROR_CODES.has(code) ? code : null
}
