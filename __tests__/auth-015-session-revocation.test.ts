import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const authSource = readFileSync('lib/auth.ts', 'utf8')
const rateLimitSource = readFileSync('lib/rate-limit.ts', 'utf8')

describe('AUTH-015 global session revocation', () => {
    it('checks the server-owned revocation marker before loading authorization state', () => {
        const userLookup = authSource.indexOf('supabase.auth.getUser()')
        const revocationCheck = authSource.indexOf('isUserRevoked(user.id)')
        const profileLookup = authSource.indexOf(".from('profiles')")

        expect(authSource).toContain("import { isUserRevoked } from '@/lib/rate-limit'")
        expect(userLookup).toBeGreaterThan(-1)
        expect(revocationCheck).toBeGreaterThan(userLookup)
        expect(profileLookup).toBeGreaterThan(revocationCheck)
        expect(authSource).toContain('if (await isUserRevoked(user.id)) return null')
    })

    it('uses a one-hour user-scoped Redis revocation marker', () => {
        expect(rateLimitSource).toContain("await r.setex(`revoked:${userId}`, 3600, '1')")
        expect(rateLimitSource).toContain("await r.get(`revoked:${userId}`)")
    })
})
