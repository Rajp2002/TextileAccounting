import { describe, expect, it } from 'vitest'
import {
    businessDate,
    challanDueStatus,
    validPaymentDueDate,
} from '../lib/challan-payment-terms'
import { PaymentTermsSchema } from '../lib/delivery-challans'
describe('challan payment terms', () => {
    const sent = {
        delivery_status: 'sent',
        balance: 500,
        payment_due_date: '2026-11-30',
    }
    it('accepts custom dates and validates calendar dates', () => {
        expect(validPaymentDueDate('2028-02-29')).toBe(true)
        for (const value of [
            '2026-02-29',
            '2026-02-30',
            '0000-01-01',
            '2026-1-1',
            'tomorrow',
        ])
            expect(validPaymentDueDate(value)).toBe(false)
        expect(
            PaymentTermsSchema.safeParse({
                payment_due_date: '2027-12-31',
                reason: 'New agreement',
            }).success,
        ).toBe(true)
        expect(
            PaymentTermsSchema.safeParse({
                payment_due_date: '',
                reason: 'Clear agreement',
            }).success,
        ).toBe(true)
        expect(
            PaymentTermsSchema.safeParse({ payment_due_date: '' }).success,
        ).toBe(false)
    })
    it('uses the business date across IST midnight', () => {
        expect(businessDate(new Date('2026-09-09T18:29:59Z'))).toBe(
            '2026-09-09',
        )
        expect(businessDate(new Date('2026-09-09T18:30:00Z'))).toBe(
            '2026-09-10',
        )
    })
    it('shows no overdue state without an agreed date', () => {
        expect(
            challanDueStatus({ ...sent, payment_due_date: null }, '2026-12-01'),
        ).toEqual({ kind: 'dueDateNotSet', days: 0 })
        expect(challanDueStatus(sent, '2026-11-28')).toEqual({
            kind: 'dueInDays',
            days: 2,
        })
        expect(challanDueStatus(sent, '2026-11-30')).toEqual({
            kind: 'dueToday',
            days: 0,
        })
        expect(
            challanDueStatus({ ...sent, balance: 100 }, '2026-12-02'),
        ).toEqual({ kind: 'overdueDays', days: 2 })
    })
    it('does not label settled, credit, draft or reversed dispatches overdue', () => {
        for (const change of [
            { balance: 0 },
            { balance: -5 },
            { delivery_status: 'draft' },
            { delivery_status: 'reversed' },
        ])
            expect(
                challanDueStatus({ ...sent, ...change }, '2027-01-01'),
            ).toBeNull()
    })
})
