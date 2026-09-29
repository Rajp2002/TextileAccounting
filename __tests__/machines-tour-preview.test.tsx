import React from 'react'
import { readFileSync } from 'node:fs'
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
        for (const field of ['details', 'name', 'type', 'label']) expect(html).toContain(`data-machines-tour-field="${field}"`)
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
    it('uses the shared runtime and scopes the hidden close control to the sample portal', () => {
        const wrapper = readFileSync('components/machines/MachinesGuidedTour.tsx', 'utf8')
        expect(wrapper).toContain("import('@/components/tours/GuidedTour')")
        expect(wrapper).toContain('<GuidedTour tourId="machines" steps={machinesTourSpecs}')
        expect(wrapper).toContain('[data-machines-tour-preview="true"] > [data-slot="dialog-close"], [data-machines-tour-preview="true"] [data-slot="dialog-footer"] button[type="button"] { display: none; }')
        expect(wrapper).toContain('machinesStepCopy(language, id, controls)')
        expect(wrapper).not.toMatch(/useGuidedTourPlacement|useMobileTour|persistTourCompleted/)
    })
    it('preserves the writable real add form', () => {
        const html = renderToStaticMarkup(<MachineEditor today="2026-09-16" initialOpen>{() => null}</MachineEditor>)
        expect(html).not.toContain('<fieldset disabled')
        expect(html).toContain('autofocus')
    })
})
