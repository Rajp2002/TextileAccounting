import { describe, expect, it } from 'vitest'
import {
    challanDraftProgress,
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
