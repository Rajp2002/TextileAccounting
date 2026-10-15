import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const owner = 'app/(dashboard)/owner'

describe('setup changes take effect from go-live', () => {
    it('evaluates and dates the assignment workspace from go-live', () => {
        const loader = read(`${owner}/assignments/loaders.ts`)
        expect(loader).toContain('effectiveDateFor(')
        expect(loader).toContain('getBaseGoLiveState(')
    })
    it('dates Switch shifts from go-live', () => {
        const actions = read(`${owner}/production/actions.ts`)
        const rotate = actions.slice(actions.indexOf('export async function rotateBaseWorkerShifts('), actions.indexOf('\nexport ', actions.indexOf('export async function rotateBaseWorkerShifts(') + 1))
        expect(rotate).not.toContain('p_effective_from: getSuratTodayString()')
        expect(rotate).toContain('effectiveDateFor(')
    })
    it('gives the production loader the go-live phase, options and effective date', () => {
        const loader = read(`${owner}/production/loaders.ts`)
        for (const field of ['goLivePhase:', 'goLiveOptions:', 'effectiveDate:']) expect(loader).toContain(field)
    })
    it('hands qualities and the workspace the effective date, not today', () => {
        const client = read(`${owner}/production/BaseProductionClient.tsx`)
        expect(client).toContain('today={initialData.effectiveDate ?? initialData.today}')
        expect(client).toContain('initialData={assignmentData}')
    })
    it('keeps challans closed until go-live', () => {
        const actions = read(`${owner}/dispatches/challan-actions.ts`)
        const mutate = actions.slice(actions.indexOf('export async function mutateChallan('))
        expect(mutate).toContain('getBaseGoLiveState(')
        expect(mutate).toContain('Challans open on')
        // Payments, receipts and reversals on challans that already exist stay open; only new dispatch waits.
        expect(mutate).toContain("(input.action === 'save' || input.action === 'confirm') && goLive.phase !== 'live'")
    })
})
