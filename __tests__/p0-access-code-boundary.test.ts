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

describe('Batch 1B-A SEC-006 access-code boundary', () => {
    const rateLimit = readProjectFile('lib/rate-limit.ts')
    const accessCodes = readProjectFile('lib/access-codes.ts')
    const ownerActions = readProjectFile('app/(dashboard)/owner/actions.ts')
    const supervisorActions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
    const ownerOrderActions = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
    const ownerLayout = readProjectFile('app/(dashboard)/owner/layout.tsx')
    const migration = readProjectFile('supabase/migrations/20260625215612_harden_access_code_fail_closed.sql')

    it('uses a real 5 attempts per 10 minutes access-code limiter', () => {
        expect(rateLimit).toContain('const ACCESS_CODE_LIMIT = 5')
        expect(rateLimit).toContain('const ACCESS_CODE_WINDOW_SECONDS = 10 * 60')
        expect(rateLimit).toContain('createLimiter(ACCESS_CODE_LIMIT, ACCESS_CODE_WINDOW_SECONDS)')
        expect(rateLimit).not.toContain('createLimiter(100, 10 * 60)')
    })

    it('fails closed when access-code limiter dependency is missing or errors', () => {
        const rateLimitCheck = functionBody(rateLimit, 'checkAccessCodeRateLimit')
        const lockoutCheck = functionBody(rateLimit, 'checkAccessCodeLockout')
        const failureRecorder = functionBody(rateLimit, 'recordAccessCodeFailure')

        expect(rateLimitCheck).toContain('if (!limiter) throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)')
        expect(rateLimitCheck).toContain('throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)')
        expect(lockoutCheck).toContain('if (!r) throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)')
        expect(lockoutCheck).toContain('throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)')
        expect(failureRecorder).toContain('if (!r) throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)')
        expect(failureRecorder).toContain('throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)')
        expect(lockoutCheck).not.toContain('return false // fail open')
    })

    it('records invalid attempts and applies lockout after five failures in the window', () => {
        const failureRecorder = functionBody(rateLimit, 'recordAccessCodeFailure')

        expect(failureRecorder).toContain('await r.expire(key, ACCESS_CODE_WINDOW_SECONDS)')
        expect(failureRecorder).toContain('if (fails >= 5)')
        expect(failureRecorder).toContain("await r.setex(`lockout:${userId}`, ACCESS_CODE_LOCKOUT_SECONDS, '1')")
    })

    it('central helper rejects malformed, missing, expired, and wrong codes before success', () => {
        const validator = functionBody(accessCodes, 'validateAndConsumeAccessCode')

        expect(accessCodes).toContain("import { createAdminClient } from '@/lib/supabase/admin'")
        expect(validator).toContain('const supabase = createAdminClient()')
        expect(validator).toContain('safeParse(AccessCodeSchema, inputCode)')
        expect(validator).toContain('await recordAccessCodeFailure(userId)')
        expect(validator).toContain('!org.access_code_hash')
        expect(validator).toContain('new Date(org.access_code_expires_at) < new Date()')
        expect(validator).toContain('crypto.timingSafeEqual')
    })

    it('consumes valid codes exactly once and clears plaintext residue', () => {
        const validator = functionBody(accessCodes, 'validateAndConsumeAccessCode')

        expect(validator).toContain('access_code_hash: null')
        expect(validator).toContain('access_code_expires_at: null')
        expect(validator).toContain('last_code_plain: null')
        expect(validator).toContain(".eq('access_code_hash', org.access_code_hash)")
        expect(validator).toContain(".select('id')")
        expect(validator).toContain('.maybeSingle()')
        expect(validator).toContain('if (consumeError || !consumed)')
    })

    it('centralizes owner and supervisor access-code generation without storing plaintext', () => {
        const generator = functionBody(accessCodes, 'generateAndStoreAccessCode')
        const ownerGenerator = functionBody(ownerActions, 'generateAccessCode')
        const supervisorRequest = functionBody(supervisorActions, 'requestAccessCode')
        const ownerOrderRequest = functionBody(ownerOrderActions, 'requestAccessCodeAsOwner')

        expect(generator).toContain('const supabase = createAdminClient()')
        expect(generator).toContain('last_code_plain: null')
        expect(ownerGenerator).toContain('generateAndStoreAccessCode(profile.org_id)')
        expect(supervisorRequest).toContain('generateAndStoreAccessCode(profile.org_id)')
        expect(ownerOrderRequest).toContain('generateAndStoreAccessCode(profile.org_id)')
        expect(ownerActions).not.toContain('last_code_plain: code')
        expect(supervisorActions).not.toContain('last_code_plain: code')
        expect(ownerLayout).not.toContain('last_code_plain')
        expect(ownerLayout).not.toContain('AccessCodeBanner')
    })

    it('routes manual owner-protected actions through the central consume helper', () => {
        const validateAndRotate = functionBody(ownerActions, 'validateAndRotateAccessCode')
        const fixedDelete = functionBody(ownerActions, 'deleteFixedWorkerWithCode')
        const meterDelete = functionBody(ownerActions, 'deleteMeterWorkerWithCode')
        const updateOrderDetails = functionBody(ownerOrderActions, 'updateOrderDetails')

        for (const body of [validateAndRotate, fixedDelete, meterDelete, updateOrderDetails]) {
            expect(body).toContain('validateAndConsumeAccessCode')
            expect(body).not.toContain(".select('access_code_hash, access_code_expires_at')")
            expect(body).not.toContain('timingSafeEqual')
        }

        expect(ownerOrderActions).not.toContain('validateOwnerAccessCode')
    })

    it('adds a migration guard that blocks future plaintext access-code writes without backfilling data', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.prevent_access_code_plaintext_storage()')
        expect(migration).toContain('IF NEW.last_code_plain IS NOT NULL THEN')
        expect(migration).toContain("RAISE EXCEPTION 'access code plaintext storage is disabled'")
        expect(migration).toContain('BEFORE INSERT OR UPDATE OF last_code_plain ON public.organizations')
        expect(migration).not.toMatch(/UPDATE\s+public\.organizations\s+SET\s+last_code_plain\s*=\s*null/i)
    })
})
