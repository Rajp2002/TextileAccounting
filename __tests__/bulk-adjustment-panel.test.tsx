import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BulkAdjustmentWorker } from '../lib/base-bulk-adjustment'

vi.mock('@/lib/i18n/context', () => ({
    useTranslation: () => ({
        language: 'en',
        t: (key: string) => key,
        tx: (text: string, values?: Record<string, string | number>) =>
            values ? text.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match)) : text,
    }),
}))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ createBaseWorkerAdjustmentsBulk: vi.fn() }))
import { BulkAdjustmentPanel } from '../components/payroll/BulkAdjustmentDialog'

const workers: BulkAdjustmentWorker[] = [
    { id: 'w1', name: 'Zed Weaver', is_active: true, pay_type: 'piece_rate' },
    { id: 'w2', name: 'Amit', is_active: true, pay_type: 'piece_rate' },
    { id: 'w3', name: 'Ravi Karighar', is_active: true, pay_type: 'fixed_monthly' },
    { id: 'w4', name: 'Gone Worker', is_active: false, pay_type: 'piece_rate' },
]

function render(list: BulkAdjustmentWorker[]) {
    return renderToStaticMarkup(<BulkAdjustmentPanel workers={list} onSaved={() => {}} onClose={() => {}} />)
}

describe('BulkAdjustmentPanel', () => {
    it('opens with every active worker ticked and inactive workers left out', () => {
        const html = render(workers)
        expect(html).toContain('Amit')
        expect(html).toContain('Zed Weaver')
        expect(html).toContain('Ravi Karighar')
        expect(html).not.toContain('Gone Worker')
        expect(html.match(/type="checkbox"/g)).toHaveLength(3)
        expect(html.match(/checked=""/g)).toHaveLength(3)
        expect(html).toContain('3 of 3 selected')
    })

    it('lists workers by name regardless of case', () => {
        const html = render(workers)
        expect(html.indexOf('Amit')).toBeLessThan(html.indexOf('Ravi Karighar'))
        expect(html.indexOf('Ravi Karighar')).toBeLessThan(html.indexOf('Zed Weaver'))
    })

    it('offers both worker-type switches with counts, pressed while the group is fully selected', () => {
        const html = render(workers)
        expect(html).toContain('Piece rate (2)')
        expect(html).toContain('Fixed monthly (1)')
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(2)
    })

    it('hides a worker-type switch when that group has no workers', () => {
        const html = render(workers.filter(worker => worker.pay_type === 'piece_rate'))
        expect(html).toContain('Piece rate (2)')
        expect(html).not.toContain('Fixed monthly (')
    })

    it('starts on Deduction with Advance one tap away', () => {
        const html = render(workers)
        expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*>Advance</)
        expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Deduction</)
    })

    it('keeps Review disabled until an amount is entered', () => {
        const html = render(workers)
        expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Review</)
    })

    it('makes every control a 44px touch target', () => {
        const html = render(workers)
        expect(html).toContain('min-h-[44px]')
        expect(html).not.toMatch(/min-h-11\b/)
    })

    it('says so when there is nobody to record for', () => {
        const html = render([{ id: 'w4', name: 'Gone Worker', is_active: false }])
        expect(html).toContain('No active workers to record this for.')
        expect(html).not.toContain('type="checkbox"')
    })
})
