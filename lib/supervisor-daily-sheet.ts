import Decimal from 'decimal.js'
import { z } from 'zod'
import { canRecordBaseOperatorProduction, isBaseOperatorAvailable, reviewBaseSheetOperators } from './base-operator'
import { compareMachineLabels, machineReadingState, readMachineRecords, summarizeMachineRegister, type BaseMachineRecord } from './base-machine-register'
import { calculateBaseDailyProductionSummary, type BaseDailyProductionStatus, type BaseProductionShift } from './base-production-core'

// The supervisor's metres-only daily sheet: the payload of
// public.get_supervisor_daily_sheet, the machine rows built from it (saved
// allocation, then saved register record, then today's Setup, as on the owner
// sheet), and the p_entries payload public.save_supervisor_daily_sheet takes.

const uuid = z.string().uuid()
const nullableUuid = uuid.nullable()
const amount = z.coerce.number().finite()
const status = z.enum(['blank', 'entered', 'zero', 'absent'])

const payloadSchema = z.object({
    org_id: uuid,
    factory_name: z.string().nullable(),
    today: z.string(),
    min_date: z.string(),
    batch: z.object({
        id: uuid,
        status: z.string(),
        updated_at: z.string(),
        client_request_id: uuid,
        machine_records: z.unknown(),
    }).nullable(),
    workers: z.array(z.object({
        id: uuid,
        name: z.string(),
        is_active: z.boolean(),
        shift_availability: z.enum(['day', 'night', 'both']),
        pay_type: z.enum(['piece_rate', 'fixed_monthly']).nullable(),
        operator_eligible: z.boolean().nullable(),
        operator_effective_from: z.string().nullable(),
        start_date: z.string().nullable(),
        end_date: z.string().nullable(),
        paid: z.boolean(),
    })),
    machines: z.array(z.object({ id: uuid, label: z.string(), machine_type: z.string(), is_active: z.boolean() })),
    assignments: z.array(z.object({ id: uuid, worker_id: uuid, machine_id: uuid })),
    machine_jobs: z.array(z.object({ machine_id: uuid, job_id: uuid, job_label: z.string() })),
    entries: z.array(z.object({
        id: uuid, worker_id: uuid, entry_status: status, meters: amount.nullable(), notes: z.string().nullable(),
        machine_id: nullableUuid, job_id: nullableUuid,
    })),
    allocations: z.array(z.object({
        entry_id: uuid, worker_id: uuid, assignment_id: nullableUuid, machine_id: uuid, job_id: uuid,
        machine_label: z.string(), job_label: z.string(), meters: amount,
    })),
    revisions: z.array(z.object({
        revision_number: z.number().int(),
        change_kind: z.enum(['created', 'corrected']),
        correction_reason: z.string().nullable(),
        changed_at: z.string(),
        changed_by_name: z.string().nullable(),
        before_total: amount.nullable(),
        after_total: amount.nullable(),
        entered_count: z.number().int().nullable(),
        zero_count: z.number().int().nullable(),
        absent_count: z.number().int().nullable(),
    })),
})

type Payload = z.infer<typeof payloadSchema>
export type SupervisorSheetWorker = Payload['workers'][number]

export type SupervisorSheetData = {
    orgId: string
    factoryName: string
    today: string
    minDate: string
    batch: { id: string; status: string; updatedAt: string; clientRequestId: string; machineRecords: BaseMachineRecord[] } | null
    workers: SupervisorSheetWorker[]
    machines: Payload['machines']
    assignments: Payload['assignments']
    machineJobs: Payload['machine_jobs']
    entries: Payload['entries']
    allocations: Payload['allocations']
    revisions: Payload['revisions']
}

export function parseSupervisorSheet(raw: unknown): SupervisorSheetData {
    const data = payloadSchema.parse(raw)
    return {
        orgId: data.org_id,
        factoryName: data.factory_name ?? '',
        today: data.today,
        minDate: data.min_date,
        batch: data.batch ? {
            id: data.batch.id,
            status: data.batch.status,
            updatedAt: data.batch.updated_at,
            clientRequestId: data.batch.client_request_id,
            machineRecords: readMachineRecords(data.batch.machine_records),
        } : null,
        workers: data.workers,
        machines: data.machines,
        assignments: data.assignments,
        machineJobs: data.machine_jobs,
        entries: data.entries,
        allocations: data.allocations,
        revisions: data.revisions,
    }
}

export type SupervisorMachineRow = {
    machineId: string
    machineLabel: string
    workerId: string | null
    workerName: string | null
    jobId: string | null
    jobLabel: string | null
    paid: boolean
    /** The loom's operator cannot work this date and shift (left, not yet joined, other shift). */
    unavailable: boolean
}

/** Same shape as the owner sheet's draft rows, so drafts use one format. */
export type SupervisorDraftRow = {
    meters: string
    status: BaseDailyProductionStatus
    machineMeters: Record<string, string>
    savedUnallocatedMeters: number | null
}

export type SupervisorSheet = {
    date: string
    shift: BaseProductionShift
    rows: SupervisorMachineRow[]
    workers: SupervisorSheetWorker[]
    rowsByWorker: Map<string, SupervisorMachineRow[]>
    baseline: Record<string, SupervisorDraftRow>
    entries: SupervisorSheetData['entries']
}

export function contextKey(row: Pick<SupervisorMachineRow, 'machineId' | 'jobId'>) {
    return `${row.machineId}:${row.jobId ?? 'unassigned'}`
}

function positiveMeters(value: string | number | null | undefined): Decimal {
    const text = typeof value === 'number' ? String(value) : (value ?? '').trim()
    const numeric = Number(text)
    return text && Number.isFinite(numeric) && numeric > 0 ? new Decimal(text) : new Decimal(0)
}

function asOperator(worker: SupervisorSheetWorker) {
    return { ...worker, pay_type: worker.pay_type ?? undefined, operator_eligible: worker.operator_eligible ?? undefined }
}

export function buildSupervisorSheet(data: SupervisorSheetData, date: string, shift: BaseProductionShift): SupervisorSheet {
    const workerById = new Map(data.workers.map(worker => [worker.id, worker]))
    const jobByMachine = new Map(data.machineJobs.map(job => [job.machine_id, job]))
    const assignmentByMachine = new Map(data.assignments.map(assignment => [assignment.machine_id, assignment]))
    const allocationByMachine = new Map(data.allocations.map(allocation => [allocation.machine_id, allocation]))
    const recordByMachine = new Map((data.batch?.machineRecords ?? []).map(record => [record.machine_id, record]))
    const name = (workerId: string | null) => workerId ? workerById.get(workerId)?.name ?? null : null

    const rows = data.machines.map((machine): Omit<SupervisorMachineRow, 'unavailable'> => {
        const saved = allocationByMachine.get(machine.id)
        if (saved) return {
            machineId: machine.id, machineLabel: saved.machine_label, workerId: saved.worker_id, workerName: name(saved.worker_id),
            jobId: saved.job_id, jobLabel: saved.job_label, paid: workerById.get(saved.worker_id)?.paid ?? false,
        }
        const job = jobByMachine.get(machine.id)
        const record = recordByMachine.get(machine.id)
        if (record) return {
            machineId: machine.id, machineLabel: record.machine_label, workerId: record.worker_id, workerName: name(record.worker_id),
            jobId: record.job_id ?? job?.job_id ?? null, jobLabel: record.job_label ?? job?.job_label ?? null,
            paid: workerById.get(record.worker_id)?.paid ?? false,
        }
        const workerId = assignmentByMachine.get(machine.id)?.worker_id ?? null
        return {
            machineId: machine.id, machineLabel: machine.label, workerId, workerName: name(workerId),
            jobId: job?.job_id ?? null, jobLabel: job?.job_label ?? null, paid: workerId ? workerById.get(workerId)?.paid ?? false : false,
        }
    }).map((row): SupervisorMachineRow => {
        const worker = row.workerId ? workerById.get(row.workerId) : undefined
        return { ...row, unavailable: Boolean(row.workerId && !row.paid && !(worker && canRecordBaseOperatorProduction(asOperator(worker), shift, date))) }
    }).sort(compareMachineLabels)

    const rowsByWorker = new Map<string, SupervisorMachineRow[]>()
    for (const row of rows) {
        if (!row.workerId) continue
        rowsByWorker.set(row.workerId, [...(rowsByWorker.get(row.workerId) ?? []), row])
    }

    const savedWorkerIds = new Set([...data.entries.map(entry => entry.worker_id), ...(data.batch?.machineRecords ?? []).map(record => record.worker_id)])
    const workers = data.workers.filter(worker => isBaseOperatorAvailable(asOperator(worker), shift, date)
        || savedWorkerIds.has(worker.id) || rowsByWorker.has(worker.id))

    const entryByWorker = new Map(data.entries.map(entry => [entry.worker_id, entry]))
    const baseline = Object.fromEntries(workers.map(worker => {
        const existing = entryByWorker.get(worker.id)
        const contexts = rowsByWorker.get(worker.id) ?? []
        const allocations = existing ? data.allocations.filter(allocation => allocation.entry_id === existing.id) : []
        const records = (data.batch?.machineRecords ?? []).filter(record => record.worker_id === worker.id)
        const machineMeters: Record<string, string> = {}
        for (const allocation of allocations) machineMeters[`${allocation.machine_id}:${allocation.job_id}`] = String(allocation.meters)
        for (const context of contexts) {
            const record = records.find(item => item.machine_id === context.machineId)
            if (record?.state === 'not_running' || (records.length === 0 && existing?.entry_status === 'zero')) machineMeters[contextKey(context)] = '0'
        }
        // An older worker total with no machine split carries onto a single matching machine.
        const historicalMatch = existing?.machine_id && existing.job_id
            ? contexts.some(context => context.machineId === existing.machine_id && context.jobId === existing.job_id)
            : !existing?.machine_id && !existing?.job_id && contexts.length === 1 && Boolean(contexts[0].jobId)
        const carry = Boolean(existing && existing.entry_status === 'entered' && (existing.meters ?? 0) > 0
            && allocations.length === 0 && contexts.length === 1 && contexts[0].jobId && historicalMatch)
        if (carry) machineMeters[contextKey(contexts[0])] = String(existing!.meters)
        const unallocated = Boolean(existing && existing.entry_status === 'entered' && (existing.meters ?? 0) > 0 && allocations.length === 0 && !carry)
        return [worker.id, {
            status: existing?.entry_status ?? 'blank',
            meters: contexts.length > 0 ? '' : existing?.entry_status === 'entered' ? String(existing.meters ?? '') : '',
            machineMeters,
            savedUnallocatedMeters: unallocated ? existing!.meters : null,
        } satisfies SupervisorDraftRow]
    }))

    return { date, shift, rows, workers, rowsByWorker, baseline, entries: data.entries }
}

function rowTotal(sheet: SupervisorSheet, workerId: string, row: SupervisorDraftRow): Decimal {
    const contexts = sheet.rowsByWorker.get(workerId) ?? []
    if (contexts.length === 0) return row.status === 'entered' ? positiveMeters(row.meters) : new Decimal(0)
    return contexts.reduce((total, context) => total.plus(positiveMeters(row.machineMeters[contextKey(context)])), new Decimal(0))
}

const blankRow: SupervisorDraftRow = { meters: '', status: 'blank', machineMeters: {}, savedUnallocatedMeters: null }

export type SupervisorSaveEntry = {
    worker_id: string
    entry_status: BaseDailyProductionStatus
    meters: number | null
    notes: string | null
    machine_records: Array<{ machine_id: string; state: ReturnType<typeof machineReadingState> }>
    allocations: Array<{ machine_id: string; job_id: string; meters: number }>
}

function reviewSupervisorRows(sheet: SupervisorSheet, rows: Record<string, SupervisorDraftRow>) {
    return reviewBaseSheetOperators(
        sheet.workers.map(worker => ({ workerId: worker.id, status: (rows[worker.id] ?? blankRow).status, paid: worker.paid })),
        new Map(sheet.workers.map(worker => [worker.id, asOperator(worker)])),
        sheet.shift,
        sheet.date,
    )
}

/** Rows the save would be refused for, by operator and looms, so the sheet can say what to fix. */
export function blockedSupervisorRows(sheet: SupervisorSheet, rows: Record<string, SupervisorDraftRow>) {
    const { blockedWorkerIds } = reviewSupervisorRows(sheet, rows)
    return blockedWorkerIds.map(workerId => ({
        workerName: sheet.workers.find(worker => worker.id === workerId)?.name ?? '',
        machineLabels: (sheet.rowsByWorker.get(workerId) ?? []).map(row => row.machineLabel),
    }))
}

export function buildSupervisorSavePayload(sheet: SupervisorSheet, rows: Record<string, SupervisorDraftRow>): SupervisorSaveEntry[] {
    const notesByWorker = new Map(sheet.entries.map(entry => [entry.worker_id, entry.notes]))
    const { omittedWorkerIds } = reviewSupervisorRows(sheet, rows)
    return sheet.workers.filter(worker => !omittedWorkerIds.has(worker.id)).map(worker => {
        const row = rows[worker.id] ?? blankRow
        const contexts = sheet.rowsByWorker.get(worker.id) ?? []
        const total = rowTotal(sheet, worker.id, row).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
        return {
            worker_id: worker.id,
            entry_status: row.status,
            meters: row.status === 'blank' ? null : row.status === 'entered' ? total : 0,
            notes: notesByWorker.get(worker.id) ?? null,
            machine_records: contexts.map(context => ({ machine_id: context.machineId, state: machineReadingState(row.machineMeters[contextKey(context)], row.status) })),
            allocations: row.status === 'entered'
                ? contexts
                    .filter(context => context.jobId && positiveMeters(row.machineMeters[contextKey(context)]).gt(0))
                    .map(context => ({
                        machine_id: context.machineId,
                        job_id: context.jobId!,
                        meters: positiveMeters(row.machineMeters[contextKey(context)]).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
                    }))
                : [],
        }
    })
}

export function summarizeSupervisorSheet(sheet: SupervisorSheet, rows: Record<string, SupervisorDraftRow>) {
    const stateOf = (row: SupervisorMachineRow) => row.workerId
        ? machineReadingState((rows[row.workerId] ?? blankRow).machineMeters[contextKey(row)], (rows[row.workerId] ?? blankRow).status)
        : 'pending' as const
    const register = summarizeMachineRegister(sheet.rows.map(stateOf))
    const summary = calculateBaseDailyProductionSummary(sheet.workers.map(worker => {
        const row = rows[worker.id] ?? blankRow
        return {
            worker_id: worker.id,
            status: row.status,
            meters: row.status === 'entered' ? rowTotal(sheet, worker.id, row).toNumber() : row.status === 'blank' ? null : 0,
        }
    }))
    const invalidCount = sheet.workers.filter(worker => {
        const row = rows[worker.id] ?? blankRow
        if (row.status !== 'entered') return false
        const contexts = sheet.rowsByWorker.get(worker.id) ?? []
        if (contexts.length === 0 || rowTotal(sheet, worker.id, row).lte(0)) return true
        return contexts.some(context => {
            const value = row.machineMeters[contextKey(context)]
            return machineReadingState(value, row.status) === 'invalid' || (positiveMeters(value).gt(0) && !context.jobId)
        })
    }).length
    return {
        register,
        stateOf,
        totalMeters: summary.total_meters,
        invalidCount,
        recordedCount: summary.entered_count + summary.zero_count + summary.absent_count,
        outstandingCount: summary.outstanding_count,
    }
}
