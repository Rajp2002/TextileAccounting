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

        it.each(['invite', 'replay'] as const)('still renders the %s on larger screens, hidden from first paint by .phone-guidance', presentation => {
            state.presentation = presentation
            const html = render()
            expect(html).toContain('phone-guidance')
            expect(html).toMatch(presentation === 'invite' ? /data-tour-control="take-tour"/ : /data-tour-control="quiet-tour"/)
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

    describe('explainer pills and guide rails', () => {
        // Each render site carries .phone-guidance. A site that is renamed or reworded fails here on purpose,
        // so the replacement is re-checked against the phone rule instead of silently coming back.
        const sites: [file: string, snippet: string][] = [
            ['components/ui/rail-dialog.tsx', "className={cn('phone-guidance estimator-touch-target', railButton)}"],
            ['components/records/ArchivePolicyNotice.tsx', "className={cn('phone-guidance estimator-touch-target', railButton)}"],
            ['components/estimator/BasePlanFactoryGlossary.tsx', "className={cn('phone-guidance estimator-touch-target', railButton)}"],
            ['components/tours/ReplicaGuidedTour.tsx', '<aside className={`phone-guidance ${railClassName} guided-tour-left-rail space-y-2`}'],
            ['app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx', '<aside className="phone-guidance configuration-guide-rail"'],
            ['app/(dashboard)/owner/production/registers/MachinesRegister.tsx', '<aside className="phone-guidance machines-left-rail guided-tour-left-rail space-y-3"'],
            ['app/(dashboard)/owner/production/registers/MachinesRegister.tsx', "className={cn('phone-guidance ui-details group overflow-hidden', railSurface)}"],
            ['app/(dashboard)/owner/production/registers/WorkersRegister.tsx', '<aside className="phone-guidance workers-left-rail guided-tour-left-rail space-y-3"'],
            ['app/(dashboard)/owner/production/registers/WorkersRegister.tsx', '<aside className="phone-guidance workers-reference-rail"'],
            ['app/(dashboard)/owner/rates/RatesClient.tsx', 'className={cn("phone-guidance rates-left-rail-desktop space-y-3", isLite && mobileStyles.help)}'],
            ['app/(dashboard)/owner/rates/RatesClient.tsx', 'className={cn(mobileStyles.mobileOnly, "phone-guidance")} aria-controls="lite-ratebook-help"'],
            ['app/(dashboard)/owner/rates/RatesClient.tsx', '<div className="phone-guidance rail-inline-actions">\n                <ArchivePolicyNotice />'],
            ['app/(dashboard)/owner/quotes/QuotesClient.tsx', 'className={cn("phone-guidance saved-costings-left-rail space-y-3", isLite && mobileStyles.help)}'],
            ['app/(dashboard)/owner/quotes/QuotesClient.tsx', 'className={cn(mobileStyles.mobileOnly, "phone-guidance")} aria-controls="lite-costings-help"'],
            ['app/(dashboard)/owner/quotes/QuotesClient.tsx', '<div className="phone-guidance rail-inline-actions">\n                <ArchivePolicyNotice />'],
            ['app/(dashboard)/owner/estimator/EstimatorClient.tsx', "className={`phone-guidance ${freeMode ? 'free-mobile-help-trigger' : 'lite-mobile-help-trigger'}`}"],
            ['app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'className="phone-guidance estimator-left-rail space-y-3"'],
            ['app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'className="phone-guidance estimator-reference-rail space-y-3"'],
            ['app/free/costings/SavedFreeCostings.tsx', '<aside className="phone-guidance saved-costings-left-rail" id="free-history-help"'],
            ['app/free/costings/SavedFreeCostings.tsx', '<Button id="free-history-help-trigger" variant="ghost" className="phone-guidance free-mobile-help-trigger"'],
        ]

        it.each(sites)('%s hides %s', (file, snippet) => {
            expect(read(file)).toContain(snippet)
        })

        it('keeps Machines setup links, which are navigation rather than explainer pills', () => {
            const source = read('app/(dashboard)/owner/production/registers/MachinesRegister.tsx')
            expect(source).not.toContain('phone-guidance machines-reference-rail')
            expect(source).toContain('<aside className="machines-reference-rail"')
        })

        it('hides the Workers reference rail whole only because its add action is desktop-only', () => {
            // On a phone the rail's one non-help child, `.workers-reference-action`, is already display: none and
            // the same add button lives in `WorkersPageHeader`, so nothing the phone needs goes with the rail.
            expect(read('app/globals.css')).toMatch(/\.workers-reference-action,[\s\S]*?\{\s*display: none;/)
            expect(read('app/(dashboard)/owner/production/registers/WorkersRegister.tsx')).toContain('<WorkersPageHeader')
        })
    })
})
