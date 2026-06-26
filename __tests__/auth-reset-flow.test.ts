import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('AUTH-RESET-001 password reset PKCE flow', () => {
    const authActions = readProjectFile('app/(auth)/actions/auth.ts')
    const callbackRoute = readProjectFile('app/auth/callback/route.ts')
    const resetForm = readProjectFile('app/(auth)/reset-password/ResetPasswordForm.tsx')
    const schemas = readProjectFile('lib/schemas.ts')

    it('sends reset emails through the PKCE auth callback without exposing account existence', () => {
        const requestReset = functionBody(authActions, 'requestPasswordReset')

        expect(requestReset).toContain('const redirectTo = `${origin}/auth/callback?next=/reset-password`')
        expect(requestReset).toContain('resetPasswordForEmail(parsed.data.email, { redirectTo })')
        expect(requestReset).toContain('return { success: true }')
        expect(requestReset).not.toMatch(/already registered|does not exist|not found|no account/i)
    })

    it('exchanges the callback code and rejects unsafe next redirects', () => {
        expect(callbackRoute).toContain('exchangeCodeForSession(code)')
        expect(callbackRoute).toContain("if (!next.startsWith('/')) return false")
        expect(callbackRoute).toContain("if (next.startsWith('//')) return false")
        expect(callbackRoute).toContain("if (next.includes('://')) return false")
        expect(callbackRoute).toContain('if (!isSafeNext(rawNext))')
        expect(callbackRoute).toContain('return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)')
        expect(callbackRoute).toContain('return NextResponse.redirect(`${origin}/reset-password`)')
    })

    it('keeps implicit-flow URL token handling out of the reset password form', () => {
        expect(resetForm).not.toContain('access_token')
        expect(resetForm).not.toContain('refresh_token')
        expect(resetForm).not.toContain('setSession')
        expect(resetForm).not.toContain('parseJwt')
        expect(resetForm).not.toContain('parseJWT')
        expect(resetForm).not.toContain('recovery=1')
        expect(resetForm).not.toContain('exchangeCodeForSession')
    })

    it('only enables password reset from a real Supabase session', () => {
        expect(resetForm).toContain('supabase.auth.getSession()')
        expect(resetForm).toContain('supabase.auth.onAuthStateChange')
        expect(resetForm).toContain("type RecoveryStatus = 'checking' | 'ready' | 'invalid'")
        expect(resetForm).toContain('SESSION_CHECK_TIMEOUT_MS')
        expect(resetForm).toContain('<Link href="/forgot-password">Request new link</Link>')
    })

    it('uses the shared password rules and signs out after a successful update', () => {
        expect(resetForm).toContain("import { PasswordSchema } from '@/lib/schemas'")
        expect(resetForm).toContain('PasswordSchema.safeParse(password)')
        expect(schemas).toContain(".min(8, 'Password must be at least 8 characters')")
        expect(schemas).toContain(".regex(/[A-Z]/, 'Must contain at least one uppercase letter')")
        expect(schemas).toContain(".regex(/[0-9]/, 'Must contain at least one number')")
        expect(resetForm).toContain('supabase.auth.updateUser({ password })')
        expect(resetForm).toContain('supabase.auth.signOut()')
        expect(resetForm).toContain("router.replace('/login?message=password-updated')")
    })
})
