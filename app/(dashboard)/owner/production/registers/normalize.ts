import { readBaseSalaryHistory } from '@/lib/base-salary'
import { toBaseNumber, type BaseProductionWorker, type BaseProductionMachine } from '@/lib/base-production-core'
export function normalizeWorker(row: Record<string, unknown>): BaseProductionWorker { return {
        updated_at: String(row.updated_at),
        pay_type: row.pay_type === 'fixed_monthly' ? 'fixed_monthly' : 'piece_rate',
        role: String(row.role ?? ''),
        monthly_salary: toBaseNumber(typeof row.monthly_salary === 'number' || typeof row.monthly_salary === 'string' ? row.monthly_salary : 0),
        salary_effective_from: toStringOrNull(row.salary_effective_from),
        salary_history: readBaseSalaryHistory(row.salary_history),
        start_date: toStringOrNull(row.start_date),
        end_date: toStringOrNull(row.end_date),
        id: String(row.id),
        name: String(row.name || 'Unnamed worker'),
        rate_per_meter: toBaseNumber(typeof row.rate_per_meter === 'number' || typeof row.rate_per_meter === 'string' ? row.rate_per_meter : 0),
        shift_availability: row.shift_availability === 'day' || row.shift_availability === 'night'
            ? row.shift_availability
            : 'both',
        is_active: row.is_active !== false,
    } }
export function normalizeMachine(row: Record<string, unknown>): BaseProductionMachine { return {
        id: String(row.id),
        name: String(row.name || 'Unnamed machine'),
        machine_type: String(row.machine_type || 'other'),
        custom_label: toStringOrNull(row.custom_label),
        is_active: row.is_active !== false,
    } }
function toStringOrNull(value: unknown) { return typeof value === 'string' && value.length > 0 ? value : null }
