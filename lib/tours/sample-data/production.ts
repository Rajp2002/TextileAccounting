import type { Language } from '@/lib/i18n/context'
import type { BaseProductionInitialData } from '@/app/(dashboard)/owner/production/loaders'
import { payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'

/**
 * Sample factory for the Production, Daily Sheet and Payroll tours. They all teach pages that render
 * BaseProductionClient, so they share one dataset: the real component renders it exactly as it renders a real
 * account's data. Every id starts with `tour-` (see sample-ids.ts) so nothing here can be mistaken for, or
 * written as, a real record.
 */
export const PRODUCTION_SAMPLE_TODAY = '2026-09-16'

const NAMES: Record<Language, { quality: string; second: string; worker: string; loom: string }> = {
    en: { quality: 'Sample fabric', second: 'Sample cotton', worker: 'Sample worker', loom: 'Sample loom' },
    gu: { quality: 'નમૂના કાપડ', second: 'નમૂના કોટન', worker: 'નમૂના કારીગર', loom: 'નમૂના લૂમ' },
    hi: { quality: 'नमूना कपड़ा', second: 'नमूना कॉटन', worker: 'नमूना कारीगर', loom: 'नमूना लूम' },
}

const STAMP = '2026-09-01T09:00:00+05:30'
const WAGE = 2 // ₹ per metre, the figure the tour copy quotes
const COST = 40 // ₹ per metre
const PRICE = 45

export function productionSampleNames(language: Language) {
    return NAMES[language]
}

/** What the Daily Sheet tour shows typed into the sheet: loom 1 wove 120 m, loom 2 is still pending, loom 3 did not run. */
export const DAILY_SAMPLE_READINGS: Readonly<Record<string, string>> = { 'tour-machine-1': '120', 'tour-machine-3': '0' }

/**
 * `overview`: two looms run the quality and one is free, so the Machine Board shows both states.
 * `daily` and `payroll`: all three looms run it, each with its own day-shift operator.
 */
export type ProductionSampleVariant = 'overview' | 'daily' | 'payroll'

export function productionSampleData(language: Language, variant: ProductionSampleVariant = 'overview'): BaseProductionInitialData {
    const { quality, second, worker, loom } = NAMES[language]
    const today = PRODUCTION_SAMPLE_TODAY
    const running = variant === 'overview' ? [1, 2] : [1, 2, 3]

    const costing = (id: string, label: string, group: string, version: number) => ({
        id, quality_label: label, costing_group_id: group, version_number: version, order_quantity_m: 1000,
        production_cost_per_meter: COST, landed_cost_per_meter: COST, quote_price_per_meter: PRICE, worker_rate_per_meter: WAGE,
    })
    const machine = (number: number) => ({ id: `tour-machine-${number}`, name: `${loom} ${number}`, machine_type: 'Rapier', custom_label: null, is_active: true })
    const person = (number: number) => ({
        id: `tour-worker-${number}`, name: number === 1 ? worker : `${worker} ${number}`, rate_per_meter: WAGE,
        shift_availability: 'both' as const, is_active: true, pay_type: 'piece_rate' as const,
        operator_eligible: true, operator_effective_from: '2026-01-01', start_date: '2026-01-01',
    })
    const entry = (id: string, workerId: string, date: string, meters: number) => ({
        id, job_id: 'tour-job-1', worker_id: workerId, production_date: date, meters, worker_rate_snapshot: WAGE, notes: null,
        created_at: `${date}T20:00:00+05:30`, batch_id: null, shift: 'day' as const, entry_status: 'entered' as const,
        allocation_mode: 'worker_total' as const, machine_id: null, machine_label: null, job_label: quality, assignment_snapshot: null,
    })

    return {
        orgId: 'tour-org',
        actorId: 'tour-user',
        today,
        payrollPeriod: { start: '2026-09-01', end: '2026-09-30' },
        // One quality already running (v2) and one more to choose from in the Activate Quality dialog.
        costings: [costing('tour-costing-2', quality, 'tour-group-fabric', 2), costing('tour-costing-3', second, 'tour-group-cotton', 1)],
        jobs: [{
            id: 'tour-job-1', costing_id: 'tour-costing-2', costing_group_id: 'tour-group-fabric', costing_version: 2, quality_label: quality,
            target_meters: 1000, start_date: '2026-09-01', due_date: null, customer_reference: null, notes: null, status: 'active',
            worker_rate_per_meter: WAGE, planned_cost_per_meter: COST, planned_price_per_meter: PRICE, created_at: STAMP,
        }],
        // Looms 1 and 2 run the quality; loom 3 is free, so the board shows both states.
        machines: [machine(1), machine(2), machine(3)],
        machineJobContexts: running.map(number => ({
            id: `tour-context-${number}`, machine_id: `tour-machine-${number}`, job_id: 'tour-job-1', effective_from: '2026-09-01', effective_to: null, active: true,
        })),
        workers: running.map(person),
        assignments: running.map(number => ({
            id: `tour-assignment-${number}`, worker_id: `tour-worker-${number}`, machine_id: `tour-machine-${number}`, shift: 'day' as const,
            active: true, effective_from: '2026-09-01', effective_to: null,
        })),
        // Earnings so Payroll has something to settle: 120 m x ₹2/m = ₹240 a day.
        entries: [
            entry('tour-entry-1', 'tour-worker-1', '2026-09-14', 120),
            entry('tour-entry-2', 'tour-worker-1', '2026-09-15', 120),
            entry('tour-entry-3', 'tour-worker-2', '2026-09-15', 120),
        ],
        dailyBatches: [],
        batchRevisions: [],
        incentives: [],
        advances: [{ id: 'tour-advance-1', worker_id: 'tour-worker-1', amount: 200, recovered_amount: 0, description: null, status: 'pending', created_at: '2026-09-10T10:00:00+05:30' }],
        settlements: [],
        settlementLines: [],
        payrollPeriods: [],
        allocations: [],
    }
}

/**
 * Payroll sample: the August pay period is over, so completing it is meaningful. A weaver wove 1,000 m at ₹2/m with a
 * ₹1,000 advance (half of the ₹2,000 gross is recovered, the figures the tour copy quotes), a staff member is on a
 * monthly salary, a third worker earned nothing, and July is already settled so the records steps have history.
 */
export function payrollSampleData(language: Language): BaseProductionInitialData {
    const base = productionSampleData(language, 'daily')
    const { quality, loom } = NAMES[language]
    const people = payrollTutorialCopy[language].people
    const machineLabel = `${loom} 1`
    const worker = (id: string, name: string) => ({
        id, name, rate_per_meter: WAGE, shift_availability: 'both' as const, is_active: true,
        operator_eligible: true, operator_effective_from: '2026-01-01', start_date: '2026-01-01',
    })
    const entry = (id: string, date: string, meters: number) => ({
        id, job_id: 'tour-job-1', worker_id: 'tour-worker-1', production_date: date, meters, worker_rate_snapshot: WAGE, notes: null,
        created_at: `${date}T20:00:00+05:30`, batch_id: null, shift: 'day' as const, entry_status: 'entered' as const,
        allocation_mode: 'machine_breakdown' as const, machine_id: 'tour-machine-1', machine_label: machineLabel, job_label: quality, assignment_snapshot: null,
    })
    const allocation = (entryId: string, date: string, meters: number) => ({
        id: `${entryId}-allocation`, entry_id: entryId, worker_id: 'tour-worker-1', assignment_id: 'tour-assignment-1', machine_id: 'tour-machine-1',
        job_id: 'tour-job-1', meters, worker_rate_snapshot: WAGE, machine_label: machineLabel, job_label: quality, assignment_snapshot: null, created_at: `${date}T20:00:00+05:30`,
    })
    const settlement = (id: string, workerId: string, name: string, gross: number, mode: 'cash' | 'upi') => ({
        id, worker_id: workerId, period_start: '2026-07-01', period_end: '2026-07-31', gross_pay: gross, advance_deducted: 0, net_payout: gross,
        payment_mode: mode, paid_at: '2026-08-02T11:00:00+05:30', status: 'paid' as const, worker_name_snapshot: name, payroll_period_id: 'tour-period-jul',
    })
    const line = (id: string, settlementId: string, workerId: string, kind: 'machine_allocation' | 'fixed_salary', meters: number, gross: number) => ({
        id, settlement_id: settlementId, worker_id: workerId, production_date: '2026-07-20', shift: kind === 'fixed_salary' ? null : 'day' as const,
        machine_id: kind === 'fixed_salary' ? null : 'tour-machine-1', machine_label: kind === 'fixed_salary' ? '' : machineLabel,
        job_id: kind === 'fixed_salary' ? null : 'tour-job-1', costing_label: kind === 'fixed_salary' ? '' : quality, meters, worker_rate_snapshot: WAGE, gross_pay: gross, source_kind: kind,
    })

    return {
        ...base,
        payrollPeriod: { start: '2026-08-01', end: '2026-08-31' },
        workers: [
            { ...worker('tour-worker-1', people.piece), pay_type: 'piece_rate' as const },
            { ...worker('tour-worker-2', people.salary), pay_type: 'fixed_monthly' as const, role: 'Supervisor', operator_eligible: false, monthly_salary: 18000,
                salary_effective_from: '2026-01-01', salary_history: [{ effective_from: '2026-01-01', monthly_salary: 18000 }] },
            { ...worker('tour-worker-3', people.zero), pay_type: 'piece_rate' as const },
        ],
        entries: [entry('tour-entry-1', '2026-08-18', 600), entry('tour-entry-2', '2026-08-19', 400), entry('tour-entry-0', '2026-07-20', 500)],
        allocations: [allocation('tour-entry-1', '2026-08-18', 600), allocation('tour-entry-2', '2026-08-19', 400), allocation('tour-entry-0', '2026-07-20', 500)],
        advances: [{ id: 'tour-advance-1', worker_id: 'tour-worker-1', amount: 1000, recovered_amount: 0, description: null, status: 'pending', created_at: '2026-08-10T10:00:00+05:30' }],
        settlements: [settlement('tour-settlement-1', 'tour-worker-1', people.piece, 1000, 'cash'), settlement('tour-settlement-2', 'tour-worker-2', people.salary, 18000, 'upi')],
        settlementLines: [line('tour-line-1', 'tour-settlement-1', 'tour-worker-1', 'machine_allocation', 500, 1000), line('tour-line-2', 'tour-settlement-2', 'tour-worker-2', 'fixed_salary', 0, 18000)],
        payrollPeriods: [{
            id: 'tour-period-jul', period_start: '2026-07-01', period_end: '2026-07-31', status: 'settled', total_gross: 19000, total_recovery: 0, total_net: 19000,
            total_workers: 2, paid_workers: 2, settled_at: '2026-08-02T11:30:00+05:30', settled_by: 'tour-user', calculation_snapshot: null,
        }],
    }
}
