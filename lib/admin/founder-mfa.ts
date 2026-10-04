import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminError } from './errors'
import type { FounderCandidate } from './founder'

const resultSchema = z.object({
    allowed: z.boolean(), code: z.string().optional(), intentId: z.string().uuid().optional(),
    factorId: z.string().uuid().nullable().optional(), abandonedFactorId: z.string().uuid().nullable().optional(),
    verificationId: z.string().uuid().nullable().optional(),
})
export const FOUNDER_FACTOR_NAME = 'Weavly founder authenticator'
export type FounderEnrollmentState = { code?: string; message?: string; requestId?: string; setup?: { factorId: string; intentId: string; qrCode: string } }

/** Candidate was verified by the caller in this request. Intent metadata never
 * contains an OTP, enrollment secret or QR image. The DB serializes setup. */
export async function founderMfaSetup(candidate: FounderCandidate, operation: 'begin' | 'restart' | 'status' | 'bind' | 'verify' | 'verify_failed' | 'complete' | 'abandon', intentId?: string, factorId?: string, verificationId?: string) {
    const { data, error } = await createAdminClient().rpc('admin_founder_mfa_setup', {
        p_user_id: candidate.userId, p_session_id: candidate.sessionId, p_operation: operation,
        p_intent_id: intentId ?? null, p_factor_id: factorId ?? null,
        p_verification_id: verificationId ?? null,
    })
    const parsed = resultSchema.safeParse(data)
    if (error || !parsed.success) throw new AdminError('UNAVAILABLE', 503, 'Authenticator setup cannot be verified. Try again.')
    if (!parsed.data.allowed) throw new AdminError(parsed.data.code ?? 'FORBIDDEN', 403, 'Authenticator setup could not be verified.')
    return parsed.data
}
