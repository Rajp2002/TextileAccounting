import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Language } from '../lib/i18n/context'
import type { TourPresentation } from '../lib/tours/tour-types'
import { tourCommonCopy } from '../lib/i18n/tour-common'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

const state = vi.hoisted(() => ({ language: 'en' as Language, presentation: 'invite' as TourPresentation }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language }) }))
vi.mock('@/hooks/use-tour-invitation', () => ({ useTourInvitation: () => ({ presentation: state.presentation, isStarting: false, handleLaunch: vi.fn(), handleDismiss: vi.fn() }) }))
import { TourInvitation } from '../components/tours/TourInvitation'

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
const component = read('components/tours/TourInvitation.tsx')
const hook = read('hooks/use-tour-invitation.ts')
const render = () => renderToStaticMarkup(createElement(TourInvitation, { tourId: 'dispatch', userId: 'owner', align: 'full' }))

beforeEach(() => { state.language = 'en'; state.presentation = 'invite' })

describe('Tour invitation lifecycle', () => {
    it.each(['en', 'gu', 'hi'] as const)('renders the guide card and both decisions in %s', language => {
        state.language = language
        const html = render()
        const copy = tourCommonCopy[language]
        const name = tourInvitationCopy[language].tourNames.dispatch
        expect(html).toContain(copy.guideTitle.replace('{name}', name))
        expect(html).toContain(tourInvitationCopy[language].benefits.dispatch)
        expect(html).toContain(copy.startGuide)
        expect(html).toContain(copy.notNow)
        expect(html).toContain('data-tour-control="take-tour"')
        expect(html).toContain('data-tour-control="dismiss"')
        expect(html).toContain('data-variant="ghost"')
        expect(html).toContain('aria-describedby=')
        expect(html).toContain(`aria-label="${copy.launcherAria.replace('{name}', name)}"`)
        expect(html).toContain('min-h-[44px]')
        expect(html).toContain('min-w-[44px]')
    })

    it.each(['en', 'gu', 'hi'] as const)('renders only a compact replay launcher in %s', language => {
        state.language = language; state.presentation = 'replay'
        const html = render()
        expect(html).toContain(tourCommonCopy[language].guideTitle.replace('{name}', tourInvitationCopy[language].tourNames.dispatch))
        expect(html).toContain('data-tour-control="quiet-tour"')
        expect(html).not.toContain('<section')
        expect(html).not.toContain('data-tour-control="dismiss"')
        expect(html).not.toContain(tourInvitationCopy[language].benefits.dispatch)
        expect(html).toContain('min-h-11')
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

    it('coalesces launch clicks synchronously and preserves focus after Not now', () => {
        expect(hook).toContain('if (launching.current) return')
        expect(hook).toContain('launching.current = true')
        expect(hook).toContain('launching.current = false')
        expect(component).toContain("presentation === 'replay' && focusAfterDismiss.current")
        expect(component).toContain('launcherRef.current?.focus({ preventScroll: true })')
    })

    it('uses the shared quiet rail styling for every launcher presentation', () => {
        const rail = read('components/ui/rail.ts')
        expect(component).toContain('railSurface')
        expect(component).toContain('railButton')
        expect(component).not.toContain('amber')
        for (const token of ['border-hairline', 'hover:bg-surface-soft', 'shadow-xs']) expect(rail).toContain(token)
    })
})
