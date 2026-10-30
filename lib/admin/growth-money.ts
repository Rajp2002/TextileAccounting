import type { GrowthFactory } from './growth-input'
import { financialYear, financialYearFromLabel, financialYearMonths, indiaMonth } from './fiscal'

/**
 * Money and conversion definitions (spec 2026-10-30 section D). Pure: facts in, numbers out.
 * Everything here counts only events after go-live; before it each function returns null and
 * the page shows "Starts at go-live".
 */
const DAY = 86_400_000
const time = (value: string | null | undefined) => (value ? Date.parse(value) : NaN)

export type Rate = { count: number; of: number; percent: number | null }
export function rate(count: number, of: number): Rate {
    return { count, of, percent: of === 0 ? null : Math.round((count / of) * 10_000) / 100 }
}

type Payment = GrowthFactory['payments'][number]
const afterGoLive = (payment: Payment, goLiveAt: string) => time(payment.capturedAt) >= time(goLiveAt)
const litePayments = (factory: GrowthFactory, goLiveAt: string) => factory.payments.filter(payment => payment.planTier === 'lite' && afterGoLive(payment, goLiveAt))

export type RevenueMonth = { month: string; newPaise: number; renewalPaise: number; refundPaise: number; litePaise: number; basePaise: number }
export type RevenueReport = { fyPaise: number; lastFyPaise: number; allTimePaise: number; months: RevenueMonth[] }

/** Live payments by India capture month, minus issued refunds in their refund month. */
export function revenueReport(factories: GrowthFactory[], goLiveAt: string | null, asOf: string, fy: string): RevenueReport | null {
    if (!goLiveAt) return null
    const byMonth = new Map<string, RevenueMonth>()
    const bucket = (month: string) => {
        let entry = byMonth.get(month)
        if (!entry) { entry = { month, newPaise: 0, renewalPaise: 0, refundPaise: 0, litePaise: 0, basePaise: 0 }; byMonth.set(month, entry) }
        return entry
    }
    for (const factory of factories) {
        const counted = factory.payments.filter(payment => afterGoLive(payment, goLiveAt) && time(payment.capturedAt) <= time(asOf))
        for (const payment of counted) {
            const entry = bucket(indiaMonth(payment.capturedAt))
            if (payment.purchaseType === 'renewal') entry.renewalPaise += payment.amountPaise
            else entry.newPaise += payment.amountPaise
            if (payment.planTier === 'base') entry.basePaise += payment.amountPaise
            else if (payment.planTier === 'lite') entry.litePaise += payment.amountPaise
            const refunds = factory.refunds.filter(refund => refund.paymentId === payment.id && time(refund.at) <= time(asOf))
            // Refunded in the Razorpay dashboard with no refund row: subtract in full in the capture month.
            if (payment.status === 'refunded' && refunds.length === 0) entry.refundPaise += payment.amountPaise
            for (const refund of refunds) bucket(indiaMonth(refund.at)).refundPaise += refund.amountPaise
        }
    }
    const net = (entry: RevenueMonth) => entry.newPaise + entry.renewalPaise - entry.refundPaise
    const total = (months: string[]) => months.reduce((sum, month) => sum + (byMonth.has(month) ? net(byMonth.get(month)!) : 0), 0)
    const year = financialYearFromLabel(fy) ?? financialYear(asOf)
    const lastYear = financialYear(new Date(time(year.start) - DAY).toISOString())
    const months = financialYearMonths(year.label)
    return {
        fyPaise: total(months),
        lastFyPaise: total(financialYearMonths(lastYear.label)),
        allTimePaise: [...byMonth.values()].reduce((sum, entry) => sum + net(entry), 0),
        months: months.map(month => byMonth.get(month) ?? { month, newPaise: 0, renewalPaise: 0, refundPaise: 0, litePaise: 0, basePaise: 0 }),
    }
}

/** Trials that ended after go-live: converted (paid by end + 14 days), back to Free, or still deciding. */
export function trialOutcomes(factories: GrowthFactory[], goLiveAt: string | null, asOf: string): { converted: string[]; backToFree: string[]; deciding: string[]; rate: Rate } | null {
    if (!goLiveAt) return null
    const converted: string[] = [], backToFree: string[] = [], deciding: string[] = []
    const now = time(asOf)
    for (const factory of factories) {
        for (const row of factory.subscriptions.filter(subscription => subscription.is_trial)) {
            const end = time(row.current_end), start = time(row.current_start)
            if (!Number.isFinite(end) || end > now || end < time(goLiveAt)) continue
            const paid = litePayments(factory, goLiveAt).some(payment => time(payment.capturedAt) >= start && time(payment.capturedAt) <= end + 14 * DAY)
            if (paid) converted.push(factory.id)
            else if (now - end < 14 * DAY) deciding.push(factory.id)
            else backToFree.push(factory.id)
        }
    }
    return { converted, backToFree, deciding, rate: rate(converted.length, converted.length + backToFree.length) }
}

/** When this factory was first on effective Free, or null if it never was. */
function firstFreeAt(factory: GrowthFactory, asOf: string): number | null {
    if (!factory.hasFreeGrant) return null
    const trials = factory.subscriptions.filter(subscription => subscription.is_trial)
    if (trials.length === 0) return time(factory.createdAt) <= time(asOf) ? time(factory.createdAt) : null
    for (const row of trials) {
        const start = time(row.current_start), end = time(row.current_end)
        if (!Number.isFinite(end) || end > time(asOf)) continue
        const paidDuringTrial = factory.payments.some(payment => payment.planTier === 'lite' && time(payment.capturedAt) >= start && time(payment.capturedAt) <= end)
        if (!paidDuringTrial) return end
    }
    return null
}

/** Factories that have been on Free and later made a live Lite payment after go-live. */
export function freeToLite(factories: GrowthFactory[], goLiveAt: string | null, asOf: string): { converted: string[]; everFree: string[]; rate: Rate; medianDays: number | null } | null {
    if (!goLiveAt) return null
    const everFree: string[] = [], converted: string[] = [], days: number[] = []
    for (const factory of factories) {
        const freeAt = firstFreeAt(factory, asOf)
        if (freeAt === null) continue
        everFree.push(factory.id)
        const paid = litePayments(factory, goLiveAt).filter(payment => time(payment.capturedAt) > freeAt && time(payment.capturedAt) <= time(asOf))
            .sort((a, b) => time(a.capturedAt) - time(b.capturedAt))[0]
        if (paid) { converted.push(factory.id); days.push(Math.round((time(paid.capturedAt) - freeAt) / DAY)) }
    }
    days.sort((a, b) => a - b)
    const middle = Math.floor(days.length / 2)
    const medianDays = days.length === 0 ? null : days.length % 2 ? days[middle] : Math.round((days[middle - 1] + days[middle]) / 2)
    return { converted, everFree, rate: rate(converted.length, everFree.length), medianDays }
}

/** Paid Lite terms that ended more than 30 days ago: renewed within ±30 days, or won back later. */
export function liteRenewals(factories: GrowthFactory[], goLiveAt: string | null, asOf: string): { terms: string[]; renewed: string[]; wonBack: string[]; rate: Rate } | null {
    if (!goLiveAt) return null
    const terms: string[] = [], renewed: string[] = [], wonBack: string[] = []
    for (const factory of factories) {
        const payments = litePayments(factory, goLiveAt)
        for (const row of factory.subscriptions) {
            if (row.is_trial || row.plan_tier !== 'lite') continue
            const own = payments.find(payment => payment.subscriptionId === row.id)
            const end = time(row.current_end)
            if (!own || !Number.isFinite(end) || end > time(asOf) - 30 * DAY) continue
            terms.push(factory.id)
            const later = payments.filter(payment => payment.id !== own.id && time(payment.capturedAt) >= end - 30 * DAY && time(payment.capturedAt) <= time(asOf))
            if (later.some(payment => time(payment.capturedAt) <= end + 30 * DAY)) renewed.push(factory.id)
            else if (later.length > 0) wonBack.push(factory.id)
        }
    }
    return { terms, renewed, wonBack, rate: rate(renewed.length, terms.length) }
}
