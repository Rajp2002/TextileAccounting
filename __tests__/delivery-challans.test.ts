import { describe, it, expect } from 'vitest'
import {
    ChallanDraftSchema,
    challanTotals,
    paymentStatus,
    safeEvidenceUrl,
} from '../lib/delivery-challans'
describe('standalone challan contract', () => {
    it('sums the agreed example with decimal precision', () => {
        expect(
            challanTotals(
                [75, 70, 85, 92, 88, 77, 98].map((meters) => ({ meters })),
                40,
            ),
        ).toEqual({ count: 7, meters: 585, value: 23400 })
        expect(challanTotals([{ meters: 0.1 }, { meters: 0.2 }], 40)).toEqual({
            count: 2,
            meters: 0.3,
            value: 12,
        })
    })
    it('keeps credit distinct from payment settlement', () => {
        expect(
            paymentStatus({
                balance: -80,
                paid_amount: 23400,
                delivery_status: 'received',
            }),
        ).toBe('credit')
        expect(
            paymentStatus({
                balance: 80,
                paid_amount: 23320,
                delivery_status: 'received',
            }),
        ).toBe('partial')
    })
    it('rejects active-content and credential-bearing evidence URLs', () => {
        expect(safeEvidenceUrl('javascript:alert(1)')).toBeNull()
        expect(safeEvidenceUrl('https://user:pass@example.com')).toBeNull()
        expect(safeEvidenceUrl('https://example.com/receipt.pdf')).toBe(
            'https://example.com/receipt.pdf',
        )
    })
    it('requires independent customer, quality, selling rate and positive unique document lines', () => {
        const draft = {
            quality_id: '10000000-0000-4000-8000-000000000001',
            selling_rate: 40,
            document: {
                date: '2026-09-09',
                sender_name: 'Sender',
                sender_address: 'Surat',
                customer_name: 'Customer',
                customer_address: 'Ahmedabad',
                delivery_address: 'Warehouse',
            },
            lines: [{ lot: '89895', meters: 75 }],
        }
        expect(ChallanDraftSchema.safeParse(draft).success).toBe(true)
        for (const bad of [
            { ...draft, selling_rate: 0 },
            { ...draft, lines: [...draft.lines, ...draft.lines] },
            { ...draft, lines: [{ lot: 'x', meters: 0.001 }] },
            { ...draft, document: { ...draft.document, customer_name: '' } },
        ])
            expect(ChallanDraftSchema.safeParse(bad).success).toBe(false)
    })
})
