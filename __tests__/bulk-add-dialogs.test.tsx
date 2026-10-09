import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { makeMachinesTourExamples } from '../lib/machines-tour'
import { makeWorkersTourExamples } from '../lib/workers-tour'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/owner/workers', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({
    language: 'en',
    tx: (text: string, values?: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key) => String(values?.[key] ?? match)),
    t: (key: string) => key,
}) }))
vi.mock('@/components/settings/plan-aware/unsaved-changes-dialog', () => ({ useUnloadProtection: vi.fn() }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({
    createBaseProductionWorker: vi.fn(), createBaseProductionWorkersBulk: vi.fn(), updateBaseProductionWorker: vi.fn(),
    createBaseProductionMachine: vi.fn(), createBaseProductionMachinesBulk: vi.fn(), updateBaseProductionMachine: vi.fn(),
}))
vi.mock('@/lib/plan-analytics', () => ({ trackPlanEvent: vi.fn() }))
vi.mock('@/lib/app-notifications', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogFooter: Container, DialogHeader: Container, DialogTitle: Container }
})
import WorkerEditor from '../app/(dashboard)/owner/production/registers/WorkerEditor'
import MachineEditor from '../app/(dashboard)/owner/production/registers/MachineEditor'
import { BulkWorkerEntry } from '../components/workers/BulkWorkerEntry'
import { BulkMachineEntry } from '../components/machines/BulkMachineEntry'
import { evaluateBulkMachines, evaluateBulkWorkers } from '../lib/base-bulk-register'

const switchState = (html: string) => /role="switch"[^>]*aria-checked="(true|false)"/.exec(html)?.[1]

describe('Add worker dialog, bulk toggle', () => {
    const open = () => renderToStaticMarkup(<WorkerEditor today="2026-10-10" initialOpen existingNames={['Ramesh']}>{() => null}</WorkerEditor>)

    it('offers the toggle, off by default, with the single-worker form unchanged', () => {
        const html = open()
        expect(html).toContain('data-workers-bulk-toggle')
        expect(html).toContain('Add in bulk')
        expect(switchState(html)).toBe('false')
        expect(html).toContain('id="base-worker-name"')
        expect(html).toContain('Add worker')
        expect(html).not.toContain('base-worker-bulk-names')
        expect(html).not.toContain('<textarea')
    })
    it('does not offer it in the guided-tour sample, add or edit', () => {
        const [worker] = makeWorkersTourExamples('en')
        for (const editing of [false, true]) {
            const html = renderToStaticMarkup(<WorkerEditor today="2026-10-10" tourPreview={{ worker, editing }}>{() => null}</WorkerEditor>)
            expect(html).not.toContain('data-workers-bulk-toggle')
            expect(html).not.toContain('Add in bulk')
        }
    })
})

describe('Add machine dialog, bulk toggle', () => {
    const open = () => renderToStaticMarkup(<MachineEditor today="2026-10-10" initialOpen existingNames={['Loom #1']}>{() => null}</MachineEditor>)

    it('offers the toggle, off by default, with the single-machine form unchanged', () => {
        const html = open()
        expect(html).toContain('data-machines-bulk-toggle')
        expect(html).toContain('Add in bulk')
        expect(switchState(html)).toBe('false')
        expect(html).toContain('id="base-machine-name"')
        expect(html).toContain('id="base-machine-label"')
        expect(html).not.toContain('base-machine-bulk-count')
    })
    it('does not offer it in the guided-tour sample, add or edit', () => {
        const [machine] = makeMachinesTourExamples()
        for (const editing of [false, true]) {
            const html = renderToStaticMarkup(<MachineEditor today="2026-10-10" tourPreview={{ machine, editing }}>{() => null}</MachineEditor>)
            expect(html).not.toContain('data-machines-bulk-toggle')
            expect(html).not.toContain('Add in bulk')
        }
    })
})

describe('Bulk entry sections', () => {
    const noop = () => {}
    const workersDraft = {
        piece: [{ id: 'p1', name: 'Ramesh' }, { id: 'p2', name: 'Suresh' }],
        staff: [{ id: 's1', name: 'Mahesh', role: 'Supervisor', monthlySalary: 18000 }, { id: 's2', name: '', role: '', monthlySalary: 9000 }],
        joiningDate: '2026-10-10',
    }

    it('lists piece rate and fixed rate sections, with name, role and salary in that order', () => {
        const evaluation = evaluateBulkWorkers(workersDraft.piece, workersDraft.staff, [], workersDraft.joiningDate)
        const html = renderToStaticMarkup(<BulkWorkerEntry draft={workersDraft} onChange={noop} evaluation={evaluation} joiningLabel="Joining date" submitButtonId="submit" />)
        expect(html).toContain('Piece rate workers')
        expect(html).toContain('Fixed rate staff')
        expect(html).toContain('data-bulk-grid="workers-piece"')
        expect(html).toContain('data-bulk-grid="workers-staff"')
        expect(html.indexOf('placeholder="e.g. Mahesh Patel"')).toBeLessThan(html.indexOf('placeholder="e.g. Supervisor"'))
        expect(html.indexOf('placeholder="e.g. Supervisor"')).toBeLessThan(html.indexOf('placeholder="18000"'))
        expect(html).toContain('value="Ramesh"')
        expect(html).toContain('value="Mahesh"')
        expect(html).toContain('Joining date')
        expect(html).toContain('value="2026-10-10"')
    })
    it('shows an error on the row that has one and none on the rest', () => {
        const evaluation = evaluateBulkWorkers(workersDraft.piece, workersDraft.staff, ['suresh'], workersDraft.joiningDate)
        const html = renderToStaticMarkup(<BulkWorkerEntry draft={workersDraft} onChange={noop} evaluation={evaluation} joiningLabel="Joining date" submitButtonId="submit" />)
        expect(html).toContain('Already on your list.')
        expect(html).toContain('Enter a name.')
        expect(html.match(/Already on your list\./g)).toHaveLength(1)
    })
    it('renders one grid per machine type section, with an add-type button and a repeat flagged across sections', () => {
        const draft = { sections: [{ id: 'a', machineType: 'power_loom' as const, rows: [{ id: 'm1', name: '01' }] }, { id: 'b', machineType: 'rapier' as const, rows: [{ id: 'm2', name: '01' }] }] }
        const evaluation = evaluateBulkMachines(draft.sections, [])
        const html = renderToStaticMarkup(<BulkMachineEntry draft={draft} onChange={noop} evaluation={evaluation} submitButtonId="submit" />)
        expect(html).toContain('data-bulk-grid="machines-0"')
        expect(html).toContain('data-bulk-grid="machines-1"')
        expect(html.match(/Machine type/g)?.length).toBeGreaterThanOrEqual(2)
        expect(html).toContain('Add another type')
        expect(html).toContain('Remove type')
        expect(html).toContain('Repeated in this list.')
    })
    it('offers no way to remove the only machine section', () => {
        const draft = { sections: [{ id: 'a', machineType: 'power_loom' as const, rows: [] }] }
        const html = renderToStaticMarkup(<BulkMachineEntry draft={draft} onChange={noop} evaluation={evaluateBulkMachines(draft.sections, [])} submitButtonId="submit" />)
        expect(html).not.toContain('Remove type')
    })
})
