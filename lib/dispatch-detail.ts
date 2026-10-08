import Decimal from 'decimal.js'
import type { Challan } from '@/lib/delivery-challans'
import { formatToSurat } from '@/lib/time'

/**
 * What the dispatch detail shows about money. Mirrors the generated `delivery_challans.balance` column:
 * round(chargeable_meters * selling_rate, 2) + adjustment_amount - paid_amount. Refunds reduce paid_amount.
 */
export function dispatchSettlement(d: Pick<Challan, 'chargeable_meters' | 'selling_rate' | 'adjustment_amount' | 'paid_amount' | 'delivery_status'>) {
    const fabricValue = new Decimal(d.chargeable_meters || 0).times(d.selling_rate || 0).toDecimalPlaces(2)
    const billed = fabricValue.plus(d.adjustment_amount || 0)
    const issued = d.delivery_status === 'sent' || d.delivery_status === 'received'
    const paidShare = issued && billed.greaterThan(0)
        ? Math.min(1, Math.max(0, new Decimal(d.paid_amount || 0).dividedBy(billed).toNumber()))
        : null
    return { fabricValue: fabricValue.toNumber(), billed: billed.toNumber(), paidShare }
}

export type DispatchPrimaryAction = 'confirm' | 'receivedAsSent' | 'payment' | 'refund'

/** The one next step the detail puts first; every other operation stays a secondary button. */
export function dispatchPrimaryAction(d: Pick<Challan, 'delivery_status' | 'balance'>): DispatchPrimaryAction | null {
    switch (d.delivery_status) {
        case 'draft':
            return 'confirm'
        case 'sent':
            return 'receivedAsSent'
        case 'received':
            return Number(d.balance) > 0 ? 'payment' : Number(d.balance) < 0 ? 'refund' : null
        default:
            return null
    }
}

const EVENT_LABELS = new Set(['save', 'confirm', 'receipt', 'resolve', 'payment', 'refund', 'adjustment', 'reverse_entry', 'reverse_dispatch', 'payment_terms'])

/** History names an entry for what happened ("Payment recorded"), not for the button that did it. */
export function dispatchEventLabelKey(action: string) {
    return EVENT_LABELS.has(action) ? `event_${action}` : action
}

/** Entry time in Surat, e.g. "7 Oct, 11:43 PM"; the year appears only when it is not the current one. */
export function formatDispatchEventTime(value: string, currentYear = formatToSurat(new Date(), 'yyyy')) {
    return formatToSurat(value, 'yyyy') === currentYear
        ? formatToSurat(value, 'd MMM, h:mm a')
        : formatToSurat(value, 'd MMM yyyy, h:mm a')
}

export function formatDocumentDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const date = new Date(value + 'T00:00:00Z')
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function formatMeters(value: number) {
    return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatMoney(value: number) {
    return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function deliveryBadgeVariant(status: Challan['delivery_status']) {
    switch (status) {
        case 'received':
            return 'success'
        case 'sent':
            return 'info'
        case 'reversed':
            return 'risk'
        default:
            return 'secondary'
    }
}

export function paymentBadgeVariant(status: string) {
    switch (status) {
        case 'settled':
            return 'success'
        case 'partial':
        case 'unpaid':
            return 'warning'
        case 'credit':
            return 'info'
        default:
            return 'secondary'
    }
}
