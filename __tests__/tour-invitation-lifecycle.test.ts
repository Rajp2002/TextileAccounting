import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createElement, Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Language } from '../lib/i18n/context'
import type { TourPresentation } from '../lib/tours/tour-types'
import { tourCommonCopy } from '../lib/i18n/tour-common'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

const state = vi.hoisted(() => ({ language: 'en' as Language, presentation: 'invite' as TourPresentation, open: false }))
// These tests cover the Guide itself, which is switched off by default (see guide-availability.ts).
vi.mock('@/lib/tours/guide-availability', () => ({ GUIDE_SUPPRESSED: false }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language }) }))
vi.mock('@/hooks/use-tour-invitation', () => ({ useTourInvitation: () => ({ presentation: state.presentation, isStarting: false, handleLaunch: vi.fn(), handleDismiss: vi.fn() }) }))
// The Guide's modal renders its content only when `state.open`, so the closed header button and the
// open modal can both be read as static markup.
vi.mock('@/components/ui/dialog', () => {
    type Props = Record<string, unknown> & { children?: ReactNode }
    // Drop the Radix-only handler so the rest of the props land on plain elements.
    const element = (name: string, { children, ...props }: Props) => {
        delete props.onCloseAutoFocus
        return createElement(name, props, children)
    }
    function Pass({ children }: Props) { return createElement(Fragment, null, children) }
    function DialogContent(props: Props) { return state.open ? element('div', props) : null }
    function DialogHeader(props: Props) { return element('div', props) }
    function DialogTitle(props: Props) { return element('h2', props) }
    function DialogDescription(props: Props) { return element('p', props) }
    return { Dialog: Pass, DialogTrigger: Pass, DialogContent, DialogHeader, DialogTitle, DialogDescription }
})
import { TourInvitation } from '../components/tours/TourInvitation'

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
const component = read('components/tours/TourInvitation.tsx')
const hook = read('hooks/use-tour-invitation.ts')
const render = (open = false) => {
    state.open = open
    return renderToStaticMarkup(createElement(TourInvitation, {
        tourId: 'dispatch', userId: 'owner',
        topics: [{ id: 'help', icon: () => null, title: 'Dispatch help', content: 'Help body' }],
    }))
}

beforeEach(() => { state.language = 'en'; state.presentation = 'invite'; state.open = false })

describe('Tour invitation lifecycle', () => {
    it.each(['en', 'gu', 'hi'] as const)('renders one Guide button in the page header in %s, marked new while the tour is undecided', language => {
        state.language = language
        const copy = tourCommonCopy[language]
        const invite = render()
        expect(invite).toContain('data-tour-control="guide"')
        expect(invite).toContain(`>${copy.guide}<`)
        expect(invite).toContain(`aria-label="${copy.guideOpen} · ${copy.guideNew}"`)
        expect(invite).toContain('data-guide-new="true"')
        // The tour card itself lives in the modal, not the header.
        expect(invite).not.toContain('data-tour-control="take-tour"')
        state.presentation = 'replay'
        const replay = render()
        expect(replay).toContain(`aria-label="${copy.guideOpen}"`)
        expect(replay).not.toContain('data-guide-new')
    })

    it.each(['en', 'gu', 'hi'] as const)('opens a modal with the guide card, both decisions and the page help in %s', language => {
        state.language = language
        const html = render(true)
        const copy = tourCommonCopy[language]
        const name = tourInvitationCopy[language].tourNames.dispatch
        expect(html).toContain(copy.guideTitle.replace('{name}', name))
        expect(html).toContain(copy.guideIntro)
        expect(html).toContain(tourInvitationCopy[language].benefits.dispatch)
        expect(html).toContain(copy.startGuide)
        expect(html).toContain(copy.notNow)
        expect(html).toContain('data-tour-control="take-tour"')
        expect(html).toContain('data-tour-control="dismiss"')
        expect(html).toContain('data-variant="ghost"')
        expect(html).toContain(`aria-label="${copy.launcherAria.replace('{name}', name)}"`)
        expect(html).toContain('min-h-[44px]')
        expect(html).toContain('min-w-[44px]')
        // Help is a list of topics; a topic opens as its own view in the same modal, never expanding in place.
        expect(html).toContain(copy.pageHelp)
        expect(html).toContain('data-guide-topic-trigger="help"')
        expect(html).not.toContain('Help body')
    })

    it.each(['en', 'gu', 'hi'] as const)('offers only a replay, with no Not now, once the tour is decided in %s', language => {
        state.language = language; state.presentation = 'replay'
        const html = render(true)
        expect(html).toContain(tourCommonCopy[language].guideTitle.replace('{name}', tourInvitationCopy[language].tourNames.dispatch))
        expect(html).toContain('data-tour-control="quiet-tour"')
        expect(html).not.toContain('data-tour-control="dismiss"')
        expect(html).not.toContain('data-tour-invitation="true"')
    })

    it('removes attention animation and its coordinator completely', () => {
        for (const source of [component, hook, read('app/globals.css')]) expect(source).not.toMatch(/tour-halo-|isHaloActive|session-coordinator/)
        expect(fs.existsSync(path.resolve(__dirname, '../lib/tours/session-coordinator.ts'))).toBe(false)
        expect(component).not.toContain('guideCard')
    })

    it('keeps impressions separate from decisions and records them only once', () => {
        expect(hook).toContain("presentation !== 'invite'")
        expect(hook).toContain('impressions.current.has(identity)')
        expect(hook).toContain('!account?.firstShown && !local?.firstShown')
        expect(hook).toContain('void persistTourImpression(tourId, userId)')
        expect(hook).toContain('getTourPresentation(tourId, userMetadata, userId, orgId)')
    })

    it('coalesces launch clicks, starts the tour only after the modal hands focus back, and keeps focus after Not now', () => {
        expect(hook).toContain('if (launching.current) return')
        expect(hook).toContain('launching.current = true')
        expect(hook).toContain('launching.current = false')
        // Start closes the modal first; the tour starts from the Guide button so its focus return lands there.
        expect(component).toContain('const launch = (run: () => void | Promise<void>) => { pending.current = run; setOpen(false) }')
        expect(component).toContain('trigger.current?.focus({ preventScroll: true })\n                void run()')
        expect(component).toContain('tour.onDismiss(); startRef.current?.focus({ preventScroll: true })')
    })

    it('gives the undecided tour the prominent guide styling and keeps the start action ink', () => {
        const rail = read('components/ui/rail.ts')
        expect(component).toContain("tour.invite ? railGuideSurface : railSurface")
        expect(component).toContain('railGuideIcon')
        expect(component).not.toContain('amber')
        for (const token of ['border-saffron/40', 'bg-saffron-soft', 'bg-saffron-deep']) expect(rail).toContain(token)
        // The one decision on the invitation is an ink primary action, never saffron.
        expect(component).toContain('railPrimaryAction')
    })
})
