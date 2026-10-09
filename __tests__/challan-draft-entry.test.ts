import { describe, expect, it } from 'vitest'
import {
    challanDraftProgress,
    challanPrintReadiness,
    isSameChallanDraft,
    prepareChallanDraft,
} from '../lib/challan-draft-entry'
import { ChallanDraftSchema, type ChallanDraft } from '../lib/delivery-challans'
const draft: ChallanDraft = {
    quality_id: '10000000-0000-4000-8000-000000000001',
    selling_rate: 40,
    document: {
        date: '2026-09-09',
        sender_name: 'Mill',
        sender_address: 'Surat',
        customer_name: 'Customer',
        customer_address: 'Ahmedabad',
        delivery_address: 'Warehouse',
    },
    lines: [{ lot: '', meters: 0 }],
}
describe('keyboard challan entry totals and saving', () => {
    it('counts two measured lots rather than five displayed entry rows', () => {
        const value = {
            ...draft,
            lines: [
                { lot: '101', meters: 225 },
                { lot: '102', meters: 275 },
                ...Array.from({ length: 3 }, () => ({ lot: '', meters: 0 })),
            ],
        }
        expect(challanDraftProgress(value)).toMatchObject({
            count: 2,
            meters: 500,
            value: 20000,
            incomplete: 0,
        })
        expect(
            ChallanDraftSchema.safeParse(prepareChallanDraft(value)).success,
        ).toBe(true)
        expect(prepareChallanDraft(value).lines).toHaveLength(2)
        expect(value.lines).toHaveLength(5)
    })
    it('keeps partial rows for validation rather than silently discarding them', () => {
        const value = {
            ...draft,
            lines: [
                { lot: '101', meters: 100 },
                { lot: '102', meters: 0 },
                { lot: '', meters: 25 },
                { lot: '', meters: 0 },
            ],
        }
        expect(challanDraftProgress(value)).toMatchObject({
            count: 1,
            meters: 100,
            incomplete: 2,
        })
        expect(prepareChallanDraft(value).lines).toHaveLength(3)
        expect(
            ChallanDraftSchema.safeParse(prepareChallanDraft(value)).success,
        ).toBe(false)
    })
    it('updates totals after edits/removals, preserves identifier zeros and exact decimal sums', () => {
        const value = {
            ...draft,
            lines: [
                { lot: '001', meters: 0.1 },
                { lot: '002', meters: 0.2 },
            ],
        }
        expect(challanDraftProgress(value)).toMatchObject({
            count: 2,
            meters: 0.3,
            value: 12,
        })
        expect(
            challanDraftProgress({ ...value, lines: value.lines.slice(1) }),
        ).toMatchObject({ count: 1, meters: 0.2, value: 8 })
        expect(prepareChallanDraft(value).lines[0].lot).toBe('001')
    })
    it('excludes invalid quantities and does not treat an empty document as saveable', () => {
        expect(challanDraftProgress(draft)).toMatchObject({
            count: 0,
            meters: 0,
        })
        expect(
            ChallanDraftSchema.safeParse(prepareChallanDraft(draft)).success,
        ).toBe(false)
        for (const meters of [-1, Infinity, NaN, 0.001])
            expect(
                challanDraftProgress({
                    ...draft,
                    lines: [{ lot: 'x', meters }],
                }),
            ).toMatchObject({ count: 0, meters: 0, incomplete: 1 })
    })
})

const complete: ChallanDraft = {
    ...draft,
    lines: [
        { lot: '101', meters: 225 },
        { lot: '102', meters: 275 },
        { lot: '', meters: 0 },
    ],
}
const withDocument = (patch: Record<string, string>): ChallanDraft => ({
    ...complete,
    document: { ...complete.document, ...patch },
})

describe('print readiness', () => {
    it('is ready once every required field and one complete lot are present, ignoring the blank entry row', () => {
        expect(challanPrintReadiness(complete)).toEqual({
            ready: true,
            missing: [],
        })
    })

    it('names everything a blank draft still needs, in form order', () => {
        const blank: ChallanDraft = {
            quality_id: '',
            selling_rate: 0,
            document: { date: '' },
            lines: [{ lot: '', meters: 0 }],
        }
        expect(challanPrintReadiness(blank)).toEqual({
            ready: false,
            missing: [
                'quality',
                'sellingRate',
                'date',
                'sender_name',
                'sender_address',
                'customer_name',
                'customer_address',
                'delivery_address',
                'lotEntry',
            ],
        })
    })

    it.each([
        'sender_name',
        'sender_address',
        'customer_name',
        'customer_address',
        'delivery_address',
        'date',
    ])('is not ready without %s, including when it is only spaces', (key) => {
        for (const value of ['', '   '])
            expect(challanPrintReadiness(withDocument({ [key]: value }))).toEqual({
                ready: false,
                missing: [key],
            })
    })

    it('needs a quality and a positive selling rate', () => {
        expect(
            challanPrintReadiness({ ...complete, quality_id: '' }).missing,
        ).toEqual(['quality'])
        for (const selling_rate of [0, -5, NaN])
            expect(
                challanPrintReadiness({ ...complete, selling_rate }).missing,
            ).toEqual(['sellingRate'])
    })

    it('flags unfinished and duplicate lot rows rather than printing around them', () => {
        for (const lines of [
            [{ lot: '101', meters: 0 }],
            [{ lot: '', meters: 40 }],
            [
                { lot: '101', meters: 50 },
                { lot: '102', meters: 0 },
            ],
            [
                { lot: '101', meters: 50 },
                { lot: '101', meters: 60 },
            ],
            [{ lot: '101', meters: 10.123 }],
        ])
            expect(challanPrintReadiness({ ...complete, lines })).toEqual({
                ready: false,
                missing: ['lotEntry'],
            })
    })

    it('keeps GST, transport and other optional details optional, but rejects bad values in them', () => {
        expect(
            challanPrintReadiness(
                withDocument({ payment_due_date: '', external_attachment: '' }),
            ).ready,
        ).toBe(true)
        expect(
            challanPrintReadiness(withDocument({ payment_due_date: '2026-02-30' })),
        ).toEqual({ ready: false, missing: ['payment_due_date'] })
        expect(
            challanPrintReadiness(
                withDocument({ external_attachment: 'http://example.com/a.pdf' }),
            ),
        ).toEqual({ ready: false, missing: ['external_attachment'] })
        expect(
            challanPrintReadiness(
                withDocument({
                    payment_due_date: '2026-10-31',
                    external_attachment: 'https://example.com/a.pdf',
                }),
            ).ready,
        ).toBe(true)
    })

    it('attributes limits the form does not enforce to the field that breaks them', () => {
        const missing = (value: ChallanDraft) =>
            challanPrintReadiness(value).missing
        expect(missing({ ...complete, quality_id: 'not-a-uuid' })).toEqual(['quality'])
        expect(missing({ ...complete, selling_rate: 100_000_001 })).toEqual(['sellingRate'])
        expect(missing({ ...complete, selling_rate: 12.345 })).toEqual(['sellingRate'])
        expect(missing(withDocument({ notes: 'n'.repeat(1001) }))).toEqual(['notes'])
        expect(
            missing({ ...complete, lines: [{ lot: 'x'.repeat(81), meters: 5 }] }),
        ).toEqual(['lotEntry'])
        expect(
            missing({
                ...complete,
                lines: [
                    { lot: 'a', meters: 60_000_000 },
                    { lot: 'b', meters: 60_000_000 },
                ],
            }),
        ).toEqual(['lotEntry'])
        expect(
            missing({
                ...complete,
                lines: Array.from({ length: 501 }, (_, i) => ({ lot: `${i}`, meters: 1 })),
            }),
        ).toEqual(['lotEntry'])
    })

    it('can never say ready when saving would be refused, and always says what is missing otherwise', () => {
        const drafts: ChallanDraft[] = [
            complete,
            { ...complete, quality_id: 'not-a-uuid' },
            withDocument({ date: '2026-13-45' }),
            withDocument({ date: '09/10/2026' }),
            { ...complete, lines: [{ lot: 'x', meters: 100_000_001 }] },
            { ...complete, lines: [{ lot: 'x'.repeat(81), meters: 5 }] },
            { ...complete, selling_rate: 100_000_001 },
            { ...complete, selling_rate: 12.345 },
            draft,
        ]
        for (const value of drafts) {
            const readiness = challanPrintReadiness(value)
            expect(readiness.ready).toBe(
                ChallanDraftSchema.safeParse(prepareChallanDraft(value)).success,
            )
            if (!readiness.ready) expect(readiness.missing.length).toBeGreaterThan(0)
        }
    })
})

describe('recognising an unchanged saved draft', () => {
    it('treats key order and a missing key versus an empty one as the same document', () => {
        const saved = { ...complete, document: { delivery_address: 'W', date: '2026-09-09' } }
        const edited = {
            ...complete,
            document: { date: '2026-09-09', delivery_address: 'W', notes: '' },
        }
        expect(isSameChallanDraft(saved, edited)).toBe(true)
    })

    it('spots any real edit to the fabric, rate, document or lots', () => {
        expect(isSameChallanDraft(complete, { ...complete })).toBe(true)
        expect(isSameChallanDraft(complete, { ...complete, selling_rate: 41 })).toBe(false)
        expect(isSameChallanDraft(complete, { ...complete, quality_id: 'other' })).toBe(false)
        expect(isSameChallanDraft(complete, withDocument({ notes: 'fragile' }))).toBe(false)
        expect(isSameChallanDraft(complete, withDocument({ customer_name: 'Other' }))).toBe(false)
        expect(
            isSameChallanDraft(complete, {
                ...complete,
                lines: [{ lot: '101', meters: 226 }, ...complete.lines.slice(1)],
            }),
        ).toBe(false)
        expect(
            isSameChallanDraft(complete, { ...complete, lines: complete.lines.slice(1) }),
        ).toBe(false)
    })

    it('ignores the untouched blank entry row, as saving does', () => {
        expect(
            isSameChallanDraft(prepareChallanDraft(complete), complete),
        ).toBe(true)
    })
})
