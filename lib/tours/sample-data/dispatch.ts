import type { Language } from '@/lib/i18n/context'
import type { Challan, ChallanDraft } from '@/lib/delivery-challans'
import type { StockQuality } from '@/lib/quality-stock'
import type { DispatchTourStep } from '@/lib/dispatch-tour'

/**
 * Sample data for the Dispatch tour: the real ChallansClient renders these exactly as it renders a real account's
 * dispatches. One dispatch per teaching state, so each step can open the real dialog or detail it is about.
 * Every id starts with `tour-` (see sample-ids.ts) so none can be mistaken for, or written as, a real record.
 */
const NAMES: Record<Language, { quality: string; customer: string; sender: string }> = {
    en: { quality: 'Sample fabric', customer: 'Sample customer', sender: 'Sample factory' },
    gu: { quality: 'નમૂના કાપડ', customer: 'નમૂના ગ્રાહક', sender: 'નમૂના ફેક્ટરી' },
    hi: { quality: 'नमूना कपड़ा', customer: 'नमूना ग्राहक', sender: 'नमूना कारखाना' },
}

const DATE = '2026-09-16'
const RATE = 40 // ₹ per metre
const QUALITY_ID = 'tour-quality-1'

/** The figures the tour copy quotes: 100 m sent, 98 m accepted, ₹40/m. */
export const DISPATCH_SAMPLE = { sent: 100, received: 98, rate: RATE, payment: 2000 } as const

export const DISPATCH_SAMPLE_IDS = { draft: 'tour-challan-draft', sent: 'tour-challan-sent', review: 'tour-challan-review', accepted: 'tour-challan-accepted' } as const

/** The dispatch each step shows in the real detail view, or null when the step shows the list or the editor. */
export function dispatchSampleSelectedId(step: DispatchTourStep): string | null {
    if (step === 'confirm') return DISPATCH_SAMPLE_IDS.draft
    if (step === 'receipt') return DISPATCH_SAMPLE_IDS.sent
    if (step === 'difference') return DISPATCH_SAMPLE_IDS.review
    if (step === 'payment') return DISPATCH_SAMPLE_IDS.accepted
    return null
}

export function dispatchSampleQualities(language: Language): StockQuality[] {
    return [{ id: QUALITY_ID, quality_label: NAMES[language].quality, quality_key: 'sample fabric', meters: 600, production_meters: 600, opening_recorded: true } as StockQuality]
}

export function dispatchSampleDraft(language: Language): ChallanDraft {
    const { customer, sender } = NAMES[language]
    return {
        quality_id: QUALITY_ID, selling_rate: RATE,
        document: { date: DATE, sender_name: sender, sender_address: 'Surat', customer_name: customer, customer_address: 'Surat', delivery_address: 'Surat' },
        lines: [{ lot: 'SAMPLE-1', meters: 60 }, { lot: 'SAMPLE-2', meters: 40 }],
    }
}

export function dispatchSampleChallans(language: Language): Challan[] {
    const { quality } = NAMES[language]
    const base = dispatchSampleDraft(language)
    const challan = (id: string, number: string, over: Partial<Challan>): Challan => ({
        ...base, id, number, quality_label: quality, sent_meters: 100, chargeable_meters: 100, acknowledged_meters: null,
        delivery_status: 'sent', difference_status: 'none', adjustment_amount: 0, paid_amount: 0, balance: 100 * RATE, version: 1,
        archived_at: null, issued_at: DATE, created_at: DATE, payment_due_date: null, payment_terms: '', ...over,
    })
    return [
        challan(DISPATCH_SAMPLE_IDS.accepted, 'SAMPLE-4', { delivery_status: 'received', difference_status: 'accepted', acknowledged_meters: 98, chargeable_meters: 98, balance: 98 * RATE }),
        challan(DISPATCH_SAMPLE_IDS.review, 'SAMPLE-3', { delivery_status: 'received', difference_status: 'review', acknowledged_meters: 98, chargeable_meters: 100 }),
        challan(DISPATCH_SAMPLE_IDS.sent, 'SAMPLE-2', {}),
        challan(DISPATCH_SAMPLE_IDS.draft, 'SAMPLE-1', { delivery_status: 'draft', issued_at: null }),
    ]
}

/** What the dispatch operation dialogs (confirm, receipt, payment) show in their fields. */
export function dispatchSampleFields(step: DispatchTourStep): Record<string, string> | null {
    if (step === 'receipt') return { meters: String(DISPATCH_SAMPLE.received) }
    if (step === 'payment') return { amount: String(DISPATCH_SAMPLE.payment), date: DATE, method: 'bank' }
    if (step === 'confirm') return {}
    return null
}
