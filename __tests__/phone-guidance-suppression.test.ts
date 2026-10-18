import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Language } from '../lib/i18n/context'
import type { TourPresentation } from '../lib/tours/tour-types'
import { PHONE_VIEWPORT_QUERY } from '../lib/phone-viewport'

const state = vi.hoisted(() => ({ phone: false, language: 'en' as Language, presentation: 'invite' as TourPresentation, invitationHookCalls: 0 }))
vi.mock('@/lib/phone-viewport', async importOriginal => ({
    ...(await importOriginal<typeof import('@/lib/phone-viewport')>()),
    usePhoneViewport: () => state.phone,
}))
// These tests cover the Guide itself, which is switched off by default (see guide-availability.ts).
vi.mock('@/lib/guide-availability', () => ({ GUIDE_SUPPRESSED: false }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language }) }))
vi.mock('@/hooks/use-tour-invitation', () => ({
    useTourInvitation: () => {
        state.invitationHookCalls += 1
        return { presentation: state.presentation, isStarting: false, handleLaunch: vi.fn(), handleDismiss: vi.fn() }
    },
}))
import { TourInvitation } from '../components/tours/TourInvitation'

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
const render = () => renderToStaticMarkup(createElement(TourInvitation, { tourId: 'dispatch', userId: 'owner', align: 'full' }))

beforeEach(() => { state.phone = false; state.language = 'en'; state.presentation = 'invite'; state.invitationHookCalls = 0 })

describe('Phone guidance suppression', () => {
    describe('the phone viewport definition', () => {
        const css = read('app/mobile.css')

        it('is the same query app/mobile.css uses for the phone layout', () => {
            expect(css.split(`@media ${PHONE_VIEWPORT_QUERY} {`).length - 1).toBeGreaterThanOrEqual(2)
        })

        it('hides .phone-guidance from the first paint under exactly that query', () => {
            expect(css).toContain(`@media ${PHONE_VIEWPORT_QUERY} {\n  .phone-guidance { display: none !important; }\n}`)
        })

        it('renders as not-a-phone on the server, so the first render matches the desktop markup', async () => {
            const { usePhoneViewport } = await vi.importActual<typeof import('../lib/phone-viewport')>('../lib/phone-viewport')
            expect(renderToStaticMarkup(createElement(() => String(usePhoneViewport())))).toBe('false')
        })
    })

    describe('tour invitations', () => {
        it('renders nothing on a phone, for the invitation and the replay launcher', () => {
            state.phone = true
            for (const presentation of ['invite', 'replay'] as const) {
                state.presentation = presentation
                expect(render()).toBe('')
            }
        })

        it('never runs the invitation hook on a phone, so no impression is recorded for a card nobody saw', () => {
            state.phone = true
            render()
            expect(state.invitationHookCalls).toBe(0)
        })

        it.each(['invite', 'replay'] as const)('still renders the Guide for a %s on larger screens, hidden from first paint by .phone-guidance', presentation => {
            state.presentation = presentation
            const html = render()
            expect(html).toContain('phone-guidance')
            expect(html).toContain('data-tour-control="guide"')
            // A tour not yet taken or dismissed marks the Guide button as new.
            if (presentation === 'invite') expect(html).toContain('data-guide-new="true"')
            else expect(html).not.toContain('data-guide-new')
            expect(state.invitationHookCalls).toBeGreaterThan(0)
        })

        it('gates before the invitation hook, in the exported component', () => {
            const source = read('components/tours/TourInvitation.tsx')
            const wrapper = source.slice(source.indexOf('export function TourInvitation('), source.indexOf('function TourInvitationContent('))
            expect(wrapper).toContain('usePhoneViewport()')
            expect(wrapper).toContain('if (phone) return null')
            expect(wrapper).not.toContain('useTourInvitation')
        })
    })

    describe('the Guide is the only guidance surface', () => {
        // Tours and help (glossary, archive and restore, page help) all open from one Guide button in the page
        // header. Its trigger carries .phone-guidance, and both render paths gate on the phone before any hook.
        const guide = read('components/tours/TourInvitation.tsx')

        it('hides the Guide trigger from first paint on a phone', () => {
            const trigger = guide.slice(guide.indexOf('function GuideTrigger('), guide.indexOf('function GuideDialog('))
            expect(trigger).toContain("'phone-guidance relative h-10")
        })

        it('renders the help-only Guide as nothing on a phone', () => {
            const helpOnly = guide.slice(guide.indexOf('function HelpGuide('), guide.indexOf('function TourInvitationContent('))
            expect(helpOnly).toContain('usePhoneViewport()')
            expect(helpOnly).toContain('if (phone) return null')
        })

        // A route that grows a side rail or an inline help disclosure again fails here, so the replacement is
        // re-checked against the Guide and the phone rule instead of silently coming back.
        const routes = [
            'app/(dashboard)/owner/estimator/EstimatorClient.tsx',
            'app/(dashboard)/owner/quotes/QuotesClient.tsx',
            'app/(dashboard)/owner/rates/RatesClient.tsx',
            'app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx',
            'app/(dashboard)/owner/production/BaseProductionClient.tsx',
            'app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx',
            'app/(dashboard)/owner/production/registers/MachinesRegister.tsx',
            'app/(dashboard)/owner/production/registers/WorkersRegister.tsx',
            'app/(dashboard)/owner/stock/QualityStockClient.tsx',
            'app/(dashboard)/owner/dispatches/ChallansClient.tsx',
            'app/(dashboard)/owner/billing/page.tsx',
            'app/free/costings/SavedFreeCostings.tsx',
            'components/tours/ReplicaGuidedTour.tsx',
        ]
        it.each(routes)('%s has no guide rail', file => {
            expect(read(file)).not.toMatch(/<aside className="phone-guidance|-left-rail|reference-rail|rail-inline-actions|railSurface\)\}\s*>\s*<summary/)
        })

        // These routes' help used to expand in place in their rails; it now opens as a Guide topic.
        it.each([
            'app/(dashboard)/owner/production/registers/MachinesRegister.tsx',
            'app/(dashboard)/owner/production/registers/WorkersRegister.tsx',
            'app/(dashboard)/owner/billing/page.tsx',
            'components/billing/BillingDocumentNotice.tsx',
        ])('%s opens its help from the Guide instead of expanding it inline', file => {
            expect(read(file)).not.toMatch(/<details[\s>]/)
        })

        it('keeps Machines setup links in the page, since they are navigation rather than explainer pills', () => {
            const source = read('app/(dashboard)/owner/production/registers/MachinesRegister.tsx')
            const setup = source.slice(source.indexOf('aria-labelledby="machines-setup-heading"'))
            expect(setup).toContain('data-machines-tour="production-next"')
            expect(setup.slice(0, 200)).not.toContain('phone-guidance')
        })
    })
})
