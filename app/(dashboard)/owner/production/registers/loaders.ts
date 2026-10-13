import 'server-only'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { readCompleteBaseRows } from '@/lib/base-complete-query'
import { normalizeWorker, normalizeMachine } from './normalize'
import { compareMachineLabels } from '@/lib/base-machine-register'

// Check capability before reading any register, independently of layout rendering.
async function registerContext() {
 const { profile } = await requireRole(['owner'])
 const access = await getCachedOrgPlanAccess(profile.org_id)
 return hasCapability(access.effectiveTier, 'production_management') ? profile.org_id : null
}
import { getSuratTodayString } from '@/lib/time'

function isEffectiveOnDate(effectiveFrom: string, effectiveTo: string | null | undefined, date: string) {
    if (effectiveFrom > date) return false
    if (effectiveTo && effectiveTo < date) return false
    return true
}

export async function loadWorkersRegister(today?: string) {
    const orgId = await registerContext()
    if (!orgId) return null
    const db = await createClient()
    const effectiveDate = today ?? getSuratTodayString()

    const [workersResult, assignmentsResult, machinesResult] = await Promise.all([
        readCompleteBaseRows((from, to) => db.from('base_production_workers')
            .select('id, name, rate_per_meter, shift_availability, is_active, pay_type, role, operator_eligible, operator_effective_from, operator_approved_by, operator_approved_at, monthly_salary, salary_effective_from, salary_history, start_date, end_date, updated_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('is_active', { ascending: false }).order('name').order('id').range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_worker_machine_assignments')
            .select('id, worker_id, machine_id, shift, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).eq('active', true).range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_production_machines')
            .select('id, name', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('name').order('id').range(from, to)),
    ])

    if (workersResult.error) throw new Error('Unable to load workers. Please retry.')

    const machineCountByWorker = new Map<string, number>()
    for (const assignment of (assignmentsResult.data ?? [])) {
        if (!assignment.active || !isEffectiveOnDate(String(assignment.effective_from), assignment.effective_to ? String(assignment.effective_to) : null, effectiveDate)) continue
        const workerId = String(assignment.worker_id)
        machineCountByWorker.set(workerId, (machineCountByWorker.get(workerId) ?? 0) + 1)
    }

    const workers = (workersResult.data ?? []).map(row => {
        const worker = normalizeWorker(row)
        return {
            ...worker,
            assignedMachineCount: machineCountByWorker.get(worker.id) ?? 0,
        }
    })

    // Open-ended loom assignments and loom names for the "Switch shifts" modal. If either
    // read failed the modal sees no looms and its clash preview is empty; the database
    // repeats the clash check before it writes anything.
    const rotationAssignments = (assignmentsResult.data ?? [])
        .filter(assignment => assignment.active && !assignment.effective_to && (assignment.shift === 'day' || assignment.shift === 'night'))
        .map(assignment => ({ worker_id: String(assignment.worker_id), machine_id: String(assignment.machine_id), shift: assignment.shift as 'day' | 'night' }))
    const machineNames: Record<string, string> = {}
    for (const machine of (machinesResult.data ?? [])) machineNames[String(machine.id)] = String(machine.name || 'Loom')

    return { orgId, workers, rotation: { assignments: rotationAssignments, machineNames } }
}

export async function loadMachinesRegister(today?: string) {
    const orgId = await registerContext()
    if (!orgId) return null
    const db = await createClient()
    const effectiveDate = today ?? getSuratTodayString()

    const [
        machinesResult,
        assignmentsResult,
        contextsResult,
        workersResult,
        jobsResult,
    ] = await Promise.all([
        readCompleteBaseRows((from, to) => db.from('base_production_machines')
            .select('id, name, machine_type, custom_label, is_active, inactive_reason', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('is_active', { ascending: false }).order('name').order('id').range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_worker_machine_assignments')
            .select('id, worker_id, machine_id, shift, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).eq('active', true).range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_machine_job_contexts')
            .select('id, machine_id, job_id, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).eq('active', true).range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_production_workers')
            .select('id, name, is_active', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).eq('is_active', true).range(from, to)),
        readCompleteBaseRows((from, to) => db.from('base_production_jobs')
            .select('id, quality_label, status', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).in('status', ['planned', 'active']).range(from, to)),
    ])

    if (machinesResult.error) throw new Error('Unable to load machines. Please retry.')

    const workerMap = new Map((workersResult.data ?? []).map(w => [String(w.id), String(w.name)]))
    const jobMap = new Map((jobsResult.data ?? []).map(j => [String(j.id), String(j.quality_label)]))
    const activeJobIds = new Set(jobMap.keys())

    const costingByMachine = new Map<string, string>()
    for (const context of (contextsResult.data ?? [])) {
        const machineId = String(context.machine_id)
        if (costingByMachine.has(machineId)) continue
        if (!context.active || !isEffectiveOnDate(String(context.effective_from), context.effective_to ? String(context.effective_to) : null, effectiveDate)) continue
        const jobId = String(context.job_id)
        if (!activeJobIds.has(jobId)) continue
        costingByMachine.set(machineId, jobMap.get(jobId) || 'Assigned')
    }

    const workerByMachine = new Map<string, string>()
    for (const assignment of (assignmentsResult.data ?? [])) {
        const machineId = String(assignment.machine_id)
        if (workerByMachine.has(machineId)) continue
        if (!assignment.active || !isEffectiveOnDate(String(assignment.effective_from), assignment.effective_to ? String(assignment.effective_to) : null, effectiveDate)) continue
        const workerId = String(assignment.worker_id)
        const workerName = workerMap.get(workerId)
        if (workerName) {
            workerByMachine.set(machineId, workerName)
        }
    }

    const machines = (machinesResult.data ?? []).map(row => {
        const machine = normalizeMachine(row)
        const assignedCostingLabel = costingByMachine.get(machine.id) ?? null
        const assignedWorkerName = workerByMachine.get(machine.id) ?? null
        return {
            ...machine,
            assignedCostingLabel,
            assignedWorkerName,
            hasCosting: Boolean(assignedCostingLabel),
            hasWorker: Boolean(assignedWorkerName),
        }
    })
    // Postgres sorts the text `name` lexically ("10" before "2"), so order by machine number here; inactive machines stay last.
    machines.sort((a, b) => Number(b.is_active) - Number(a.is_active)
        || compareMachineLabels({ machineLabel: a.name, machineId: a.id }, { machineLabel: b.name, machineId: b.id }))

    return { orgId, machines }
}
