import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const authSource = readFileSync('lib/auth.ts', 'utf8')
const rateLimitSource = readFileSync('lib/rate-limit.ts', 'utf8')

describe('AUTH-015 global session revocation', () => {
    it('checks the server-owned revocation marker before using authorization state', () => {
        const identity = authSource.slice(authSource.indexOf('export const getVerifiedIdentity'), authSource.indexOf('export const getCachedSession'))
        const userLookup = identity.indexOf('supabase.auth.getUser()')
        const revocationCheck = identity.indexOf('isUserRevoked(user.id)')
        const profileUse = identity.indexOf('const { data: dbProfile, error: profileError } = await')

        expect(authSource).toContain("import { isUserRevoked } from '@/lib/rate-limit'")
        expect(userLookup).toBeGreaterThan(-1)
        expect(revocationCheck).toBeGreaterThan(userLookup)
        expect(profileUse).toBeGreaterThan(revocationCheck)
        expect(authSource).toContain('if (await isUserRevoked(user.id)) return null')
        // The profile read may start before Auth answers (from Proxy's session
        // hint), but its row is used only for the user Auth verified.
        expect(identity).toContain('earlyProfileRead && hint?.userId === user.id ? earlyProfileRead : readIdentityProfile(user.id)')
    })

    it('uses a one-hour user-scoped Redis revocation marker', () => {
        expect(rateLimitSource).toContain("await r.setex(`revoked:${userId}`, 3600, '1')")
        expect(rateLimitSource).toContain("await r.get(`revoked:${userId}`)")
    })
})
