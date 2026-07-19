import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    getSupabaseAuthSessionCookieNames,
    isStaleSupabaseAuthSessionError,
} from '../lib/supabase/auth-cookie'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('stale Supabase auth cookie recovery', () => {
    it('finds every session-cookie chunk without deleting PKCE or unrelated cookies', () => {
        const projectId = 'exampleprojectref'
        const cookies = [
            { name: `sb-${projectId}-auth-token` },
            { name: `sb-${projectId}-auth-token.0` },
            { name: `sb-${projectId}-auth-token.1` },
            { name: `sb-${projectId}-auth-token-code-verifier` },
            { name: 'last_activity' },
            { name: 'unrelated-cookie' },
        ]

        expect(getSupabaseAuthSessionCookieNames(cookies, projectId)).toEqual([
            `sb-${projectId}-auth-token`,
            `sb-${projectId}-auth-token.0`,
            `sb-${projectId}-auth-token.1`,
        ])
    })

    it('recognizes terminal session errors without classifying temporary failures as stale', () => {
        expect(isStaleSupabaseAuthSessionError({ code: 'refresh_token_not_found' })).toBe(true)
        expect(isStaleSupabaseAuthSessionError({ code: 'refresh_token_already_used' })).toBe(true)
        expect(isStaleSupabaseAuthSessionError({ code: 'session_expired' })).toBe(true)
        expect(isStaleSupabaseAuthSessionError({
            message: 'Invalid Refresh Token: Refresh Token Not Found',
        })).toBe(true)

        expect(isStaleSupabaseAuthSessionError({ code: 'request_timeout' })).toBe(false)
        expect(isStaleSupabaseAuthSessionError({
            message: 'Network request failed',
        })).toBe(false)
    })

    it('clears an older session before signInWithPassword initializes', () => {
        const serverClient = read('lib/supabase/server.ts')
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(
            authActions.indexOf('export async function signIn'),
            authActions.indexOf('// ─── regenerateJoinCode')
        )

        expect(serverClient).toContain('export async function createFreshAuthClient()')
        expect(serverClient).toContain('getSupabaseAuthSessionCookieNames(cookieStore.getAll())')
        expect(serverClient).toContain('cookieStore.delete(name)')
        expect(signInBody).toContain('const supabase = await createFreshAuthClient()')
        expect(signInBody.indexOf('createFreshAuthClient()')).toBeLessThan(
            signInBody.indexOf('signInWithPassword')
        )
    })

    it('expires stale chunks at middleware validation and on every logout response', () => {
        const proxy = read('proxy.ts')
        const signOutRoute = read('app/auth/signout/route.ts')

        expect(proxy).toContain('isStaleSupabaseAuthSessionError(authError)')
        expect(proxy).toContain('expireSupabaseAuthSessionCookies(response, request)')
        expect(proxy).toContain("response.cookies.delete('last_activity')")

        expect(signOutRoute).toContain('getSupabaseAuthSessionCookieNames(request.cookies.getAll())')
        expect(signOutRoute).toContain('response.cookies.delete(name)')
        expect(signOutRoute).toContain("response.cookies.delete('last_activity')")
        expect(signOutRoute).toContain('} catch {')
    })
})
