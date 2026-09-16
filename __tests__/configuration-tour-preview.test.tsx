import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configurationTourSelectors, configurationTourSteps, type ConfigurationTourStep } from '../lib/configuration-tour'
import { configurationTutorialCopy } from '../lib/i18n/configuration-tutorial'
import { readBaseProductionNavigation } from '../lib/base-production-navigation'
import type { Language } from '../lib/i18n/context'
import type { BaseProductionInitialData } from '../app/(dashboard)/owner/production/loaders'

const state = vi.hoisted(() => ({ step: null as ConfigurationTourStep | null, language: 'en' as Language, inject: true }))
vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof import('react')>()
    return {
        ...actual,
        useState: (initial: unknown) => {
            // The workspace's first hook is tourStep. Retain real hooks for all live state.
            if (state.inject) { state.inject = false; return actual.useState(state.step) }
            return actual.useState(initial)
        },
    }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language, tx: (text: string) => text }) }))
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: () => <button>Take a tour</button> }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ removeBaseWorkerMachineAssignment: vi.fn(), upsertBaseWorkerMachineAssignment: vi.fn() }))
vi.mock('@/components/ui/sheet', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return {
        Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
        SheetContent: Container, SheetDescription: Container, SheetFooter: Container, SheetHeader: Container, SheetTitle: Container,
    }
})
import BaseAssignmentWorkspace from '../app/(dashboard)/owner/production/BaseAssignmentWorkspace'

const liveData: BaseProductionInitialData = {
    orgId: 'test-org', actorId: 'test-owner', today: '2026-09-17', payrollPeriod: { start: '2026-09-01', end: '2026-09-30' },
    costings: [], jobs: [], entries: [], assignments: [], machineJobContexts: [], dailyBatches: [], batchRevisions: [], advances: [], settlements: [], settlementLines: [], payrollPeriods: [], payables: [], allocations: [],
    workers: [{ id: 'live-worker', name: 'Real worker', pay_type: 'piece_rate', rate_per_meter: 0, shift_availability: 'night', is_active: true }],
    machines: [{ id: 'live-machine', name: 'Real machine', machine_type: 'power_loom', custom_label: null, is_active: true }],
}

function render(step: ConfigurationTourStep | null, language: Language) {
    state.step = step
    state.language = language
    state.inject = true
    return renderToStaticMarkup(<BaseAssignmentWorkspace initialData={liveData} initialShift="night" />)
}

describe('Assignment preview rendering', () => {
    beforeEach(() => { vi.clearAllMocks() })

    for (const language of ['en', 'gu', 'hi'] as const) {
        for (const step of configurationTourSteps) {
            it(`${language}: ${step} renders its actual target and isolated samples`, () => {
                const html = render(step, language)
                const targetAttribute = configurationTourSelectors[step].slice(1, -1)
                expect(html).toContain(targetAttribute)
                expect(html).toContain('class="configuration-workspace" inert=""')
                expect(html).toContain(configurationTutorialCopy[language].worker)
                expect(html).not.toContain('Real worker')
                expect(html).not.toContain('Real machine')
                if (step === 'picker') {
                    const option = html.match(/<button[^>]*data-configuration-picker-state="available"[^>]*>/)?.[0]
                    expect(option).toContain('disabled=""')
                }
                if (step === 'connected') {
                    expect(html).toContain(configurationTutorialCopy[language].savedLabel)
                    expect(html).toContain(configurationTutorialCopy[language].undoLabel)
                }
            })
        }
    }

    it('renders a live night-shift handoff and contextual help when the tour is closed', () => {
        const html = render(null, 'en')
        expect(html).not.toContain('class="configuration-workspace" inert=""')
        expect(html).toContain('Real worker')
        expect(html).toContain('Real machine')
        expect(html).not.toContain('Sample worker')
        const link = html.match(/<a[^>]*data-configuration-tour="daily-sheet"[^>]*href="([^"]+)"/)?.[1]
        expect(link).toBeTruthy()
        const navigation = readBaseProductionNavigation(new URL(link!.replaceAll('&amp;', '&'), 'https://example.test').searchParams)
        expect(navigation).toMatchObject({ tab: 'production', shift: 'night', returnTo: '/owner/assignments?shift=night' })
        for (const topic of Object.values(configurationTutorialCopy.en.help)) expect(html).toContain(topic[0])
    })
})
