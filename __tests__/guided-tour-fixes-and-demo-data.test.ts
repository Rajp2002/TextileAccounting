import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({ auth: { updateUser: vi.fn() } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))

import { DEMO_YARN_RATE, DEMO_YARN_STORAGE_KEY } from '../app/(dashboard)/owner/rates/RatesClient'
import { makeSavedCostingTourExamples } from '../lib/saved-costings-tour'

describe('Yarn Rate Book Tour Step 1 Alignment & Sample Data', () => {
    const tutorialPath = path.resolve(__dirname, '../components/rates/RateBookTutorial.tsx')
    const tutorialSource = fs.readFileSync(tutorialPath, 'utf8')
    const ratesClientPath = path.resolve(__dirname, '../app/(dashboard)/owner/rates/RatesClient.tsx')
    const ratesClientSource = fs.readFileSync(ratesClientPath, 'utf8')

    it('delegates measured scroll, spotlight, placement and focus to the shared runtime', () => {
        const runtime = fs.readFileSync(path.resolve(__dirname, '../components/rates/RateBookTourRuntime.tsx'), 'utf8')
        expect(runtime).toContain('<GuidedTour tourId="rate-book"')
        expect(tutorialSource).toContain("dynamic(() => import('./RateBookTourRuntime'), { ssr: false })")
        expect(tutorialSource).not.toMatch(/settleTimer|backupTimer|deltaY|prevSectionRef/)
    })

    it('preserves the completion-only sample deletion nudge callback', () => {
        expect(tutorialSource).toContain('onTourFinish?: () => void')
        expect(tutorialSource).toContain('onDone={onTourFinish}')
        expect(tutorialSource).not.toContain('onTourFinish?.()')
    })

    it('defines demo yarn rate with unreviewed warp status for full tour coverage', () => {
        expect(DEMO_YARN_STORAGE_KEY).toBe('weavly:demo-yarn-rate-deleted')
        expect(DEMO_YARN_RATE).toBeDefined()
        expect(DEMO_YARN_RATE.id).toBe('demo-sample-yarn-rate')
        expect(DEMO_YARN_RATE.category).toBe('yarn_warp')
        expect(DEMO_YARN_RATE.is_reviewed).toBe(false)
        expect(DEMO_YARN_RATE.current_value).toBe(285)
    })

    it('pre-populates demo yarn in RatesClient when rates are empty and not deleted in localStorage', () => {
        expect(ratesClientSource).toContain("localStorage.getItem(DEMO_YARN_STORAGE_KEY) === 'true'")
        expect(ratesClientSource).toContain('initialRates.length === 0')
        expect(ratesClientSource).toContain('return [DEMO_YARN_RATE]')
    })

    it('handles demo yarn operations safely in-memory without Supabase mutations', () => {
        expect(ratesClientSource).toContain('DEMO_YARN_RATE.id')
        expect(ratesClientSource).toContain('handleDeleteDemoYarn')
        expect(ratesClientSource).toContain('demoYarnDeleted')
    })

    it('renders dismissable delete nudge banner after tour finishes in RatesClient', () => {
        expect(ratesClientSource).toContain('showDeleteNudge')
        expect(ratesClientSource).toContain('handleDeleteDemoYarn')
        expect(ratesClientSource).toContain("tx('Delete sample yarn')")
        expect(ratesClientSource).toContain("tx('Dismiss')")
    })
})

describe('Saved Costings Dialog Centering & Sample Pre-population', () => {
    const globalsCssPath = path.resolve(__dirname, '../app/globals.css')
    const globalsCssSource = fs.readFileSync(globalsCssPath, 'utf8')
    const quotesClientPath = path.resolve(__dirname, '../app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const quotesClientSource = fs.readFileSync(quotesClientPath, 'utf8')

    it('removes broken left override from [data-costing-tour-dialog="true"] in globals.css', () => {
        // The broken rule that pushed modal into left navigation bar
        expect(globalsCssSource).not.toContain('left: calc((100vw - 300px) / 2) !important')
        expect(globalsCssSource).toContain('[data-costing-tour-dialog="true"]')
    })

    it('keeps the regular centring and lets the generic tour-surface rule make room for the card only when it must', () => {
        // The per-tour reading-column override is gone; tour-modal-placement-guard.test.ts evaluates the generic rule.
        expect(globalsCssSource).not.toContain('left: calc((100vw - 384px) / 2) !important')
        expect(globalsCssSource).toContain('[data-tour-surface="true"][data-slot="dialog-content"]')
        // The sidebar-aware centring applies from sm up; a phone's bottom sheet keeps `left: 0` from app/mobile.css.
        expect(quotesClientSource).toContain("'--costing-dialog-left': 'calc(50% + clamp(0px, calc((100vw - 1212px) / 2), calc(var(--shell-sidebar-w) / 2)))'")
        expect(quotesClientSource).toContain('sm:left-[var(--costing-dialog-left)]')
        expect(quotesClientSource).not.toContain("style={{ left: 'calc(50%")
    })

    it('pre-populates demo costing in QuotesClient when quotes and templates are empty', () => {
        expect(quotesClientSource).toContain("DEMO_COSTING_STORAGE_KEY = 'weavly:owner-demo-costing-deleted'")
        expect(quotesClientSource).toContain("localStorage.getItem(DEMO_COSTING_STORAGE_KEY) === 'true'")
        expect(quotesClientSource).toContain('isDemoCostingActive')
        expect(quotesClientSource).toContain('demoCostingDeleted')
    })

    it('displays delete nudge banner in QuotesClient when guided tour completes', () => {
        expect(quotesClientSource).toContain('showCostingDeleteNudge')
        expect(quotesClientSource).toContain('handleDeleteDemoCosting')
        expect(quotesClientSource).toContain("tx('Delete sample costing')")
        expect(quotesClientSource).toContain("tx('Guided tour completed!')")
        expect(quotesClientSource).toContain("tx('Dismiss')")
    })

    it('supports selecting and comparing tour sample costings in QuotesClient', () => {
        expect(quotesClientSource).toContain('quotes.find(quote => quote.id === id) ?? tourExamples.find(e => e.id === id)')
        const tourExamples = makeSavedCostingTourExamples()
        expect(tourExamples.length).toBe(2)
        expect(tourExamples[0].id).toBe('tour-preview-v2')
        expect(tourExamples[1].id).toBe('tour-preview-v1')
    })
})
