import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../lib/i18n/locales/en'
import type { BasePayrollSettlement } from '../lib/base-production-core'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
        const template = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)
        return typeof template === 'string' ? template.replace(/\{(\w+)\}/g, (match, name) => String(values?.[name] ?? match)) : key
    },
    tx: (text: string) => text,
}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ reverseBasePayrollSettlement: vi.fn() }))

import BasePayrollRecords from '../app/(dashboard)/owner/production/BasePayrollRecords'
import { payrollSampleData } from '../lib/tours/sample-data/production'

function payment(id: string, worker: string, start: string, end: string, net: number): BasePayrollSettlement {
    return {
        id, worker_id: `worker-${worker}`, worker_name_snapshot: worker, period_start: start, period_end: end,
        gross_pay: net, advance_balance_before: 0, advance_deducted: 0, remaining_advance_balance: 0,
        net_payout: net, payment_mode: 'cash', paid_at: `${end}T12:00:00.000Z`,
    }
}

const data = {
    ...payrollSampleData('en'),
    today: '2026-10-08',
    payrollCycleConfig: undefined,
    settlements: [
        payment('aug-ramesh', 'Ramesh', '2026-08-01', '2026-08-31', 9_000),
        payment('sep-mahesh-early', 'Mahesh', '2026-09-15', '2026-09-19', 2_000),
        payment('sep-mahesh', 'Mahesh', '2026-09-20', '2026-09-30', 3_000),
    ],
    settlementLines: [],
    payrollPeriods: [],
}

const render = (props: Partial<React.ComponentProps<typeof BasePayrollRecords>> = {}) =>
    renderToStaticMarkup(<BasePayrollRecords initialData={data} onBack={() => {}} {...props} />)

function button(html: string, label: string) {
    return html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? ''
}

describe('payroll records page', () => {
    it('opens on the latest pay period and files both September payments under it', () => {
        const html = render()

        expect(html).toContain('September 2026')
        expect(html).toContain('Mahesh')
        expect(html).not.toContain('Ramesh')
        expect(html).toContain('₹5,000.00')
        expect(html).toContain('Covers 15 – 19 Sep 2026')
    })

    it('opens on the last finished period while the current one is still running', () => {
        const html = render({ initialData: { ...data, settlements: [...data.settlements, payment('oct-ramesh', 'Ramesh', '2026-10-01', '2026-10-05', 1_400)] } })

        expect(html).toContain('September 2026')
        expect(html).not.toContain('Ramesh')
        expect(button(html, en.payroll.records.nextPeriod)).not.toContain('disabled=""')
    })

    it('can step back but not forward from the newest period', () => {
        const html = render()

        expect(button(html, en.payroll.records.previousPeriod)).not.toContain('disabled=""')
        expect(button(html, en.payroll.records.nextPeriod)).toContain('disabled=""')
    })

    it('opens on the period it was sent from', () => {
        const html = render({ initialPeriodStart: '2026-08-01' })

        expect(html).toContain('August 2026')
        expect(html).toContain('Ramesh')
        expect(html).not.toContain('Mahesh')
    })

    it('explains how payments get here when nothing has been paid', () => {
        const html = renderToStaticMarkup(<BasePayrollRecords initialData={{ ...data, settlements: [] }} onBack={() => {}} />)

        expect(html).toContain(en.payroll.records.emptyTitle)
        expect(html).toContain(en.payroll.records.openCurrentPayroll)
    })
})
