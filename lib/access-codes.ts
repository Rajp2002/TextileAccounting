'use server'

import "server-only"

import { createClient as createServerClient } from '@/lib/supabase/server'
import { AccessCodeSchema, safeParse } from '@/lib/schemas'
import {
    checkAccessCodeRateLimit,
    checkAccessCodeLockout,
    recordAccessCodeFailure,
    resetAccessCodeFailures,
} from '@/lib/rate-limit'
import crypto from 'crypto'

/**
 * Validate a one-time access code for the given org.
 * orgId MUST be derived server-side (from requireRole()) — never accept from client.
 * On success the code is consumed (cannot be reused).
 */
export async function validateAndConsumeAccessCode(userId: string, orgId: string, inputCode: string): Promise<boolean> {
    // 1. Check for strict lockout ban (5 fails = 1 hour)
    const isLockedOut = await checkAccessCodeLockout(userId)
    if (isLockedOut) throw new Error('Account temporarily locked due to too many failed attempts. Try again in 1 hour.')

    // 2. Check sliding window limit (5 attempts per 10 min)
    const rl = await checkAccessCodeRateLimit(userId)
    if (rl) throw new Error(`Too many attempts. Try again in ${Math.ceil(rl / 1000)} seconds.`)

    // Validate format before any DB hit
    const codeParsed = safeParse(AccessCodeSchema, inputCode)
    if ('error' in codeParsed) {
        await recordAccessCodeFailure(userId)
        return false
    }

    const supabase = await createServerClient()
    const { data: org, error } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', orgId)
        .single()

    if (error || !org || !org.access_code_hash) {
        await recordAccessCodeFailure(userId)
        return false
    }
    
    if (new Date(org.access_code_expires_at) < new Date()) {
        await recordAccessCodeFailure(userId)
        return false
    }

    const inputHash = crypto.createHash('sha256').update(codeParsed.data).digest('hex')
    const isValid = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(org.access_code_hash, 'hex'))
    if (!isValid) {
        await recordAccessCodeFailure(userId)
        return false
    }

    // Valid — consume the code
    await supabase
        .from('organizations')
        .update({ 
            access_code_hash: null, 
            access_code_expires_at: null,
            last_code_plain: null
        })
        .eq('id', orgId)

    // Set PostgreSQL session variable so the audit trigger knows 
    // this action was authorized by an access code.
    await supabase.rpc('set_config', { 
        name: 'app.access_code_used', 
        value: 'true', 
        is_local: true 
    })

    // Clear failure history
    await resetAccessCodeFailures(userId)

    return true
}
