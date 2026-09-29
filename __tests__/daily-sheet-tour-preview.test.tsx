import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dailySheetTourSteps, dailySheetTourSelector } from '../lib/daily-sheet-tour'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { tourCommonCopy } from '../lib/i18n/tour-common'
import type { BaseProductionInitialData } from '../app/(dashboard)/owner/production/loaders'

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi', shell: {} as Record<string, unknown> }))
const dictionaries = { en, gu, hi }
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language, tx: (text: string) => text, t: (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionaries[state.language]) }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ saveBaseDailyProductionBatch: vi.fn() }))
vi.mock('@/components/tours/ReplicaGuidedTour', () => ({ default: (props: { children: React.ReactNode; walkthrough: React.ReactNode }) => { state.shell = props; return <><aside data-test-controls>{props.walkthrough}</aside><div data-test-live>{props.children}</div></> } }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    const Dialog = ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null
    const Content = ({ children, ...props }: { children: React.ReactNode; 'data-daily-tour-preview'?: string }) => <div data-daily-tour-preview={props['data-daily-tour-preview']}>{children}</div>
    return { Dialog, DialogContent: Content, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container, DialogFooter: Container }
})
import DailySheetTourPreview from '../components/production/DailySheetTourPreview'
import DailySheetGuidedTour from '../components/production/DailySheetGuidedTour'
import BaseDailyProductionSheet from '../app/(dashboard)/owner/production/BaseDailyProductionSheet'

function fixture(populated: boolean): BaseProductionInitialData {
    return {
        orgId: 'o1', actorId: 'u1', today: '2026-09-27', payrollPeriod: { start: '2026-09-01', end: '2026-09-30' },
        costings: [], entries: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [],
        jobs: populated ? [{ id: 'fixture-quality', quality_label: 'Fixture fabric', status: 'active', start_date: '2026-09-01', worker_rate_per_meter: 2 }] : [],
        machines: populated ? [{ id: 'fixture-loom', name: 'Loom 1', machine_type: 'power_loom', is_active: true }] : [],
        workers: populated ? [{ id: 'fixture-worker', name: 'Worker 1', is_active: true, pay_type: 'per_meter', shift_availability: 'both' }] : [],
        assignments: populated ? [{ id: 'fixture-assignment', machine_id: 'fixture-loom', worker_id: 'fixture-worker', shift: 'day', active: true, effective_from: '2026-09-01', effective_to: null }] : [],
        machineJobContexts: populated ? [{ id: 'fixture-context', machine_id: 'fixture-loom', job_id: 'fixture-quality', active: true, effective_from: '2026-09-01', effective_to: null }] : [],
    } as unknown as BaseProductionInitialData
}

describe('Daily Sheet sample and live integration', () => {
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of dailySheetTourSteps) it(`${language} ${step}: target, sample boundary and disabled controls`, () => {
        state.language = language
        const html = renderToStaticMarkup(<DailySheetTourPreview step={step} />)
        if (step === 'ds-handoff') { expect(html).toBe(''); return }
        expect(html.split(dailySheetTourSelector(step).slice(1, -1))).toHaveLength(2)
        expect(html).toContain(tourCommonCopy[language].sampleBanner)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|textarea|select)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
        expect(html).not.toMatch(/Save machine production|Print collection sheet|Worker payroll roll-up|Edit production log/)
        const labels = dictionaries[language].dailySheet
        if (!['ds-earnings', 'ds-correct'].includes(step)) {
            for (const key of ['machineSheet', 'metres', 'notRunning', 'showPending', 'draftOnDevice', 'discardDraft', 'saveShift', 'workerReview', 'printSheet', 'shiftDetails'] as const) expect(html).toContain(labels[key])
            expect(html).toContain('16 Sept 2026')
            expect(html).toMatch(/data-daily-tour="pending"[\s\S]*value=""[\s\S]*value="0"/)
            expect(html).toContain('value="120"')
        } else {
            expect(html).toContain('data-daily-tour-preview="true"')
            if (step === 'ds-earnings') expect(html).toContain('120 m × ₹2/m = ₹240')
        }
    })
    it.each([false, true])('live sheet: populated=%s gets the matching handoff and preserved controls', populated => {
        state.language = 'en'
        const html = renderToStaticMarkup(<BaseDailyProductionSheet initialData={fixture(populated)} onAddWorker={() => {}} onAddMachine={() => {}} onOpenHistory={() => {}} />)
        expect(state.shell.tourId).toBe('daily-sheet')
        const specs = state.shell.steps as { anchor: string }[]
        expect(specs.at(-1)?.anchor).toBe(dailySheetTourSelector('ds-handoff', !populated))
        expect(html).toContain(`data-tour-anchor="daily.${populated ? 'first-reading' : 'empty-action'}"`)
        expect(html).toContain('Shift details')
        expect(html).toContain('Print sheet')
        expect(html).toContain('type="date"')
        expect(html).toContain('max="2026-09-27"')
        if (populated) expect(html.match(/data-tour-anchor="daily.first-reading"/g)).toHaveLength(1)
    })
    it('skips an unassigned first loom when choosing the first enabled reading', () => {
        const data = fixture(true)
        data.machines.unshift({ ...data.machines[0], id: 'unassigned', name: 'Loom 0' })
        const html = renderToStaticMarkup(<BaseDailyProductionSheet initialData={data} onAddWorker={() => {}} onAddMachine={() => {}} onOpenHistory={() => {}} />)
        const reading = html.match(/<input[^>]*data-tour-anchor="daily.first-reading"[^>]*>/)?.[0]
        expect(reading).toContain('Loom 1')
        expect(reading).not.toMatch(/\sdisabled(?:=|\s|>)/)
    })
    it('keeps a paid reading disabled so the shared runtime returns Done to the launcher', () => {
        const data = fixture(true)
        data.settlements = [{ worker_id: 'fixture-worker', status: 'paid', period_end: '2026-09-30' }] as unknown as BaseProductionInitialData['settlements']
        const html = renderToStaticMarkup(<BaseDailyProductionSheet initialData={data} onAddWorker={() => {}} onAddMachine={() => {}} onOpenHistory={() => {}} />)
        const reading = html.match(/<input[^>]*data-tour-anchor="daily.first-reading"[^>]*>/)?.[0]
        expect(reading).toContain('disabled=""')
        const runtime = readFileSync('components/tours/GuidedTour.tsx', 'utf8')
        expect(runtime).toContain("!target.matches(':disabled, [aria-disabled=\"true\"]')")
        expect(runtime).toContain("fallback?.querySelector<HTMLElement>('[data-tour-control=\"take-tour\"], [data-tour-control=\"quiet-tour\"]')")
    })
    it('passes unchanged child/control nodes to the shared wrapper and hides the launcher while a live dialog is open', () => {
        const child = <input defaultValue="retained draft" />
        const controls = <button type="button">Retained controls</button>
        renderToStaticMarkup(<DailySheetGuidedTour userId="u1" orgId="o1" empty={false} controls={controls} dialogOpen>{child}</DailySheetGuidedTour>)
        expect(state.shell.children).toBe(child)
        expect(state.shell.railClassName).toContain('[&>div:first-child]:hidden')
        expect(state.shell.railClassName).toContain('order-last')
        expect(state.shell.userId).toBe('u1')
        expect(state.shell.orgId).toBe('o1')
    })
    it('has no business, draft, printing or navigation handlers and reuses reserved dialog placement', () => {
        const source = readFileSync('components/production/DailySheetTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|window\.(open|print)|onSubmit=|onClick=/)
        expect(source).toContain('open modal={false}')
        expect(source).toContain('showCloseButton={false}')
        expect(source).toContain('onOpenAutoFocus={event => event.preventDefault()}')
        expect(source).toContain('onCloseAutoFocus={event => event.preventDefault()}')
        expect(source).toContain('data-production-tour-preview="true"')
    })
})
