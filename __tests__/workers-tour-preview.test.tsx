import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { makeWorkersTourExamples, workersTourEditor, workersTourPaths, workersTourSelectors } from '../lib/workers-tour'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/owner/workers', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ tx: (text: string) => text }) }))
vi.mock('@/components/settings/plan-aware/unsaved-changes-dialog', () => ({ useUnloadProtection: vi.fn() }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ createBaseProductionWorker: vi.fn(), updateBaseProductionWorker: vi.fn() }))
vi.mock('@/lib/plan-analytics', () => ({ trackPlanEvent: vi.fn() }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogFooter: Container, DialogHeader: Container, DialogTitle: Container }
})
import WorkerEditor from '../app/(dashboard)/owner/production/registers/WorkerEditor'

describe('Workers tour uses the real editor with disabled preview fields', () => {
    const [piece, salary] = makeWorkersTourExamples('2026-09-16')
    function render(worker = piece, editing = false) {
        return renderToStaticMarkup(<WorkerEditor today="2026-09-16" tourPreview={{ worker, editing }}>{() => null}</WorkerEditor>)
    }
    it('shows piece-rate availability without salary fields', () => {
        const html = render()
        expect(html).toContain('<fieldset disabled=""')
        expect(html).toContain('data-workers-tour-field="availability"')
        expect(html).not.toContain('data-workers-tour-field="salary"')
        expect(html).not.toContain('autofocus')
    })
    it('shows salary add fields and keeps edit-only fields out of the add flow', () => {
        const html = render(salary)
        for (const field of ['name', 'payType', 'role', 'salary', 'joining']) expect(html).toContain(`data-workers-tour-field="${field}"`)
        for (const field of ['effective', 'lastDay', 'active', 'availability']) expect(html).not.toContain(`data-workers-tour-field="${field}"`)
        expect(html).toContain('value="18000"')
    })
    it('shows the salary and exit controls in the existing-worker preview', () => {
        const html = render(salary, true)
        for (const field of ['effective', 'lastDay', 'active']) expect(html).toContain(`data-workers-tour-field="${field}"`)
        expect(html).toContain('Edit worker')
        expect(html).toContain('<fieldset disabled=""')
    })
    it('mounts every form target in each selected path inside a disabled sample editor', () => {
        for (const path of ['piece', 'salary'] as const) {
            for (const step of workersTourPaths[path]) {
                const preview = workersTourEditor(step, path)
                if (!preview) continue
                const html = render(preview === 'piece' ? piece : salary, preview === 'edit')
                const selector = workersTourSelectors[step].slice(1, -1)
                expect(html).toContain(selector)
                expect(html).toContain('<fieldset disabled=""')
                expect(html).not.toContain('autofocus')
            }
        }
    })
    it('keeps the normal editor writable' , () => {
        const html = renderToStaticMarkup(<WorkerEditor today="2026-09-16" initialOpen>{() => null}</WorkerEditor>)
        expect(html).not.toContain('<fieldset disabled')
        expect(html).toContain('autofocus')
    })
})
