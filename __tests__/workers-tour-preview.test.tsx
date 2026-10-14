import React from 'react'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { makeWorkersTourExamples, workersTourEditor, workersTourPaths, workersTourSelectors, type WorkersTourStep, type WorkersTourPath } from '../lib/workers-tour'

import { TourPanel } from '../components/tours/TourPanel'
import type { TourStepSpec } from '../lib/tours/tour-types'

type RuntimeProps = {
    step: WorkersTourStep; steps: readonly TourStepSpec<WorkersTourStep>[]
    copy: (step: WorkersTourStep) => { title: string; body: string }
    extra: React.ReactNode; onStepChange: (step: WorkersTourStep | null) => void
}
const fixture = vi.hoisted(() => ({
    language: 'en' as 'en' | 'gu' | 'hi', inject: false, hookIndex: 0,
    step: null as WorkersTourStep | null, path: 'piece' as WorkersTourPath,
    runtime: null as RuntimeProps | null, launch: null as (() => void) | null,
    query: '', action: vi.fn(),
}))
vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof import('react')>()
    return { ...actual, useState: (initial: unknown) => {
        const slot = fixture.inject ? fixture.hookIndex++ : -1
        const state = actual.useState(initial)
        if (slot === 0) return [fixture.step, (step: WorkersTourStep | null) => { fixture.step = step }]
        if (slot === 1) return [fixture.path, (path: WorkersTourPath) => { fixture.path = path }]
        return state
    } }
})
vi.mock('next/dynamic', () => ({ default: () => (props: RuntimeProps) => {
    fixture.runtime = props
    const index = props.steps.findIndex(step => step.id === props.step)
    return <TourPanel tourId="workers" stepId={props.step} {...props.copy(props.step)}
        index={index} total={props.steps.length} sample={props.steps[index].kind === 'sample'}
        status="ready" isLast={index === props.steps.length - 1} extra={props.extra}
        panelRef={{ current: null }} language={fixture.language}
        onExit={() => props.onStepChange(null)} onBack={() => {}} onNext={() => {}} />
} }))
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: ({ onLaunch }: { onLaunch: () => void }) => {
    fixture.launch = onLaunch
    return <button data-tour-control="take-tour" onClick={onLaunch}>Start guide</button>
} }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/owner/workers', useSearchParams: () => new URLSearchParams(fixture.query) }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: fixture.language, tx: (text: string) => text, t: (key: string) => ({ en, gu, hi }[fixture.language].workers[key.split('.')[1] as keyof typeof en.workers] as string) }) }))
vi.mock('@/components/settings/plan-aware/unsaved-changes-dialog', () => ({ useUnloadProtection: vi.fn() }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ createBaseProductionWorker: fixture.action, updateBaseProductionWorker: fixture.action }))
vi.mock('@/lib/plan-analytics', () => ({ trackPlanEvent: vi.fn() }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogFooter: Container, DialogHeader: Container, DialogTitle: Container }
})
import WorkerEditor from '../app/(dashboard)/owner/production/registers/WorkerEditor'
import WorkersRegister from '../app/(dashboard)/owner/production/registers/WorkersRegister'

beforeEach(() => { fixture.language = 'en'; fixture.inject = false; fixture.hookIndex = 0; fixture.query = ''; fixture.action.mockClear(); fixture.launch = null; fixture.runtime = null })
afterEach(() => vi.unstubAllGlobals())

describe('Workers tour uses the real editor with disabled preview fields', () => {
    const [piece, salary] = makeWorkersTourExamples()
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


describe('Workers GuidedTour integration without browser execution', () => {
    function renderRegister(step: WorkersTourStep | null, path: WorkersTourPath, language: 'en' | 'gu' | 'hi' = 'en') {
        fixture.inject = true; fixture.hookIndex = 0; fixture.step = step; fixture.path = path; fixture.language = language
        return renderToStaticMarkup(<WorkersRegister today="2026-09-28" workers={[
            { ...makeWorkersTourExamples()[0], id: 'real-worker', name: 'Retained worker', shift_availability: 'night' },
        ]} />)
    }
    it.each(['en', 'gu', 'hi'] as const)('%s: both six-step paths mount real targets and the panel choice', language => {
        for (const path of ['piece', 'salary'] as const) for (const step of workersTourPaths[path]) {
            const html = renderRegister(step, path, language)
            expect(html).toContain(`data-tour-step="${step}"`)
            expect(fixture.runtime?.steps).toHaveLength(6)
            if (step === 'wk-paytype') {
                const panel = html.slice(html.indexOf('data-testid="guided-tour-panel"'))
                expect(panel).toContain(`data-tour-control="path-${path}" aria-pressed="true"`)
                expect(panel).toContain(`data-tour-control="path-${path === 'piece' ? 'salary' : 'piece'}" aria-pressed="false"`)
                expect(html).toContain('data-workers-tour-field="payType"')
            } else expect(html).not.toContain('data-tour-control="path-piece"')
            if (step === 'wk-handoff') {
                expect(html).toContain('Retained worker')
                expect(html).not.toContain('data-tour-sample-banner')
                expect(html).not.toContain('data-workers-tour="groups"')
                expect(html).not.toContain('<fieldset disabled')
                expect(html.match(/<button[^>]*data-tour-anchor="workers.add"/g)).toHaveLength(1)
            } else {
                expect(html).not.toContain('Retained worker')
                expect(html).toContain('data-tour-sample-banner')
            }
        }
        expect(fixture.action).not.toHaveBeenCalled()
    })
    it('launching after either an exit or completion always resets the selected path to piece', () => {
        vi.stubGlobal('document', { activeElement: null })
        vi.stubGlobal('HTMLElement', class {})
        vi.stubGlobal('window', { scrollX: 0, scrollY: 360 })
        for (const previous of [null, 'wk-handoff'] as const) {
            renderRegister(previous, 'salary')
            fixture.launch!()
            expect(fixture.path).toBe('piece')
            expect(fixture.step).toBe('wk-paytype')
        }
    })
    it('shadows search/shift/status and restores their rendered values already at handoff', () => {
        fixture.query = 'search=Retained&shift=night&status=all&returnTo=/owner/assignments'
        const during = renderRegister('wkp-earnings', 'piece')
        expect(during).not.toContain('value="Retained"')
        const handoff = renderRegister('wk-handoff', 'piece')
        expect(handoff).toContain('value="Retained"')
        expect(handoff).toContain('<option value="night" selected=""')
        expect(handoff).toContain('<option value="all" selected=""')
        expect(handoff).toContain('Retained worker')
        expect(handoff).toContain('Back to Machine Assignments')
        expect(fixture.query).toBe('search=Retained&shift=night&status=all&returnTo=/owner/assignments')
        expect(fixture.action).not.toHaveBeenCalled()
    })
    it('keeps the Guide in the page header when the live add editor opens over the page', () => {
        // The editor is a modal sheet, so the header Guide sits behind it instead of being hidden like the old rail.
        fixture.query = 'add=worker'
        const html = renderRegister(null, 'piece')
        expect(html).toContain('data-tour-control="take-tour"')
        expect(html.indexOf('data-tour-control="take-tour"')).toBeLessThan(html.indexOf('</header>'))
    })
    it.each(['en', 'gu', 'hi'] as const)('%s: preview labels use the same keys as the live editor', language => {
        fixture.language = language
        const [piece, salary] = makeWorkersTourExamples(language)
        const t = { en, gu, hi }[language].workers
        const pieceHtml = renderToStaticMarkup(<WorkerEditor today="2026-09-28" tourPreview={{ worker: piece, editing: false }}>{() => null}</WorkerEditor>)
        const salaryHtml = renderToStaticMarkup(<WorkerEditor today="2026-09-28" tourPreview={{ worker: salary, editing: true }}>{() => null}</WorkerEditor>)
        expect(pieceHtml).toContain(t.shiftAvailability)
        for (const label of [t.joiningDate, t.salaryEffectiveFrom, t.lastWorkingDay]) expect(salaryHtml).toContain(label)
        expect(salaryHtml).toContain('id="base-staff-start"')
        expect(salaryHtml).not.toMatch(/<input[^>]*id="base-staff-start"[^>]*disabled=""/)
        expect(salaryHtml).toMatch(/<input[^>]*id="base-staff-effective"[^>]*min="2026-09-28"/)
    })
})
