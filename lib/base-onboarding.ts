export const BASE_ONBOARDING_VERSION = 1

export type BaseOnboardingStep =
    | 'factory'
    | 'defaults'
    | 'machines'
    | 'workers'
    | 'payroll'
    | 'review'
    | 'completed'

export const ONBOARDING_STEPS: BaseOnboardingStep[] = [
    'factory',
    'defaults',
    'machines',
    'workers',
    'payroll',
    'review',
]

export interface FactoryDefaultsInput {
    name: string
    yarnShortagePct: number
    defaultMarginPct: number
    overheadMode: 'direct' | 'monthly_expenses'
    warpingMode: 'in_house' | 'outsourced'
    sizingMode: 'in_house' | 'outsourced'
}

export interface MachineRowInput {
    id: string
    name: string
    machineType: string
    customLabel?: string
    error?: string
}

export interface WorkerRowInput {
    id: string
    name: string
    payType: 'piece_rate' | 'fixed_monthly'
    monthlySalary?: number
    role?: string
    startDate?: string
    error?: string
}

export interface PayrollCycleInput {
    cycleType: 'monthly' | 'weekly' | 'interval_days' | 'interval_weeks'
    anchorDay?: number
    anchorWeekday?: string
    intervalDays?: number
    anchorDate?: string
}

export interface BaseOnboardingDraft {
    version: number
    currentStep: BaseOnboardingStep
    factory: {
        name: string
        ownerContact?: string
    }
    defaults: FactoryDefaultsInput
    machines: Record<string, MachineRowInput[]>
    workers: {
        pieceRate: WorkerRowInput[]
        fixedSalary: WorkerRowInput[]
    }
    payroll: PayrollCycleInput
    skippedSteps: string[]
    lastUpdated?: string
}

export interface FactoryReadiness {
    defaultsConfigured: boolean
    machinesConfigured: boolean
    workersConfigured: boolean
    payrollConfigured: boolean
    isFactoryReady: boolean
    machineCount: number
    workerCount: {
        pieceRate: number
        fixedSalary: number
        total: number
    }
}

export const BASE_MACHINE_PRESETS = [
    { key: 'rapier', label: 'Rapier' },
    { key: 'water_jet', label: 'Water Jet' },
    { key: 'air_jet', label: 'Air Jet' },
    { key: 'power_loom', label: 'Power Loom' },
] as const

export function getMachineTypeLabel(type: string, customLabel?: string): string {
    if (customLabel && customLabel.trim()) {
        return customLabel.trim()
    }
    const preset = BASE_MACHINE_PRESETS.find(p => p.key === type)
    if (preset) return preset.label
    if (type === 'jacquard') return 'Jacquard'
    if (type === 'circular') return 'Circular'
    return type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : 'Machine'
}

/**
 * Pure helper to parse newline-separated machine rows from clipboard paste.
 */
export function parsePastedMachineLines(
    text: string,
    machineType: string,
    customLabel?: string
): MachineRowInput[] {
    if (!text || !text.trim()) return []
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)

    return lines.map(line => ({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mach_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: line,
        machineType,
        customLabel: customLabel || undefined,
    }))
}

/**
 * Pure helper to parse newline or tab-separated worker rows from clipboard paste.
 */
export function parsePastedWorkerLines(
    text: string,
    payType: 'piece_rate' | 'fixed_monthly'
): WorkerRowInput[] {
    if (!text || !text.trim()) return []
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)

    return lines.map(line => {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wrk_${Date.now()}_${Math.random().toString(36).slice(2)}`
        if (payType === 'fixed_monthly') {
            // Check for TSV or comma separation: Name \t Salary \t Role
            // If tab is present, split on tab so numbers with commas (e.g. 22,000) are not split
            const delimiter = line.includes('\t') ? '\t' : ','
            const parts = line.split(delimiter).map(p => p.trim()).filter(Boolean)
            if (parts.length >= 2) {
                const name = parts[0]
                const salaryRaw = parts[1].replace(/[^\d.]/g, '')
                const salary = Number(salaryRaw) || 0
                const role = parts[2] || ''
                return {
                    id,
                    name,
                    payType: 'fixed_monthly',
                    monthlySalary: salary,
                    role,
                }
            }
            return {
                id,
                name: line,
                payType: 'fixed_monthly',
                monthlySalary: 0,
                role: '',
            }
        }

        return {
            id,
            name: line,
            payType: 'piece_rate',
        }
    })
}

/**
 * Default clean initial draft state.
 */
export function getDefaultBaseOnboardingDraft(factoryName = ''): BaseOnboardingDraft {
    return {
        version: BASE_ONBOARDING_VERSION,
        currentStep: 'factory',
        factory: {
            name: factoryName,
            ownerContact: '',
        },
        defaults: {
            name: factoryName,
            yarnShortagePct: 3.0,
            defaultMarginPct: 5.0,
            overheadMode: 'monthly_expenses',
            warpingMode: 'in_house',
            sizingMode: 'in_house',
        },
        machines: {
            rapier: [],
        },
        workers: {
            pieceRate: [],
            fixedSalary: [],
        },
        payroll: {
            cycleType: 'monthly',
            anchorDay: 1,
        },
        skippedSteps: [],
    }
}
