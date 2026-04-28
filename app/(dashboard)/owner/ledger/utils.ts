import { formatINR } from '@/lib/finance'
import { LedgerInvoice } from './actions'

export const partyTypeLabels: Record<string, string> = {
    trader: 'Trader',
    processor: 'Processor',
    broker: 'Broker',
    supplier: 'Supplier',
    other: 'Other',
}

export const adjustmentLabels: Record<string, string> = {
    shortage: 'Shortage',
    quality_claim: 'Quality claim',
    rate_difference: 'Rate difference',
    discount: 'Discount',
    bad_debt: 'Bad debt',
    other: 'Other',
}

export const methodLabels: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    bank: 'Bank',
    cheque: 'Cheque',
    other: 'Other',
}

export function getBalanceTone(amount: number) {
    if (amount < -0.01) return 'text-sky-700 bg-sky-50 border-sky-200'
    if (amount > 0.01) return 'text-rose-700 bg-rose-50 border-rose-200'
    return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}

export function getInvoiceStatusClass(invoice: LedgerInvoice) {
    if (invoice.status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (invoice.is_overdue) return 'bg-rose-50 text-rose-700 border-rose-200'
    if (invoice.status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (invoice.status === 'cancelled') return 'bg-zinc-100 text-zinc-500 border-zinc-200'
    return 'bg-slate-50 text-slate-700 border-slate-200'
}

export function shortMoney(value: number) {
    return formatINR(value, { hideDecimals: Math.abs(value % 1) < 0.01 })
}

export function toNumber(value: string, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}
