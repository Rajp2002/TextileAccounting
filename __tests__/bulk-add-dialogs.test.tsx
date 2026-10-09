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
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogFooter: Container, DialogHeader: Container, DialogTitle: Container }
})
import WorkerEditor from '../app/(dashboard)/owner/production/registers/WorkerEditor'
import MachineEditor from '../app/(dashboard)/owner/production/registers/MachineEditor'

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
