import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { SHIFT_ROTATION_PHRASES } from '../lib/i18n/shift-rotation-phrases'
import type { RotationAssignment } from '../lib/base-shift-rotation'
import type { BaseProductionWorkerWithOperational } from '../lib/worker-operational'

vi.mock('@/lib/i18n/context', () => ({
    useTranslation: () => ({
        language: 'en',
        t: (key: string) => key,
        tx: (text: string, values?: Record<string, string | number>) =>
            values ? text.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match)) : text,
    }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ rotateBaseWorkerShifts: vi.fn() }))
import { SwitchShiftsPanel } from '../components/workers/SwitchShiftsDialog'

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

function worker(id: string, name: string, shift: BaseProductionWorkerWithOperational['shift_availability'], extra: Partial<BaseProductionWorkerWithOperational> = {}): BaseProductionWorkerWithOperational {
    return { id, name, rate_per_meter: 0, shift_availability: shift, is_active: true, pay_type: 'piece_rate', ...extra }
}
const loom = (workerId: string, machineId: string, shift: 'day' | 'night'): RotationAssignment => ({ worker_id: workerId, machine_id: machineId, shift })
const machineNames = { m1: 'Loom 1', m2: 'Loom 2' }

function render(workers: BaseProductionWorkerWithOperational[], assignments: RotationAssignment[]) {
    return renderToStaticMarkup(<SwitchShiftsPanel workers={workers} assignments={assignments} machineNames={machineNames} onClose={() => {}} />)
}

describe('SwitchShiftsPanel', () => {
    const workers = [
        worker('a', 'Ramesh', 'day'),
        worker('b', 'Suresh', 'night'),
        worker('c', 'Mahesh', 'both'),
        worker('d', 'Hari', 'day', { pay_type: 'fixed_monthly' }),
        worker('e', 'Gone', 'night', { is_active: false }),
    ]

    it('lists only rotatable workers, all selected, grouped by direction', () => {
        const html = render(workers, [loom('a', 'm1', 'day'), loom('a', 'm2', 'day'), loom('b', 'm1', 'night')])
        expect(html).toContain('Ramesh')
        expect(html).toContain('Suresh')
        for (const hidden of ['Mahesh', 'Hari', 'Gone']) expect(html).not.toContain(hidden)
        expect(html.match(/type="checkbox"/g)).toHaveLength(2)
        expect(html.match(/checked=""/g)).toHaveLength(2)
        expect(html).toContain('Day → Night')
        expect(html).toContain('Night → Day')
        expect(html).toContain('2 looms')
        expect(html).toContain('1 loom')
        expect(html).toContain('Switch 2 workers')
        expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>[^<]*Switch 2 workers/)
    })

    it('makes every row a 44px touch target and names the checkbox by its worker', () => {
        const html = render(workers, [])
        expect(html).toContain('min-h-[44px]')
        expect(html).toContain('No looms')
    })

    it('blocks confirming when a switching worker would land on a loom shift someone else keeps', () => {
        const html = render(
            [worker('a', 'Ramesh', 'day'), worker('c', 'Mahesh', 'both')],
            [loom('a', 'm1', 'day'), loom('c', 'm1', 'night')],
        )
        expect(html).toContain('Loom 1 (Night shift) is held by Mahesh, who is not switching.')
        expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>[^<]*Switch 1 worker/)
    })

    it('says so when there is nobody to switch, without a confirm button', () => {
        const html = render([worker('c', 'Mahesh', 'both')], [])
        expect(html).toContain('No piece-rate workers on a single shift to switch.')
        expect(html).not.toContain('type="checkbox"')
        expect(html).not.toContain('Switch 0 workers')
    })

    it('always explains who is left out', () => {
        expect(render(workers, [])).toContain('Workers set to Day &amp; night and fixed-salary staff are not included.')
    })
})

describe('switch shifts wiring', () => {
    it('exposes an owner-only server action that calls the rotation function for today', () => {
        const actions = read('app/(dashboard)/owner/production/actions.ts')
        const start = actions.indexOf('export async function rotateBaseWorkerShifts')
        expect(start).toBeGreaterThan(-1)
        const body = actions.slice(start, actions.indexOf('\nexport async function', start + 10))
        expect(body).toContain('requireBaseProductionOwner()')
        expect(body).toContain("supabase.rpc('rotate_base_worker_shifts'")
        expect(body).toContain('p_effective_from: getSuratTodayString()')
        expect(body).toContain("revalidatePath('/owner/workers')")
        expect(body).toContain("revalidatePath('/owner/payroll')")
    })

    it('puts the pill in the toolbar and opens the dialog from the register', () => {
        const toolbar = read('components/workers/WorkerToolbar.tsx')
        expect(toolbar).toContain('onSwitchShifts')
        expect(toolbar).toContain("tx('Switch shifts')")
        expect(toolbar).toContain('data-workers-switch-shifts')
        const register = read('app/(dashboard)/owner/production/registers/WorkersRegister.tsx')
        expect(register).toContain('SwitchShiftsDialog')
        expect(register).toContain('onSwitchShifts')
    })

    it('loads open loom assignments and loom names for the modal', () => {
        const loader = read('app/(dashboard)/owner/production/registers/loaders.ts')
        expect(loader).toContain('rotation')
        expect(loader).toContain("db.from('base_production_machines')")
        expect(read('app/(dashboard)/owner/workers/page.tsx')).toContain('rotation={data.rotation}')
    })
})

describe('switch shifts translations', () => {
    const literalsIn = (file: string) => [...read(file).matchAll(/\btx\('((?:[^'\\]|\\.)+)'/g)].map(match => match[1].replace(/\\'/g, "'"))
    // Already translated elsewhere in the app, so not repeated in the phrase file.
    const translatedElsewhere = new Set(['Cancel', 'Day shift', 'Night shift'])
    const literals = [...new Set([
        ...literalsIn('components/workers/SwitchShiftsDialog.tsx'),
        ...literalsIn('components/workers/WorkerToolbar.tsx').filter(text => /shift/i.test(text) && text.startsWith('Switch')),
    ])].filter(text => !translatedElsewhere.has(text))

    it('guards the strings it is meant to guard', () => {
        expect(literals).toEqual(expect.arrayContaining(['Switch shifts', 'Select all', 'Clear all']))
    })

    it.each(['hi', 'gu'] as const)('has a registered, non-empty %s translation for every string', language => {
        for (const phrase of literals) {
            expect(SHIFT_ROTATION_PHRASES[language][phrase], `${language}: ${phrase}`).toBeTruthy()
            expect(BASE_PLAN_PHRASES[language][phrase], `${language} is registered: ${phrase}`).toBe(SHIFT_ROTATION_PHRASES[language][phrase])
        }
    })
})
