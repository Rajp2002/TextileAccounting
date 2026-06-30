export const PAYROLL_PF_EMPLOYEE_RATE = 0.12
export const PAYROLL_PF_WAGE_CEILING = 15000
export const PAYROLL_ESIC_EMPLOYEE_RATE = 0.0075
export const PAYROLL_ESIC_WAGE_CEILING = 21000

export type PayrollStatutoryDeductions = {
    pfEmployee: number
    esicEmployee: number
    pfBasis: number
    esicBasis: number
}

function toPayrollNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}

function firstNumber(...values: unknown[]): number {
    for (const value of values) {
        if (value === null || value === undefined) continue
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }

    return 0
}

export function calculatePayrollStatutoryDeductions(
    adjustedGross: number,
    enrolled: boolean
): PayrollStatutoryDeductions {
    const grossPay = Math.max(toPayrollNumber(adjustedGross), 0)

    if (!enrolled || grossPay <= 0) {
        return { pfEmployee: 0, esicEmployee: 0, pfBasis: 0, esicBasis: 0 }
    }

    const pfBasis = Math.min(grossPay, PAYROLL_PF_WAGE_CEILING)
    const esicBasis = grossPay <= PAYROLL_ESIC_WAGE_CEILING ? grossPay : 0

    return {
        pfEmployee: pfBasis * PAYROLL_PF_EMPLOYEE_RATE,
        esicEmployee: esicBasis * PAYROLL_ESIC_EMPLOYEE_RATE,
        pfBasis,
        esicBasis,
    }
}

export function extractPayrollStatutoryDeductionsFromItemization(
    payload: unknown
): Pick<PayrollStatutoryDeductions, 'pfEmployee' | 'esicEmployee'> {
    const itemization = asRecord(payload)
    const pf = asRecord(itemization.pf)
    const esic = asRecord(itemization.esic)

    return {
        pfEmployee: firstNumber(pf.employee, itemization.employee_pf, itemization.pfEmployee),
        esicEmployee: firstNumber(esic.employee, itemization.employee_esic, itemization.esicEmployee),
    }
}
