'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * GRIEVANCE ACTIONS
 */

export async function getGrievances() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('grievances')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

export async function logOfflineGrievance(formData: {
    org_id?: string | null
    worker_id?: number
    requester_email?: string
    subject: string
    description: string
    target_entity?: 'WEAVLY' | 'FACTORY_OWNER'
    grievance_type?: 'DATA_PRIVACY' | 'OPERATIONAL' | 'UNLOCK_REQUEST' | 'OTHER'
    filed_by_role?: 'worker' | 'supervisor' | 'owner' | 'admin'
}) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('grievances')
        .insert({
            ...formData,
            status: 'pending',
            acknowledged_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function updateGrievanceStatus(id: string, status: string, proofUrl?: string, responseSummary?: string) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const updateData: {
        status: string
        updated_at: string
        resolved_at?: string
        resolution_proof_url?: string
        response_summary?: string
    } = { status, updated_at: new Date().toISOString() }
    
    if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
        if (proofUrl) {
            updateData.resolution_proof_url = proofUrl
        }
        if (responseSummary) {
            updateData.response_summary = responseSummary
        }
    }

    const { error } = await supabase
        .from('grievances')
        .update(updateData)
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

/**
 * DATA ACCESS ACTIONS (Right to Access)
 */

export async function generateWorkerReport(workerId: number) {
    const { user } = await requireRole(['admin'])
    const supabase = createAdminClient()
    
    // Fetch profile (sanitized for right to access - only necessary PII).
    const { data: meterWorker, error: meterWorkerError } = await supabase
        .from('workers')
        .select('id, name, org_id, is_active')
        .eq('id', workerId)
        .maybeSingle()

    const { data: fixedWorker, error: fixedWorkerError } = meterWorker
        ? { data: null, error: null }
        : await supabase
            .from('fixed_workers')
            .select('id, name, org_id, role, monthly_salary, is_active')
            .eq('id', workerId)
            .maybeSingle()

    if (meterWorkerError || fixedWorkerError) {
        throw new Error((meterWorkerError || fixedWorkerError)?.message)
    }

    const worker = meterWorker ?? fixedWorker
    if (!worker) throw new Error('Worker not found')
    const workerType = meterWorker ? 'meter' : 'fixed'

    // Attendance belongs to fixed/day workers; piece-rate workers use production logs.
    const { data: attendance } = await supabase
        .from('attendance')
        .select('date, client_ip')
        .eq('fixed_worker_id', workerId)
        .order('date', { ascending: false })

    // Fetch production logs
    const { data: production } = await supabase
        .from('production_logs')
        .select('date, meters, machine_id')
        .eq('worker_id', workerId)
        .order('date', { ascending: false })

    // Fetch advances
    const { data: advances } = await supabase
        .from('worker_advances')
        .select('amount, description, created_at, status, deducted_at')
        .eq(workerType === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', workerId)
        .order('created_at', { ascending: false })

    const report = {
        generated_at: new Date().toISOString(),
        worker_type: workerType,
        worker_profile: worker,
        attendance_provenance: attendance,
        production_history: production,
        advance_history: advances
    }

    // Log the export event
    await supabase.rpc('log_export_event', {
        p_org_id: worker.org_id,
        p_table_name: 'workers',
        p_record_id: workerId.toString(),
        p_description: `Full Data Export for Worker: ${workerId}`,
        p_actor_id: user.id
    })

    return report
}

/**
 * NOTICE REGISTRY ACTIONS
 */

export async function getNoticeRegistry() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('notice_registry')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

export async function uploadNotice(data: {
    version_string: string
    notice_type: 'consent' | 'privacy' | 'erasure_notice'
    content_text: string
    translation_text?: string
    content_audio_url?: string
    content_hash: string
}) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('notice_registry')
        .insert({
            version_string: data.version_string,
            notice_type: data.notice_type,
            body_text: data.content_text,
            english_transcript: data.translation_text,
            content_audio_url: data.content_audio_url,
            content_hash: data.content_hash,
        })

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function toggleNoticeStatus(id: string, isActive: boolean) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    
    if (isActive) {
        // Deactivate all others of the same type
        const { data: current } = await supabase.from('notice_registry').select('notice_type').eq('id', id).single()
        if (current) {
            await supabase.from('notice_registry').update({ is_active: false }).eq('notice_type', current.notice_type)
        }
    }

    const { error } = await supabase
        .from('notice_registry')
        .update({ is_active: isActive })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

/**
 * GUJARAT SUBSIDY / AUDIT ACTIONS (PII-LITE)
 */

export async function exportAttendanceLogs(startDate: string, endDate: string) {
    const { user } = await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('attendance')
        .select('org_id, fixed_worker_id, client_ip, date') // PII-lite audit export
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

    if (error) throw new Error(error.message)

    // Log the export event
    if (data?.[0]?.org_id) {
        await supabase.rpc('log_export_event', {
            p_org_id: data[0].org_id,
            p_table_name: 'attendance',
            p_record_id: 'SUBSIDY_EXPORT',
            p_description: `PII-Lite IP Log Export for Gujarat DST (${startDate} to ${endDate})`,
            p_actor_id: user.id
        })
    }

    return (data ?? []).map(({ fixed_worker_id, client_ip, date }) => ({
        worker_id: fixed_worker_id,
        client_ip,
        date,
    }))
}

/**
 * BREACH DETECTION / EXPORT LOGS
 */

export async function getExportLogs() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('action', 'EXPORT')
        .order('changed_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

/**
 * COMPLIANCE SETTINGS (GRO)
 */

export async function getComplianceSettings() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('compliance_settings')
        .select('*')
        .single()

    if (error) throw new Error(error.message)
    return data
}

export async function updateGRODetails(data: {
    gro_name: string
    gro_email: string
    gro_phone?: string
}) {
    const { user } = await requireRole(['admin'])
    const supabase = createAdminClient()
    try {
        await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
    } catch {
        // Non-fatal: compliance_settings.updated_by still carries the actor for audit fallback.
    }

    const { error } = await supabase
        .from('compliance_settings')
        .update({
            ...data,
            updated_at: new Date().toISOString(),
            updated_by: user.id
        })
        .eq('id', true)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    revalidatePath('/privacy')
}

/**
 * DPA MANAGEMENT ACTIONS
 */

export async function getDpaTemplates() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('dpas')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

export async function getFactoryDpaStatus() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    
    // Fetch all organizations with their latest DPA status and lockdown status
    const { data, error } = await supabase
        .from('organizations')
        .select(`
            id,
            name,
            is_locked_down,
            lockdown_reason,
            lockdown_severity,
            locked_at,
            organization_dpas (
                id,
                status,
                signed_at,
                proof_url,
                dpas (
                    version_string
                )
            )
        `)
        .order('name')

    if (error) throw new Error(error.message)
    return data
}

export async function updateDpaTemplate(id: string, data: { content_text: string, is_active: boolean }) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    
    if (data.is_active) {
        // Deactivate all others
        await supabase.from('dpas').update({ is_active: false }).neq('id', id)
    }

    const { error } = await supabase
        .from('dpas')
        .update({
            ...data,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function createDpaTemplate(data: { version_string: string, content_text: string, is_active: boolean }) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    
    if (data.is_active) {
        await supabase.from('dpas').update({ is_active: false })
    }

    const { error } = await supabase
        .from('dpas')
        .insert(data)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function recordDpaSignature(orgId: string, dpaId: string, proofUrl?: string) {
    const { user } = await requireRole(['admin'])
    const supabase = createAdminClient()

    const { error } = await supabase
        .from('organization_dpas')
        .upsert({
            org_id: orgId,
            dpa_id: dpaId,
            status: 'signed',
            signed_at: new Date().toISOString(),
            signed_by: user?.id,
            proof_url: proofUrl,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'org_id, dpa_id'
        })

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    revalidatePath('/owner/settings')
}

export async function signDpa(dpaId: string) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createClient()

    const { error } = await supabase
        .from('organization_dpas')
        .upsert({
            org_id: profile.org_id,
            dpa_id: dpaId,
            status: 'signed',
            signed_at: new Date().toISOString(),
            signed_by: user.id,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'org_id, dpa_id'
        })

    if (error) throw new Error(error.message)
    revalidatePath('/owner/settings')
    revalidatePath('/admin')
}

/**
 * TENANT LOCKDOWN & BREACH ACTIONS
 */

export async function lockdownTenant(orgId: string, reason: string, severity: string) {
    const { user } = await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('lockdown_tenant', {
        p_org_id: orgId,
        p_reason: reason,
        p_severity: severity,
        p_actor_id: user.id,
    })

    if (error) throw new Error(error.message)

    // Trigger WhatsApp Notification (Legally Required)
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceRoleKey) {
            throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
        }

        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-lockdown-alert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({ org_id: orgId, reason, severity })
        })
    } catch (err) {
        console.error('Failed to trigger lockdown notification:', err)
    }

    revalidatePath('/admin')
    return data
}

export async function unlockTenant(orgId: string) {
    const { user } = await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('unlock_tenant', {
        p_org_id: orgId,
        p_actor_id: user.id,
    })

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    revalidatePath('/locked')
    return data
}

export async function requestUnlock(orgId: string, reason: string) {
    const { profile } = await requireRole(['owner'])
    if (profile.org_id !== orgId) throw new Error('Unauthorized')
    const supabase = await createClient()

    const { error } = await supabase
        .from('grievances')
        .insert({
            org_id: orgId,
            subject: 'TENANT UNLOCK REQUEST',
            description: `Owner requested unlock. Reason given: ${reason}`,
            target_entity: 'WEAVLY',
            grievance_type: 'UNLOCK_REQUEST',
            filed_by_role: 'owner',
            status: 'pending'
        })

    if (error) throw new Error(error.message)
    revalidatePath('/locked')
}

export async function getBreachReports(orgId?: string) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    let query = supabase
        .from('breach_reports')
        .select(`
            *,
            organizations ( name )
        `)
        .order('filed_at', { ascending: false })

    if (orgId) {
        query = query.eq('org_id', orgId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
}

export type SecurityIncidentStatus = 'reported' | 'triaging' | 'contained' | 'investigating' | 'monitoring' | 'closed'
export type SecurityIncidentCertInAssessment = 'pending' | 'not_reportable' | 'reportable' | 'reported'
export type SecurityIncidentDataCategory = 'account_authentication' | 'costings_business_contacts' | 'billing_subscription_references' | 'support_privacy_communications' | 'technical_diagnostic_security_logs'

export async function getSecurityIncidents() {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('security_incidents')
        .select('id, title, source, incident_type, status, severity, aware_at, cert_in_assessment_due_at, cert_in_assessment, affected_data_categories, created_at')
        .order('aware_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

export async function createSecurityIncident(input: {
    title: string
    source: 'customer' | 'provider' | 'monitoring' | 'internal' | 'other'
    incident_type: 'account_compromise' | 'unauthorized_access' | 'billing_security' | 'suspicious_message' | 'service_vulnerability' | 'availability' | 'other'
    aware_at: string
    summary: string
    affected_data_categories: SecurityIncidentDataCategory[]
}) {
    const { user } = await requireRole(['admin'])
    const title = input.title.trim()
    const summary = input.summary.trim()
    const awareAt = new Date(input.aware_at)

    if (title.length < 3 || title.length > 160) throw new Error('Title must be between 3 and 160 characters.')
    if (summary.length < 10 || summary.length > 5000) throw new Error('Summary must be between 10 and 5,000 characters.')
    if (Number.isNaN(awareAt.getTime())) throw new Error('Enter a valid awareness date and time.')
    if (awareAt.getTime() > Date.now() + 5 * 60 * 1000) throw new Error('Awareness time cannot be in the future.')
    const allowedCategories: SecurityIncidentDataCategory[] = ['account_authentication', 'costings_business_contacts', 'billing_subscription_references', 'support_privacy_communications', 'technical_diagnostic_security_logs']
    if (input.affected_data_categories.length === 0 || input.affected_data_categories.some((category) => !allowedCategories.includes(category))) {
        throw new Error('Select at least one valid Base Plan data category.')
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('security_incidents')
        .insert({
            title,
            source: input.source,
            incident_type: input.incident_type,
            aware_at: awareAt.toISOString(),
            summary,
            affected_data_categories: input.affected_data_categories,
            created_by: user.id,
            updated_by: user.id,
        })
        .select('id')
        .single()

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return data
}

export async function updateSecurityIncidentStatus(id: string, status: SecurityIncidentStatus) {
    const { user } = await requireRole(['admin'])
    const allowedStatuses: SecurityIncidentStatus[] = ['reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed']
    if (!allowedStatuses.includes(status)) throw new Error('Invalid incident status.')

    const supabase = createAdminClient()
    const { error } = await supabase
        .from('security_incidents')
        .update({
            status,
            updated_by: user.id,
            closed_at: status === 'closed' ? new Date().toISOString() : null,
        })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function updateSecurityIncidentCertInAssessment(
    id: string,
    assessment: SecurityIncidentCertInAssessment,
    rationale: string,
    reference?: string,
) {
    const { user } = await requireRole(['admin'])
    const allowed: SecurityIncidentCertInAssessment[] = ['pending', 'not_reportable', 'reportable', 'reported']
    if (!allowed.includes(assessment)) throw new Error('Invalid CERT-In assessment.')
    if (assessment !== 'pending' && rationale.trim().length < 10) throw new Error('Record a brief decision rationale.')
    if (assessment === 'reported' && !reference?.trim()) throw new Error('Enter the CERT-In submission reference.')

    const supabase = createAdminClient()
    const { error } = await supabase
        .from('security_incidents')
        .update({
            cert_in_assessment: assessment,
            cert_in_decision_rationale: rationale.trim() || null,
            cert_in_reported_at: assessment === 'reported' ? new Date().toISOString() : null,
            cert_in_reference: assessment === 'reported' ? reference?.trim() : null,
            updated_by: user.id,
        })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function generateBreachReportTemplate(reportId: string) {
    await requireRole(['admin'])
    const supabase = createAdminClient()
    
    // Fetch report data
    const { data: report, error } = await supabase
        .from('breach_reports')
        .select(`
            *,
            organizations ( 
                name,
                lockdown_reason,
                lockdown_severity,
                locked_at
            )
        `)
        .eq('id', reportId)
        .single()

    if (error) throw new Error(error.message)

    // Fetch GRO details
    const { data: settings } = await supabase.from('compliance_settings').select('*').single()

    // Internal assessment draft. This is not a prescribed government form and
    // must be reviewed against the law in force before it is sent externally.
    const template = {
        title: "INTERNAL PERSONAL DATA BREACH ASSESSMENT / DRAFT NOTIFICATION",
        legal_status: "DRAFT_FOR_REVIEW_NOT_A_PRESCRIBED_FORM",
        fiduciary_details: {
            name: report.organizations.name,
            contact_person: settings?.gro_name,
            contact_email: settings?.gro_email
        },
        breach_details: {
            nature_of_breach: report.description,
            severity: report.severity,
            date_of_detection: report.organizations.locked_at,
            estimated_principals_affected: report.affected_users_count
        },
        remedial_measures: report.measures_taken || "Platform-level isolation triggered immediately upon detection to prevent further unauthorized access or data exfiltration.",
        timing_note: "Assess current CERT-In reporting duties immediately. DPDP Board and affected-person notification fields apply only according to the notified commencement schedule and the law then in force.",
        timestamp: new Date().toISOString()
    }

    return template
}
