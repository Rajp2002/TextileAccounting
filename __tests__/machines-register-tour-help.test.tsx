import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { machinesTutorialCopy } from '../lib/i18n/machines-tutorial'
import type { Language } from '../lib/i18n/context'

const state = vi.hoisted(() => ({ language: 'en' as Language }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('search=existing&status=needs_setup') }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language, tx: (text: string) => text }) }))
vi.mock('@/components/navigation/navigation-link', () => ({ NavigationLink: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }))
// The Guide renders its topics as they would appear in its modal, so help stays provably reachable.
vi.mock('@/components/tours/TourInvitation', () => ({
    TourInvitation: ({ topics = [] }: { topics?: { id: string; title: string; content?: React.ReactNode }[] }) => <div data-guide="true"><button>Take a tour</button>{topics.map(topic => <section key={topic.id} data-guide-topic={topic.id}>{topic.title}{topic.content}</section>)}</div>,
}))
vi.mock('@/components/machines/MachinesGuidedTour', () => ({ default: () => <div data-testid="machines-tutorial" /> }))
vi.mock('@/app/(dashboard)/owner/production/registers/MachineEditor', () => ({
    default: ({ children }: { children: (actions: { add: () => void; edit: () => void; isOpen: boolean }) => React.ReactNode }) => children({ add: () => {}, edit: () => {}, isOpen: false }),
}))
import MachinesRegister from '../app/(dashboard)/owner/production/registers/MachinesRegister'

describe('Machines contextual help', () => {
    it.each(['en', 'gu', 'hi'] as const)('keeps setup links and secondary guidance discoverable in %s with an empty register', language => {
        state.language = language
        const copy = machinesTutorialCopy[language]
        const html = renderToStaticMarkup(<MachinesRegister today="2026-09-16" machines={[]} />)
        expect(html).toContain('href="/owner/production?tab=jobs"')
        expect(html).toContain('href="/owner/assignments"')
        expect(html).toContain('data-machines-tour="production-next"')
        expect(html).toContain('data-machines-tour="assignments-next"')
        expect(html).toContain(copy.helpTitle)
        // Help opens from the header Guide as a topic, not as an inline disclosure.
        expect(html).toContain('data-guide-topic="machines-help"')
        expect(html).not.toContain('<details')
        for (const [title] of copy.help) expect(html).toContain(title)
        expect(html).toContain('value="existing"')
        expect(html).not.toContain('data-testid="machines-tutorial"')
        expect(html).not.toContain('tour-machines-ready')
    })
    it('keeps sample navigation inert and leaves live filter state intact through the tour', () => {
        const source = readFileSync('app/(dashboard)/owner/production/registers/MachinesRegister.tsx', 'utf8')
        expect(source).toContain('useState<MachinesTourStep | null>(null)')
        expect(source).toContain("setTourStep('mc-purpose')")
        expect(source).toContain("search={tourSampleActive ? '' : search}")
        expect(source).toContain("statusFilter={tourSampleActive ? 'all' : statusFilter}")
        expect(source).toContain("href={tourStep ? '#' : '/owner/production?tab=jobs'}")
        expect(source).toContain("href={tourStep ? '#' : '/owner/assignments'}")
        expect(source).toContain('onStepChange={setTourStep}')
        expect(source).toContain("const tourSampleActive = tourStep !== null && tourStep !== 'mc-handoff'")
        expect(source).toContain('inert={tourStep !== null}')
        expect(source).toContain('onEdit={tourStep ? () => {} : edit}')
        expect(source).toContain('returnFocus={tourReturnFocus}')
        expect(source).toContain("window.scrollTo({ left: launchScroll.current.x, top: launchScroll.current.y, behavior: 'instant' })")
        expect(source).not.toMatch(/setSearch\(''\)|setStatusFilter\('all'\)/)
    })
})
