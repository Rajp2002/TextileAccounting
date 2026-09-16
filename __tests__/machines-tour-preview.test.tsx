import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { makeMachinesTourExamples } from '../lib/machines-tour'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/owner/machines', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ tx: (text: string) => text }) }))
vi.mock('@/components/settings/plan-aware/unsaved-changes-dialog', () => ({ useUnloadProtection: vi.fn() }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ createBaseProductionMachine: vi.fn(), updateBaseProductionMachine: vi.fn() }))
vi.mock('@/lib/plan-analytics', () => ({ trackPlanEvent: vi.fn() }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogFooter: Container, DialogHeader: Container, DialogTitle: Container }
})
import MachineEditor from '../app/(dashboard)/owner/production/registers/MachineEditor'

describe('Machines tour editor preview', () => {
    const machine = makeMachinesTourExamples()[0]
    function render(editing = false) {
        return renderToStaticMarkup(<MachineEditor today="2026-09-16" tourPreview={{ machine, editing }}>{() => null}</MachineEditor>)
    }
    it('shows a disabled add form with all machine fields and no availability control', () => {
        const html = render()
        expect(html).toContain('<fieldset disabled=""')
        for (const field of ['name', 'type', 'label']) expect(html).toContain(`data-machines-tour-field="${field}"`)
        expect(html).not.toContain('data-machines-tour-field="availability"')
        expect(html).not.toContain('autofocus')
        expect(html).toContain('Sample Rapier')
    })
    it('includes availability only when editing and keeps the preview read-only', () => {
        const html = render(true)
        expect(html).toContain('data-machines-tour-field="availability"')
        expect(html).toContain('Edit machine')
        expect(html).toContain('<fieldset disabled=""')
    })
    it('preserves the writable real add form', () => {
        const html = renderToStaticMarkup(<MachineEditor today="2026-09-16" initialOpen>{() => null}</MachineEditor>)
        expect(html).not.toContain('<fieldset disabled')
        expect(html).toContain('autofocus')
    })
})
