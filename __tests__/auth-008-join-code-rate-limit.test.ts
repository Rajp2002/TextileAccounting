import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('AUTH-008 join-code enumeration boundary', () => {
    const rateLimit = read('lib/rate-limit.ts')
    const authActions = read('app/(auth)/actions/auth.ts')

    it('uses a dedicated small fail-closed join-code limiter', () => {
        expect(rateLimit).toContain('const JOIN_CODE_LIMIT = 10')
        expect(rateLimit).toContain('const JOIN_CODE_WINDOW_SECONDS = 10 * 60')
        expect(rateLimit).toContain('createLimiter(JOIN_CODE_LIMIT, JOIN_CODE_WINDOW_SECONDS)')
        expect(rateLimit).toContain("limiter.limit(`join-code:${action}:${ip}`)")
        expect(rateLimit).toContain('if (!limiter) throw new Error(JOIN_CODE_UNAVAILABLE_MESSAGE)')
        expect(rateLimit).toContain("throw new Error(JOIN_CODE_UNAVAILABLE_MESSAGE)")
    })

    it('limits both service-role validation and final join submission by client IP', () => {
        expect(authActions).toContain('getClientIpFromHeaders(requestHeaders)')
        expect(authActions).toContain("checkJoinCodeRateLimit(clientIp, 'validate')")
        expect(authActions).toContain("checkJoinCodeRateLimit(clientIp, 'join')")
        expect(authActions).toContain('Too many join-code attempts. Try again later.')
        expect(authActions).toContain('Join-code protection is temporarily unavailable. Try again later.')
    })

    it('normalizes case and surrounding whitespace before exact format validation', () => {
        expect(authActions).toContain("const normalized = code.trim().toUpperCase()")
        expect(authActions).toContain("const normalized = parsed.data.joinCode.trim().toUpperCase()")
        expect(authActions).toContain('/^[A-Z0-9]{8}$/')
    })
})
