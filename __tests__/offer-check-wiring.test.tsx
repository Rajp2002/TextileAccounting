import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { OfferCheckResult } from '@/components/estimator/OfferCheckResult'
import { I18nContext } from '@/lib/i18n/context'
import { offerCheckText } from '@/lib/i18n/offer-check'
import { buildOfferBase, evaluateOffer, listOfferCandidates, type OfferBase } from '@/lib/offer-check'
import { makeSavedCostingTourExamples } from '@/lib/saved-costings-tour'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock('@/app/(dashboard)/owner/quotes/offer/actions', () => ({ getOfferBase: async () => ({ error: 'unused' }) }))

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const [sampleV2] = makeSavedCostingTourExamples()
const built = buildOfferBase({
    id: sampleV2.id,
    quality_label: sampleV2.label,
    version_number: 2,
    created_at: sampleV2.created_at,
    snapshot_data: sampleV2.snapshot_data,
    costing_result_snapshot: sampleV2.costing_result_snapshot,
    reconciliation_status: 'verified',
    meters: 1000,
})
if (!built.ok) throw new Error('the sample costing must be usable')
const base: OfferBase = built.base

function provide(language: 'en' | 'hi' | 'gu', child: React.ReactElement) {
    const value = {
        language,
        setLanguage: async () => ({ ok: true as const, language }),
        languageStatus: 'ready' as const,
        pendingLanguage: null,
        languageError: null,
        t: (key: string) => key,
        tx: (text: string) => text,
    }
    return renderToStaticMarkup(createElement(I18nContext.Provider, { value }, child))
}

const renderResult = (offer: number, quantity: number | null, language: 'en' | 'hi' | 'gu' = 'en', source: OfferBase = base) =>
    provide(language, createElement(OfferCheckResult, { base: source, evaluation: evaluateOffer(source, offer, quantity), hasQuantity: quantity != null, copy: offerCheckText[language] }))

describe('offer check copy', () => {
    const keys = Object.keys(offerCheckText.en).sort()

    it('has every string in English, Hindi and Gujarati', () => {
        expect(Object.keys(offerCheckText.hi).sort()).toEqual(keys)
        expect(Object.keys(offerCheckText.gu).sort()).toEqual(keys)
    })

    it('writes Hindi and Gujarati in their own script and keeps every placeholder', () => {
        for (const [language, script] of [['hi', /\p{Script=Devanagari}/u], ['gu', /\p{Script=Gujarati}/u]] as const) {
            for (const key of keys as Array<keyof typeof offerCheckText.en>) {
                const english = offerCheckText.en[key]
                const translated = offerCheckText[language][key]
                expect(translated, `${language}.${key}`).toMatch(script)
                expect(translated.match(/\{\w+\}/g)?.sort() ?? [], `${language}.${key}`).toEqual(english.match(/\{\w+\}/g)?.sort() ?? [])
            }
        }
    })
})

describe('the answer to an offer', () => {
    it('says what you keep on a metre and where it comes from', () => {
        const html = renderResult(19, null)
        // 19.00 − 17.44 = 1.56 a metre, 8.2% of the offer; the sample has no transport or commission.
        expect(html).toContain('₹1.56')
        expect(html).toContain('8.2% of the offer')
        expect(html).toContain(offerCheckText.en.keep)
        expect(html).toContain('₹19.00')
        expect(html).toContain('₹17.44')
        expect(html).not.toContain(offerCheckText.en.lineTransport)
        expect(html).not.toContain('Commission')
    })

    it('puts the offer between break-even and the costing price, in words as well as on the track', () => {
        const html = renderResult(19, null)
        expect(html).toContain(offerCheckText.en.verdictBelow.replace('{amount}', '0.82'))
        expect(html).toContain('role="img"')
        expect(html).toContain('Offer ₹0.82 below')
        expect(html).toContain('(4.1%)')
        expect(html).toContain('Offer ₹1.56 above')
    })

    it('shows a loss as a loss', () => {
        const html = renderResult(16, 1000)
        expect(html).toContain(offerCheckText.en.lose)
        expect(html).toContain(offerCheckText.en.verdictLoss.replace('{amount}', '1.44'))
        expect(html).toContain('text-[var(--wv-madder-600)]')
        expect(html).toContain('Loss on 1,000 m')
        expect(html).toContain('₹1,440')
    })

    it('prices the whole order only once there is a quantity', () => {
        expect(renderResult(19, null)).toContain(offerCheckText.en.orderPrompt)
        const html = renderResult(19, 5000)
        expect(html).toContain('Profit on 5,000 m')
        expect(html).toContain('₹7,800')
        expect(html).toContain('₹95,000')
        expect(html).toContain('₹87,200')
        expect(html).not.toContain(offerCheckText.en.orderPrompt)
    })

    it('lists the commission and transport lines when the costing has them', () => {
        const withExtras: OfferBase = { ...base, transportPerM: 0.5, commissionPct: 2, breakEvenPricePerM: 18.3 }
        const html = renderResult(20, null, 'en', withExtras)
        expect(html).toContain('Transport')
        expect(html).toContain('Commission 2%')
        expect(html).toContain('₹0.40')
        expect(html).toContain('₹1.66')
    })

    it('shows the yarn and output cases, and explains a fixed factory rate', () => {
        const html = renderResult(19.82, 1000)
        expect(html).toContain(offerCheckText.en.whatIfTitle)
        expect(html).toContain(offerCheckText.en.caseYarn)
        expect(html).toContain(offerCheckText.en.caseOutput)
        expect(html).toContain('Cost ₹18.07/m')
        expect(html).toContain(offerCheckText.en.caseFixed.replace('{amount}', '3.00'))
    })

    it('explains why the what-ifs are missing when the costing cannot supply them', () => {
        const html = renderResult(19, null, 'en', { ...base, stress: { available: false } })
        expect(html).toContain(offerCheckText.en.whatIfUnavailable)
        expect(html).not.toContain(offerCheckText.en.caseYarn)
    })

    it('reads in Hindi and Gujarati', () => {
        expect(renderResult(19, 1000, 'hi')).toContain(offerCheckText.hi.orderTitle)
        expect(renderResult(19, 1000, 'gu')).toContain(offerCheckText.gu.orderTitle)
    })
})

describe('the check an offer page', () => {
    const candidates = listOfferCandidates([{
        id: 'a1',
        quality_label: 'Fabric 75D',
        template_id: null,
        version_number: 2,
        created_at: '2026-10-01T06:00:00.000Z',
        updated_at: '2026-10-01T06:00:00.000Z',
        record_kind: 'costing',
        quote_price_per_meter: 19.82,
        production_cost_per_meter: 17.44,
        reconciliation_status: 'verified',
    }], [])

    async function renderPage(props: { candidates?: typeof candidates; loadError?: boolean; initialKey?: string | null; initialBase?: typeof built | null }) {
        const { default: OfferCheckClient } = await import('@/app/(dashboard)/owner/quotes/offer/OfferCheckClient')
        return provide('en', createElement(OfferCheckClient, {
            candidates: props.candidates ?? candidates,
            loadError: props.loadError ?? false,
            initialKey: props.initialKey ?? null,
            initialBase: props.initialBase ?? null,
        }))
    }

    it('asks for a saved costing first, with the inputs waiting', async () => {
        const html = await renderPage({})
        expect(html).toContain(offerCheckText.en.title)
        expect(html).toContain('Fabric 75D · v2 · ₹19.82/m')
        expect(html).toContain(offerCheckText.en.qualityPlaceholder)
        expect(html).toContain('disabled=""')
        expect(html).not.toContain(offerCheckText.en.keep)
    })

    it('starts from the costing a card linked to and waits for the price', async () => {
        const html = await renderPage({ initialKey: candidates[0].key, initialBase: built })
        expect(html).toContain(offerCheckText.en.prompt.replace("'", '&#x27;'))
        expect(html).toContain('placeholder="19.82"')
        expect(html).toContain('type="range"')
        // The quantity the costing was made for is one tap away, never filled in unasked.
        expect(html).toContain('Use 1,000 m from the costing')
        expect(html).not.toContain('value="1000"')
        expect(html).toContain('₹17.44')
    })

    it('keeps the touch targets at 44px on phones', async () => {
        const html = await renderPage({ initialKey: candidates[0].key, initialBase: built })
        expect(html).toContain('max-md:min-h-[44px]')
    })

    it('points a library with no saved costing to Cost Estimate', async () => {
        const html = await renderPage({ candidates: [] })
        expect(html).toContain(offerCheckText.en.emptyTitle)
        expect(html).toContain('href="/owner/estimator"')
    })

    it('says so when the library could not be loaded', async () => {
        const html = await renderPage({ loadError: true, candidates: [] })
        expect(html).toContain(offerCheckText.en.listFailed)
        expect(html).not.toContain(offerCheckText.en.emptyTitle)
    })

    it('tells the owner to recalculate a costing that kept no cost', async () => {
        const [recalc] = listOfferCandidates([{
            id: 'o1', quality_label: 'Old quality', version_number: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
            quote_price_per_meter: 18, production_cost_per_meter: null, reconciliation_status: 'legacy', record_kind: 'costing',
        }], [])
        const html = await renderPage({ candidates: [recalc], initialKey: recalc.key })
        expect(html).toContain('Old quality · v1 · recalculate first')
        expect(html).toContain(offerCheckText.en.notChecked)
    })
})

describe('where the check lives', () => {
    it('sits under Saved Costings, behind the same plan gate and the Free redirect', () => {
        expect(fs.existsSync(path.join(root, 'app/(dashboard)/owner/quotes/offer/page.tsx'))).toBe(true)
        // The page inherits the quotes layout, which requires the saved_costings capability.
        expect(read('app/(dashboard)/owner/quotes/layout.tsx')).toContain('requiredCapability="saved_costings"')
        expect(fs.existsSync(path.join(root, 'app/(dashboard)/owner/quotes/offer/layout.tsx'))).toBe(false)
        expect(read('app/(dashboard)/owner/layout.tsx')).toContain("redirect('/free')")
    })

    it('reads a costing only through the owner-scoped detail read, and saves nothing', () => {
        const actions = read('app/(dashboard)/owner/quotes/offer/actions.ts')
        expect(actions).toContain('getEstimatorQuoteDetail')
        for (const file of ['app/(dashboard)/owner/quotes/offer/actions.ts', 'app/(dashboard)/owner/quotes/offer/page.tsx', 'app/(dashboard)/owner/quotes/offer/OfferCheckClient.tsx', 'lib/offer-check.ts']) {
            const source = read(file)
            expect(source, file).not.toMatch(/\.(insert|update|upsert|delete)\(/)
            expect(source, file).not.toContain('saveEstimatorQuoteV3')
            expect(source, file).not.toContain('createAdminClient')
        }
    })

    it('is reachable from the Saved Costings header and from each checkable card', () => {
        const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        expect(quotes).toContain('href="/owner/quotes/offer"')
        expect(quotes).toContain('href={`/owner/quotes/offer?costing=${latest.id}`}')
        // Not on the sample card, a costing without a saved cost, or an archived one.
        expect(quotes).toContain("latest && canReuseLatest && !costNotSaved && !tourStep && !isSampleRecordId(group.key) && getCostingStatus(latest) === 'verified'")
    })

    it('rebuilds a saved costing the same way for the page and the check', () => {
        expect(read('app/(dashboard)/owner/quotes/QuotesClient.tsx')).not.toContain('function buildDraftStateFromQuote')
        expect(read('lib/offer-check.ts')).toContain('buildDraftStateFromQuote')
        expect(read('lib/saved-costings.ts')).toContain('export function buildDraftStateFromQuote')
    })
})
