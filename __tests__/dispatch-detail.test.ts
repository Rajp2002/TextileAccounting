import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
    dispatchEventLabelKey,
    dispatchPrimaryAction,
    dispatchSettlement,
    formatDispatchEventTime,
} from '@/lib/dispatch-detail'
import type { Challan } from '@/lib/delivery-challans'
import { en } from '@/lib/i18n/locales/en'
import { hi } from '@/lib/i18n/locales/hi'
import { gu } from '@/lib/i18n/locales/gu'

const challan = (over: Partial<Challan>): Challan => ({
    quality_id: 'q', selling_rate: 50, document: { date: '2026-10-07' }, lines: [{ lot: 'D.345', meters: 295 }],
    id: 'c', number: 'DC000000000002', quality_label: 'D.345', sent_meters: 295, chargeable_meters: 295,
    acknowledged_meters: 295, delivery_status: 'received', difference_status: 'none', adjustment_amount: 0,
    paid_amount: 10000, balance: 4750, version: 3, archived_at: null, issued_at: '2026-10-07', created_at: '2026-10-07',
    ...over,
})

describe('dispatch settlement', () => {
    it('bills chargeable metres at the agreed rate, the same way the database computes the balance', () => {
        const s = dispatchSettlement(challan({}))
        expect(s.fabricValue).toBe(14750)
        expect(s.billed).toBe(14750)
        expect(s.billed - 10000).toBe(4750) // value + adjustments - paid = balance (generated column)
        expect(s.paidShare).toBeCloseTo(10000 / 14750, 6)
    })

    it('rounds the fabric value to paise before adding adjustments, like the balance column', () => {
        const s = dispatchSettlement(challan({ chargeable_meters: 100.33, selling_rate: 41.17, adjustment_amount: -50, paid_amount: 0, balance: 4080.59 }))
        expect(s.fabricValue).toBe(4130.59)
        expect(s.billed).toBe(4080.59)
    })

    it('fills the paid bar when the customer has paid more than the bill (a credit)', () => {
        expect(dispatchSettlement(challan({ paid_amount: 15000, balance: -250 })).paidShare).toBe(1)
    })

    it('has no paid bar when nothing is billed', () => {
        expect(dispatchSettlement(challan({ chargeable_meters: 0, paid_amount: 0, balance: 0 })).paidShare).toBeNull()
    })

    it('has no paid bar before the goods leave or after a reversal', () => {
        expect(dispatchSettlement(challan({ delivery_status: 'draft', acknowledged_meters: null, paid_amount: 0 })).paidShare).toBeNull()
        expect(dispatchSettlement(challan({ delivery_status: 'reversed', chargeable_meters: 0, paid_amount: 0, balance: 0 })).paidShare).toBeNull()
    })
})

describe('dispatch primary action: the one next step the detail puts first', () => {
    it.each([
        ['a draft is confirmed when the goods leave', { delivery_status: 'draft' as const }, 'confirm'],
        ['a sent dispatch is received', { delivery_status: 'sent' as const, acknowledged_meters: null }, 'receivedAsSent'],
        ['a received dispatch with money due takes a payment', {}, 'payment'],
        ['a customer credit is refunded', { paid_amount: 15000, balance: -250 }, 'refund'],
        ['a settled dispatch has nothing left to do', { paid_amount: 14750, balance: 0 }, null],
        ['a reversed dispatch cannot change', { delivery_status: 'reversed' as const, chargeable_meters: 0, paid_amount: 0, balance: 0 }, null],
    ])('%s', (_name, over, expected) => {
        expect(dispatchPrimaryAction(challan(over))).toBe(expected)
    })
})

describe('dispatch history', () => {
    it('names each entry for what happened rather than the button that did it', () => {
        expect(dispatchEventLabelKey('payment')).toBe('event_payment')
        expect(dispatchEventLabelKey('confirm')).toBe('event_confirm')
        expect(dispatchEventLabelKey('reverse_entry')).toBe('event_reverse_entry')
        expect(dispatchEventLabelKey('some_future_action')).toBe('some_future_action')
    })

    it('shows entry times in Surat time, without the year when it is the current one', () => {
        expect(formatDispatchEventTime('2026-10-07T18:13:29Z', '2026')).toBe('7 Oct, 11:43 PM')
        // 31 Dec in UTC is already 1 Jan in Surat, so this is a current-year entry.
        expect(formatDispatchEventTime('2025-12-31T20:00:00Z', '2026')).toBe('1 Jan, 1:30 AM')
        expect(formatDispatchEventTime('2025-03-02T04:30:00Z', '2026')).toBe('2 Mar 2025, 10:00 AM')
    })

    it('has a past-tense label for every action in English, Hindi and Gujarati', () => {
        const actions = ['save', 'confirm', 'receipt', 'resolve', 'payment', 'refund', 'adjustment', 'reverse_entry', 'reverse_dispatch', 'payment_terms']
        for (const [language, dictionary] of Object.entries({ en, hi, gu })) {
            const challan = dictionary.challan as Record<string, string>
            for (const action of actions) expect(challan[dispatchEventLabelKey(action)], `${language} ${action}`).toBeTruthy()
        }
    })
})

describe('dispatch detail modal', () => {
    const read = (name: string) => readFileSync(`app/(dashboard)/owner/dispatches/${name}.tsx`, 'utf8')

    it('opens the selected dispatch in its own dialog instead of below the list', () => {
        const client = read('ChallansClient')
        const detail = read('DispatchDetailDialog')
        expect(client).toContain('<DispatchDetailDialog')
        expect(detail).toContain('<DialogContent')
        expect(detail).toContain('data-dispatch-tour="difference"')
    })

    it('has no untranslated headings or rupee prefixes left in the detail', () => {
        const client = read('ChallansClient')
        const detail = read('DispatchDetailDialog')
        expect(detail).not.toMatch(/Metres Breakdown|Financial Summary|Payment Terms|Lot Breakdown|>Rs |\bRs \{/)
        expect(client).not.toMatch(/Metres Breakdown|Financial Summary|Payment Terms|Lot Breakdown/)
    })
})
