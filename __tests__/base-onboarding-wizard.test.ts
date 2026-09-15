import { describe, expect, it } from 'vitest'
import {
    parsePastedMachineLines,
    parsePastedWorkerLines,
    getMachineTypeLabel,
    getDefaultBaseOnboardingDraft,
    BASE_ONBOARDING_VERSION,
} from '@/lib/base-onboarding'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Base Onboarding — Machine Parsing & Types', () => {
    it('parses newline-separated machine names into structured rows', () => {
        const text = `
            RP-01
            RP-02

            RP-03
        `
        const rows = parsePastedMachineLines(text, 'rapier')
        expect(rows).toHaveLength(3)
        expect(rows[0].name).toBe('RP-01')
        expect(rows[0].machineType).toBe('rapier')
        expect(rows[1].name).toBe('RP-02')
        expect(rows[2].name).toBe('RP-03')
        expect(rows[0].id).toBeDefined()
        expect(rows[0].id).not.toBe(rows[1].id)
    })

    it('supports custom machine labels on paste', () => {
        const text = 'JAC-01\nJAC-02'
        const rows = parsePastedMachineLines(text, 'other', 'Jacquard Loom')
        expect(rows).toHaveLength(2)
        expect(rows[0].customLabel).toBe('Jacquard Loom')
    })

    it('returns empty array when text is empty or blank', () => {
        expect(parsePastedMachineLines('', 'rapier')).toEqual([])
        expect(parsePastedMachineLines('   \n  \n  ', 'rapier')).toEqual([])
    })

    it('formats machine type labels correctly', () => {
        expect(getMachineTypeLabel('rapier')).toBe('Rapier')
        expect(getMachineTypeLabel('water_jet')).toBe('Water Jet')
        expect(getMachineTypeLabel('air_jet')).toBe('Air Jet')
        expect(getMachineTypeLabel('power_loom')).toBe('Power Loom')
        expect(getMachineTypeLabel('other', 'Special Jacquard')).toBe('Special Jacquard')
    })
})

describe('Base Onboarding — Workforce Parsing', () => {
    it('parses piece-rate worker names from newline-separated text', () => {
        const text = 'Ramesh Patel\nMahesh Patel\nDharmesh'
        const rows = parsePastedWorkerLines(text, 'piece_rate')
        expect(rows).toHaveLength(3)
        expect(rows[0].name).toBe('Ramesh Patel')
        expect(rows[0].payType).toBe('piece_rate')
        expect(rows[1].name).toBe('Mahesh Patel')
        expect(rows[2].name).toBe('Dharmesh')
    })

    it('parses tab-separated fixed salary worker records', () => {
        const text = 'Ramesh Patel\t18000\tSupervisor\nMahesh Patel\t₹22,000\tManager'
        const rows = parsePastedWorkerLines(text, 'fixed_monthly')
        expect(rows).toHaveLength(2)
        expect(rows[0].name).toBe('Ramesh Patel')
        expect(rows[0].monthlySalary).toBe(18000)
        expect(rows[0].role).toBe('Supervisor')
        expect(rows[1].name).toBe('Mahesh Patel')
        expect(rows[1].monthlySalary).toBe(22000)
        expect(rows[1].role).toBe('Manager')
    })

    it('gracefully handles fixed salary workers when salary column is missing in paste', () => {
        const text = 'Dinesh\nKetan'
        const rows = parsePastedWorkerLines(text, 'fixed_monthly')
        expect(rows).toHaveLength(2)
        expect(rows[0].name).toBe('Dinesh')
        expect(rows[0].monthlySalary).toBe(0)
    })
})

describe('Base Onboarding — Initial Draft & Schema', () => {
    it('generates a clean default draft with version 1 and recommended defaults', () => {
        const draft = getDefaultBaseOnboardingDraft('Surat Weaving Unit')
        expect(draft.version).toBe(BASE_ONBOARDING_VERSION)
        expect(draft.factory.name).toBe('Surat Weaving Unit')
        expect(draft.defaults.yarnShortagePct).toBe(3.0)
        expect(draft.defaults.defaultMarginPct).toBe(5.0)
        expect(draft.defaults.overheadMode).toBe('monthly_expenses')
        expect(draft.defaults.warpingMode).toBe('in_house')
        expect(draft.defaults.sizingMode).toBe('in_house')
        expect(draft.payroll.cycleType).toBe('monthly')
        expect(draft.payroll.anchorDay).toBe(1)
        expect(draft.currentStep).toBe('factory')
    })
})

describe('Base Onboarding — Server Actions Contract', () => {
    const actionsSource = readProjectFile('app/(auth)/onboarding/base/actions.ts')

    it('contains bulk saving operations for machines and workers', () => {
        expect(actionsSource).toContain('export async function saveBaseOnboardingMachinesBulkAction')
        expect(actionsSource).toContain('export async function saveBaseOnboardingWorkersBulkAction')
        expect(actionsSource).toContain('export async function saveBaseOnboardingDefaultsAction')
        expect(actionsSource).toContain('export async function saveBaseOnboardingPayrollAction')
        expect(actionsSource).toContain('export async function completeBaseOnboardingAction')
    })

    it('enforces duplicate checking and length limits on machine bulk save', () => {
        expect(actionsSource).toContain('Each machine identifier must be unique')
        expect(actionsSource).toContain('exceeds 120 characters')
    })

    it('enforces salary requirements on fixed workers', () => {
        expect(actionsSource).toContain('Please enter a positive monthly salary for fixed worker')
    })

    it('handles missing base_onboarding column gracefully in completeBaseOnboardingAction', () => {
        expect(actionsSource).toContain("updateError.code === '42703'")
        expect(actionsSource).toContain('onboarding_complete: true')
        expect(actionsSource).toContain('app_metadata: {')
    })
})

describe('Base Onboarding — Navigation & Routing Guards', () => {
    const ownerLayout = readProjectFile('app/(dashboard)/owner/layout.tsx')
    const planCard = readProjectFile('components/plans/PlanCard.tsx')
    const onboardingBasePage = readProjectFile('app/(auth)/onboarding/base/page.tsx')

    it('redirects Base owners to /onboarding/base when onboarding is incomplete in OwnerLayout', () => {
        expect(ownerLayout).toContain("if (access.effectiveTier === 'base')")
        expect(ownerLayout).toContain("redirect('/onboarding/base')")
        expect(ownerLayout).toContain("if (!pathname.startsWith('/owner/billing'))")
    })

    it('points Base checkout successHref to /onboarding/base', () => {
        expect(planCard).toContain('successHref="/onboarding/base"')
    })

    it('enforces tier and role guards on /onboarding/base page', () => {
        expect(onboardingBasePage).toContain("if (role === 'supervisor')")
        expect(onboardingBasePage).toContain("if (tier === 'free'")
        expect(onboardingBasePage).toContain("if (tier === 'none') redirect('/owner/billing')")
        expect(onboardingBasePage).toContain("if (tier === 'lite') redirect('/owner/estimator')")
    })
})
