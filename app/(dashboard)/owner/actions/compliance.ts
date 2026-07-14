'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'

/**
 * Fetches the active notice for a specific type and language.
 * Falls back to English if requested language is unavailable.
 */
export async function getActiveNotice(type: 'consent' | 'privacy' | 'erasure_notice', langCode: string = 'en') {
    const supabase = await createServerClient()
    
    // 1. Try to find the specific language
    const { data, error } = await supabase
        .from('notice_registry')
        .select('*')
        .eq('notice_type', type)
        .eq('language_code', langCode)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    // 2. Fallback to English if not found
    if (error || !data) {
        const { data: fallbackData } = await supabase
            .from('notice_registry')
            .select('*')
            .eq('notice_type', type)
            .eq('language_code', 'en')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
        
        return fallbackData || null
    }

    return data
}

/**
 * Logs a worker's consent with an immutable audit hash.
 */
export async function logWorkerConsent(
    workerId: number, 
    noticeVersionId: string, 
    ipAddress: string,
    granularConsent: Record<string, boolean> = {}
) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    const timestamp = new Date().toISOString()

    // Generate Audit Hash: Hash(worker_id + notice_id + timestamp + ip + granular_consent)
    const rawString = `${workerId}-${noticeVersionId}-${timestamp}-${ipAddress}-${JSON.stringify(granularConsent)}`
    const auditHash = crypto.createHash('sha256').update(rawString).digest('hex')

    const { error } = await supabase.from('worker_consent_artifacts').insert({
        org_id: profile.org_id,
        worker_id: workerId,
        notice_version_id: noticeVersionId,
        consent_given: Object.values(granularConsent).every(v => v === true),
        granular_consent: granularConsent,
        ip_address: ipAddress,
        timestamp: timestamp,
        audit_hash: auditHash
    })

    if (error) {
        Sentry.captureException(error, { tags: { action: 'log_worker_consent' } })
        return { error: 'Failed to log consent. Please try again.' }
    }

    return { success: true, hash: auditHash }
}

/**
 * Logs a request for a notice translation.
 */
export async function requestOtherLanguage(languageCode: string, workerNameHint?: string) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { error } = await supabase.from('language_requests').insert({
        org_id: profile.org_id,
        language_code: languageCode,
        worker_name_hint: workerNameHint
    })

    if (error) {
        Sentry.captureException(error, { tags: { action: 'request_notice_language' } })
        return { error: 'Failed to request this language. Please try again.' }
    }

    revalidatePath('/owner/settings/audit')
    return { success: true }
}

/**
 * Implements "Right to Erasure" — Anonymizes worker records while preserving audit trails.
 */
export async function eraseWorkerPII(workerId: number, workerType: 'meter' | 'fixed') {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('erase_worker_pii_atomic', {
        p_worker_id: workerId,
        p_worker_type: workerType,
        p_actor_id: user.id,
    })

    if (error) {
        Sentry.captureException(error, {
            tags: { action: 'erase_worker_pii', phase: 'atomic_rpc' },
            extra: { workerType, orgId: profile.org_id },
        })
        return { error: 'Failed to process erasure request. Please try again.' }
    }

    revalidatePath(workerType === 'meter' ? '/owner/workers' : '/owner/fixed-workers')
    revalidatePath('/owner/payroll')
    return { success: true, erasure: data }
}
