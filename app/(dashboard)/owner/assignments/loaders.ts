import 'server-only'
import { effectiveDateFor } from '@/lib/base-go-live'
import { getBaseGoLiveState } from '@/lib/base-go-live.server'

import { requireRole } from '@/lib/auth'
import { readCompleteBaseRows } from '@/lib/base-complete-query'
import { toBaseNumber, type BaseMachineJobContext, type BaseProductionJob, type BaseProductionMachine, type BaseProductionWorker, type BaseWorkerMachineAssignment } from '@/lib/base-production-core'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { getSuratTodayString } from '@/lib/time'
import { normalizeMachine, normalizeWorker } from '../production/registers/normalize'

export type BaseAssignmentsInitialData = {
    orgId: string
    actorId?: string
    today: string
    workers: BaseProductionWorker[]
    machines: BaseProductionMachine[]
    jobs: BaseProductionJob[]
    assignments: BaseWorkerMachineAssignment[]
    machineJobContexts: BaseMachineJobContext[]
}

function requireRows<T>(result: { data: T[] | null; error: { message?: string } | null }): T[] {
    if (result.error) throw new Error('Unable to load assignments. Please retry.')
    return result.data ?? []
}
function toDate(value: unknown, fallback: string) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}
function toStringOrNull(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null
}
function toStatus(value: unknown): BaseProductionJob['status'] {
    return value === 'active' || value === 'completed' || value === 'cancelled' ? value : 'planned'
}

/** Load only the five datasets consumed by the assignment workspace. */
export async function loadBaseAssignmentsInitialData(today?: string): Promise<{
    initialData: BaseAssignmentsInitialData
    tourMetadata: Record<string, unknown>
} | null> {
    const { profile, user } = await requireRole(['owner'])
    const access = await getCachedOrgPlanAccess(profile.org_id)
    if (!hasCapability(access.effectiveTier, 'production_management')) return null
    const orgId = profile.org_id
    const db = await createClient()
    // The go-live date only shapes the rows below, so it is read with them.
    const [goLive, workersResult, machinesResult, jobsResult, assignmentsResult, contextsResult] = await Promise.all([
        getBaseGoLiveState(orgId),
        readCompleteBaseRows((from, to) => db.from('base_production_workers')
            .select('id, name, rate_per_meter, shift_availability, is_active, pay_type, role, operator_eligible, operator_effective_from, operator_approved_by, operator_approved_at, monthly_salary, salary_effective_from, salary_history, start_date, end_date, updated_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('is_active', { ascending: false }).order('name').order('id').range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_production_machines')
            .select('id, name, machine_type, custom_label, is_active', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('is_active', { ascending: false }).order('name').order('id').range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_production_jobs')
            .select('id, costing_id, costing_group_id, costing_version, quality_label, target_meters, start_date, due_date, customer_reference, notes, status, worker_rate_per_meter, planned_cost_per_meter, planned_price_per_meter, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('updated_at', { ascending: false }).order('id').range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_worker_machine_assignments')
            .select('id, worker_id, machine_id, shift, active, effective_from, effective_to, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('active', { ascending: false }).order('effective_from', { ascending: false }).order('id').range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_machine_job_contexts')
            .select('id, machine_id, job_id, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('active', { ascending: false }).order('effective_from', { ascending: false }).order('id').range(from, to)),
    ])
    // Setup changes take effect from go-live, so the board shows and edits the arrangement on that day.
    const effectiveDate = effectiveDateFor(today ?? getSuratTodayString(), goLive.goLive)

    // Retain effective history and the full loader's normalizers. Planned and
    // active jobs are equally eligible here; assignments do not need production
    // earnings history merely to infer that a planned job has started.
    const jobs: BaseProductionJob[] = requireRows(jobsResult).map(row => ({
        id: String(row.id),
        costing_id: String(row.costing_id),
        costing_group_id: toStringOrNull(row.costing_group_id),
        costing_version: row.costing_version === null || row.costing_version === undefined ? null : Math.max(1, Number(row.costing_version) || 1),
        quality_label: String(row.quality_label || 'Unnamed costing'),
        target_meters: toBaseNumber(row.target_meters),
        start_date: toDate(row.start_date, effectiveDate),
        due_date: toStringOrNull(row.due_date),
        customer_reference: toStringOrNull(row.customer_reference),
        notes: toStringOrNull(row.notes),
        status: toStatus(row.status),
        worker_rate_per_meter: toBaseNumber(row.worker_rate_per_meter),
        planned_cost_per_meter: toBaseNumber(row.planned_cost_per_meter),
        planned_price_per_meter: toBaseNumber(row.planned_price_per_meter),
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))
    const assignments: BaseWorkerMachineAssignment[] = requireRows(assignmentsResult).map(row => ({
        id: String(row.id), worker_id: String(row.worker_id), machine_id: String(row.machine_id),
        shift: row.shift === 'night' ? 'night' : 'day', active: row.active !== false,
        effective_from: toDate(row.effective_from, effectiveDate), effective_to: toStringOrNull(row.effective_to),
        ...(row.created_at ? { created_at: String(row.created_at) } : {}),
    }))
    const machineJobContexts: BaseMachineJobContext[] = requireRows(contextsResult).map(row => ({
        id: String(row.id), machine_id: String(row.machine_id), job_id: String(row.job_id),
        active: row.active !== false, effective_from: toDate(row.effective_from, effectiveDate), effective_to: toStringOrNull(row.effective_to),
    }))
    return {
        initialData: {
            orgId, actorId: user.id, today: effectiveDate,
            workers: requireRows(workersResult).map(normalizeWorker),
            machines: requireRows(machinesResult).map(normalizeMachine),
            jobs, assignments, machineJobContexts,
        },
        tourMetadata: { tour_preferences: user.user_metadata?.tour_preferences },
    }
}
