'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * GRIEVANCE ACTIONS
 */

export async function getGrievances() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('grievances')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

export async function logOfflineGrievance(formData: {
    org_id: string
    worker_id?: number
    subject: string
    description: string
    target_entity?: 'WEAVLY' | 'FACTORY_OWNER'
    grievance_type?: 'DATA_PRIVACY' | 'OPERATIONAL' | 'OTHER'
    filed_by_role?: 'worker' | 'supervisor' | 'owner' | 'admin'
}) {
    const supabase = await createClient()
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

export async function updateGrievanceStatus(id: string, status: string, proofUrl?: string) {
    const supabase = await createClient()
    const updateData: any = { status, updated_at: new Date().toISOString() }
    
    if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
        if (proofUrl) {
            updateData.resolution_proof_url = proofUrl
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
    const supabase = await createClient()
    
    // Fetch profile (Sanitized for right to access - only necessary PII)
    const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('id, name, org_id, is_active')
        .eq('id', workerId)
        .single()

    if (workerError) throw new Error(workerError.message)

    // Fetch attendance (Sanitized: only date and IP for provenance)
    const { data: attendance } = await supabase
        .from('attendance')
        .select('date, client_ip')
        .eq('worker_id', workerId)
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
        .select('amount, reason, created_at')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })

    const report = {
        generated_at: new Date().toISOString(),
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
        p_description: `Full Data Export for Worker: ${workerId}`
    })

    return report
}

/**
 * NOTICE REGISTRY ACTIONS
 */

export async function getNoticeRegistry() {
    const supabase = await createClient()
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
    const supabase = await createClient()
    const { error } = await supabase
        .from('notice_registry')
        .insert(data)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
}

export async function toggleNoticeStatus(id: string, isActive: boolean) {
    const supabase = await createClient()
    
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
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('attendance')
        .select('worker_id, client_ip, date') // Strictly Worker ID, IP, and Date
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

    if (error) throw new Error(error.message)

    // Log the export event
    await supabase.rpc('log_export_event', {
        p_org_id: (await supabase.auth.getUser()).data.user?.id, 
        p_table_name: 'attendance',
        p_record_id: 'SUBSIDY_EXPORT',
        p_description: `PII-Lite IP Log Export for Gujarat DST (${startDate} to ${endDate})`
    })

    return data
}

/**
 * BREACH DETECTION / EXPORT LOGS
 */

export async function getExportLogs() {
    const supabase = await createClient()
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
    const supabase = await createClient()
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
    const supabase = await createClient()
    const { error } = await supabase
        .from('compliance_settings')
        .update({
            ...data,
            updated_at: new Date().toISOString(),
            updated_by: (await supabase.auth.getUser()).data.user?.id
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
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('dpas')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
}

export async function getFactoryDpaStatus() {
    const supabase = await createClient()
    
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
    const supabase = await createClient()
    
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
    const supabase = await createClient()
    
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
    const supabase = await createClient()
    const user = (await supabase.auth.getUser()).data.user

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
}

/**
 * TENANT LOCKDOWN & BREACH ACTIONS
 */

export async function lockdownTenant(orgId: string, reason: string, severity: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('lockdown_tenant', {
        p_org_id: orgId,
        p_reason: reason,
        p_severity: severity
    })

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return data
}

export async function unlockTenant(orgId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('unlock_tenant', {
        p_org_id: orgId
    })

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return data
}

export async function getBreachReports(orgId?: string) {
    const supabase = await createClient()
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

export async function generateBreachReportTemplate(reportId: string) {
    const supabase = await createClient()
    
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

    // Generate DPDP 2026 Compliant Template
    const template = {
        title: "DATA BREACH NOTIFICATION (FORM DPDP-BN1)",
        fiduciary_details: {
            name: report.organizations.name,
            registration_number: "PENDING_REGISTRATION", // Placeholder for actual reg number
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
        declaration: "I hereby declare that the information provided above is true and correct to the best of my knowledge and belief.",
        timestamp: new Date().toISOString()
    }

    return template
}
