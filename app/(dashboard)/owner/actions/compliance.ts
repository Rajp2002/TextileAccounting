'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'

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
        console.error('[logWorkerConsent] Error:', error.message)
        return { error: error.message }
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
        return { error: error.message }
    }

    revalidatePath('/owner/settings/audit')
    return { success: true }
}

/**
 * Implements "Right to Erasure" — Anonymizes worker records while preserving audit trails.
 */
export async function eraseWorkerPII(workerId: number, workerType: 'meter' | 'fixed') {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const orgId = profile.org_id

    // 1. Anonymize the consent artifacts
    const { error: artifactError } = await supabase
        .from('worker_consent_artifacts')
        .update({
            worker_id: null,
            erased_at: new Date().toISOString()
        })
        .eq('worker_id', workerId)
        .eq('org_id', orgId)

    if (artifactError) {
        console.error('[eraseWorkerPII] Artifact Error:', artifactError.message)
    }

    // 2. Anonymize the worker record
    const table = workerType === 'meter' ? 'workers' : 'fixed_workers'
    const { error: workerError } = await supabase
        .from(table)
        .update({
            name: 'ERASED WORKER',
            is_active: false,
            // Nullify other PII if exists
            ...(workerType === 'meter' ? { whatsapp_number: null } : { esi_number: null, pf_number: null })
        })
        .eq('id', workerId)
        .eq('org_id', orgId)

    if (workerError) {
        return { error: workerError.message }
    }

    revalidatePath(workerType === 'meter' ? '/owner/workers' : '/owner/fixed-workers')
    return { success: true }
}
