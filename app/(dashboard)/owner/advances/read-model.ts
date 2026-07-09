export interface Worker {
    id: number
    name: string
    type: 'meter' | 'fixed'
    role?: string
    monthly_salary?: number
    whatsapp_number?: string
}

export interface Advance {
    id: number
    amount: number
    description: string | null
    status: 'pending' | 'deducted'
    created_at: string
    deducted_at: string | null
    deducted_in_month: string | null
}

export interface PendingAdvanceOverview extends Advance {
    workerName: string
    workerType: 'meter' | 'fixed'
}

export interface MeterWorkerRow {
    id: number
    name: string
    whatsapp_number: string | null
}

export interface FixedWorkerRow {
    id: number
    name: string
    role: string | null
    monthly_salary: number | null
    whatsapp_number: string | null
}

type RelatedWorkerRow = { name: string } | Array<{ name: string }> | null

export interface PendingAdvanceRow extends Advance {
    meter_worker_id: number | null
    fixed_worker_id: number | null
    workers: RelatedWorkerRow
    fixed_workers: RelatedWorkerRow
}

export interface OwnerAdvancesInitialData {
    orgId: string
    workers: Worker[]
    pendingAdvances: PendingAdvanceOverview[]
}

export function buildWorkers(
    meterWorkers: MeterWorkerRow[],
    fixedWorkers: FixedWorkerRow[]
): Worker[] {
    return [
        ...meterWorkers.map((worker) => ({
            id: worker.id,
            name: worker.name,
            type: 'meter' as const,
            whatsapp_number: worker.whatsapp_number ?? undefined,
        })),
        ...fixedWorkers.map((worker) => ({
            id: worker.id,
            name: worker.name,
            type: 'fixed' as const,
            role: worker.role ?? undefined,
            monthly_salary: worker.monthly_salary ?? undefined,
            whatsapp_number: worker.whatsapp_number ?? undefined,
        })),
    ].sort((a, b) => a.name.localeCompare(b.name))
}

export function buildPendingAdvanceOverview(rows: PendingAdvanceRow[]): PendingAdvanceOverview[] {
    return rows.map((advance) => ({
        id: advance.id,
        amount: advance.amount,
        description: advance.description,
        status: advance.status,
        created_at: advance.created_at,
        deducted_at: advance.deducted_at,
        deducted_in_month: advance.deducted_in_month,
        workerName: (Array.isArray(advance.workers) ? advance.workers[0] : advance.workers)?.name
            || (Array.isArray(advance.fixed_workers) ? advance.fixed_workers[0] : advance.fixed_workers)?.name
            || 'Unknown worker',
        workerType: advance.meter_worker_id ? 'meter' : 'fixed',
    }))
}
