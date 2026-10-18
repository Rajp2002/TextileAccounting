import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const invitationHookCalls = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/lib/phone-viewport', () => ({ usePhoneViewport: () => false }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en' }) }))
vi.mock('@/hooks/use-tour-invitation', () => ({
    useTourInvitation: () => {
        invitationHookCalls.count += 1
        return { presentation: 'invite', isStarting: false, handleLaunch: vi.fn(), handleDismiss: vi.fn() }
    },
}))
import { GUIDE_SUPPRESSED } from '../lib/tours/guide-availability'
import { PageGuide, PageTourProvider, TourInvitation } from '../components/tours/TourInvitation'

const topics = [{ id: 'help', icon: () => null, title: 'Page help', content: 'Help body' }]

describe('Guide suppression', () => {
    it('is switched on', () => {
        expect(GUIDE_SUPPRESSED).toBe(true)
    })

    it('renders no Guide pill from a tour invitation, and records no impression', () => {
        const html = renderToStaticMarkup(createElement(TourInvitation, { tourId: 'dispatch', userId: 'owner', topics }))
        expect(html).toBe('')
        expect(invitationHookCalls.count).toBe(0)
    })

    it('renders no Guide pill from a page header, with or without a tour or topics', () => {
        expect(renderToStaticMarkup(createElement(PageGuide, { topics }))).toBe('')
        expect(renderToStaticMarkup(createElement(PageGuide))).toBe('')
        const tour = { tourId: 'dispatch' as const, userId: 'owner', orgId: 'org' }
        expect(renderToStaticMarkup(createElement(PageTourProvider, { value: tour }, createElement(PageGuide, { topics })))).toBe('')
        expect(renderToStaticMarkup(createElement(PageTourProvider, { value: { tourId: 'dispatch' as const, sample: true } }, createElement(PageGuide)))).toBe('')
        expect(invitationHookCalls.count).toBe(0)
    })

    it('has one switch, read by both entry points', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../components/tours/TourInvitation.tsx'), 'utf8')
        expect(source.match(/GUIDE_SUPPRESSED/g)?.length).toBe(3) // import + PageGuide + TourInvitation
    })
})
