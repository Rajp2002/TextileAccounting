import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    getTerminalAuthSessionErrorCode,
    isSupabaseAuthSessionCookie,
} from '../lib/supabase/auth-cookie'

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

    it('recognizes only terminal Auth session errors as cookie-reset conditions', () => {
        for (const code of [
            'refresh_token_not_found',
            'refresh_token_already_used',
            'session_not_found',
            'session_expired',
        ]) {
            expect(getTerminalAuthSessionErrorCode({ code })).toBe(code)
        }

        expect(getTerminalAuthSessionErrorCode({ code: 'request_timeout' })).toBeNull()
        expect(getTerminalAuthSessionErrorCode({ code: 'invalid_credentials' })).toBeNull()
        expect(getTerminalAuthSessionErrorCode(new Error('network unavailable'))).toBeNull()
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

    it('expires stale session cookies when refresh or session validation is terminal', () => {
        const proxy = read('proxy.ts')

        expect(proxy).toContain('catch (error)')
        expect(proxy).toContain('getTerminalAuthSessionErrorCode(error)')
        expect(proxy).toContain('getTerminalAuthSessionErrorCode(claimsError)')
        expect(proxy).toContain('return recoverTerminalAuthSession(terminalCode)')
        expect(proxy).toContain('return recoverTerminalAuthSession(terminalClaimsCode)')
        expect(proxy).toContain('request.cookies.delete(name)')
        expect(proxy).toContain("event: 'terminal_auth_session_recovered'")
        // Founder routes now have a distinct login target; customer terminal
        // recovery remains /login and is exercised by the runtime proxy suite.
        expect(proxy).toContain("const loginPath = founderRoute ? '/admin/login' : '/login'")
        expect(proxy).toContain('NextResponse.redirect(founderRoute ? founderLoginUrl() : new URL(loginPath, request.url))')
    })

    it('keeps browser cleanup outside the authentication critical path', () => {
        const loginForm = read('app/(auth)/login/login-form.tsx')

        expect(loginForm).not.toContain('await Promise.all([')
        expect(loginForm).not.toContain('clearClientSessionState()')
        expect(loginForm).toContain('requestSignIn({ email: email.trim(), password, traceId })')
        expect(loginForm).toContain('window.location.replace(result.redirectTo)')
        expect(loginForm).not.toContain("from 'next/navigation'")
        expect(loginForm).not.toContain('router.replace(result.redirectTo)')
    })

    it('uses freshly minted JWT routing claims and avoids a second owner profile query', () => {
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(
            authActions.indexOf('export async function signIn'),
            authActions.length
        )
        const ownerBranch = signInBody.slice(signInBody.indexOf("if (userRole === 'owner')"))

        expect(signInBody).toContain('parseJWT(data.session.access_token)')
        expect(signInBody).toContain('orgId = profile.org_id ?? undefined')
        expect(ownerBranch).not.toContain(".from('profiles')")
        expect(ownerBranch).toContain("return succeed('/owner/estimator')")
    })

    it('refreshes inactivity state in the successful login response', () => {
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(
            authActions.indexOf('export async function signIn'),
            authActions.length
        )

        expect(authActions).toContain("import { cookies, headers } from 'next/headers'")
        expect(signInBody).toContain("cookieStore.set('last_activity', Date.now().toString()")
        expect(signInBody.indexOf("cookieStore.set('last_activity'")).toBeLessThan(
            signInBody.indexOf('return { redirectTo }')
        )
    })

    it('routes Lite and Base owners to the estimator', () => {
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(
            authActions.indexOf('export async function signIn'),
            authActions.length
        )
        const ownerBranch = signInBody.slice(signInBody.indexOf("if (userRole === 'owner')"))
        const incompleteBranch = ownerBranch.indexOf('if (!onboardingComplete)')
        const tierLookup = ownerBranch.indexOf("telemetry.measure('tier_lookup'")
        const baseDestination = ownerBranch.lastIndexOf("return succeed('/owner/estimator')")
        const completedDestination = ownerBranch.lastIndexOf("return succeed('/owner/estimator')")

        expect(incompleteBranch).toBeGreaterThan(-1)
        expect(tierLookup).toBeGreaterThan(-1)
        expect(baseDestination).toBeGreaterThan(incompleteBranch)
        expect(completedDestination).toBeGreaterThan(tierLookup)
        expect(ownerBranch).toContain("if (tier === 'lite' || tier === 'base') return succeed('/owner/estimator')")

        const estimatorPage = read('app/(dashboard)/owner/estimator/page.tsx')
        expect(estimatorPage).toContain("requireRole(['owner'])")
    })
})
