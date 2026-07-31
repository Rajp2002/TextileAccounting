import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isSupabaseAuthSessionCookie } from '../lib/supabase/auth-cookie'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('sign-in critical-path performance', () => {
    it('recognizes session cookies without mistaking the PKCE verifier for a session', () => {
        const projectId = 'exampleprojectref'

        expect(isSupabaseAuthSessionCookie(`sb-${projectId}-auth-token`, projectId)).toBe(true)
        expect(isSupabaseAuthSessionCookie(`sb-${projectId}-auth-token.0`, projectId)).toBe(true)
        expect(isSupabaseAuthSessionCookie(`sb-${projectId}-auth-token.1`, projectId)).toBe(true)
        expect(isSupabaseAuthSessionCookie(`sb-${projectId}-auth-token-code-verifier`, projectId)).toBe(false)
        expect(isSupabaseAuthSessionCookie('unrelated-cookie', projectId)).toBe(false)
    })

    it('short-circuits requests with no session before the remote Auth lookup', () => {
        const proxy = read('proxy.ts')
        const loginActionFastPath = proxy.indexOf('if (isLoginActionRequest || isSignOutRequest)')
        const fastPath = proxy.indexOf('if (!hasAuthSessionCookie)')
        const remoteLookup = proxy.indexOf('await supabase.auth.getUser()')

        expect(loginActionFastPath).toBeGreaterThan(-1)
        expect(fastPath).toBeGreaterThan(-1)
        expect(remoteLookup).toBeGreaterThan(loginActionFastPath)
        expect(remoteLookup).toBeGreaterThan(fastPath)
        expect(proxy).toContain("return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })")
    })

    it('overlaps browser cache cleanup with authentication before a full document navigation', () => {
        const loginForm = read('app/(auth)/login/login-form.tsx')

        expect(loginForm).toContain('sessionCleanupRef.current = clearClientSessionState()')
        expect(loginForm).toContain('await Promise.all([')
        expect(loginForm).toContain('cleanupPromise,')
        expect(loginForm).toContain('signIn({ email: email.trim(), password, traceId })')
        expect(loginForm).toContain('window.location.replace(result.redirectTo)')
        expect(loginForm).not.toContain("from 'next/navigation'")
        expect(loginForm).not.toContain('router.replace(result.redirectTo)')
    })

    it('uses freshly minted JWT routing claims and avoids a second owner profile query', () => {
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(
            authActions.indexOf('export async function signIn'),
            authActions.indexOf('// ─── regenerateJoinCode')
        )
        const ownerBranch = signInBody.slice(signInBody.indexOf("if (userRole === 'owner')"))

        expect(signInBody).toContain('parseJWT(data.session.access_token)')
        expect(signInBody).toContain('orgId = profile.org_id ?? undefined')
        expect(ownerBranch).not.toContain(".from('profiles')")
        expect(ownerBranch).toContain("return succeed('/owner/today')")
    })

    it('defers the tier lookup for completed owners to the request-cached dashboard gate', () => {
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(
            authActions.indexOf('export async function signIn'),
            authActions.indexOf('// ─── regenerateJoinCode')
        )
        const ownerBranch = signInBody.slice(signInBody.indexOf("if (userRole === 'owner')"))
        const incompleteBranch = ownerBranch.indexOf('if (!onboardingComplete)')
        const tierLookup = ownerBranch.indexOf("telemetry.measure('tier_lookup'")
        const completedDestination = ownerBranch.lastIndexOf("return succeed('/owner/today')")

        expect(incompleteBranch).toBeGreaterThan(-1)
        expect(tierLookup).toBeGreaterThan(incompleteBranch)
        expect(completedDestination).toBeGreaterThan(tierLookup)

        const todayLayout = read('app/(dashboard)/owner/today/layout.tsx')
        expect(todayLayout).toContain('requiredTier="premium"')
        expect(todayLayout).toContain('routeName="/owner/today"')
        expect(todayLayout).not.toContain('insufficientRedirect')
    })
})
