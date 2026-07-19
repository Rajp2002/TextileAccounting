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

export function getSupabaseAuthSessionCookieNames(
    cookies: ReadonlyArray<{ name: string }>,
    projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID
): string[] {
    return cookies
        .map(({ name }) => name)
        .filter((name) => isSupabaseAuthSessionCookie(name, projectId))
}

/**
 * Auth retries should retain the browser session during temporary network
 * failures. These errors instead prove that the persisted session can no
 * longer be refreshed and its cookies should be discarded.
 */
export function isStaleSupabaseAuthSessionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const authError = error as { code?: unknown; message?: unknown }
    const code = typeof authError.code === 'string' ? authError.code : ''

    if (
        code === 'refresh_token_not_found' ||
        code === 'refresh_token_already_used' ||
        code === 'session_not_found' ||
        code === 'session_expired' ||
        code === 'bad_jwt'
    ) {
        return true
    }

    const message = typeof authError.message === 'string' ? authError.message : ''
    return /invalid refresh token|refresh token not found|auth session missing/i.test(message)
}
