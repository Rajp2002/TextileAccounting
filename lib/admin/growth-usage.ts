import { ACTIVITY_AREAS, type ActivityArea } from '@/lib/activity-tracking'
import type { GrowthFactory } from './growth-input'
import { resolveFactoryAccess } from './metrics'
import { indiaMonth } from './fiscal'
import { rate, type Rate } from './growth-money'

/**
 * Accounts, activation, usage and contact-list definitions (spec 2026-10-30 section D).
 * Pure: facts in, lists of factory IDs and numbers out.
 */
const DAY = 86_400_000
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const time = (value: string | null | undefined) => (value ? Date.parse(value) : NaN)
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })

export type PlanNow = 'free' | 'lite_trial' | 'lite_paid' | 'base' | 'none'
type Subscription = GrowthFactory['subscriptions'][number]
const isPaidTerm = (row: Subscription) => !row.is_trial && Boolean(row.razorpay_payment_id)
const hasPaidTerm = (factory: GrowthFactory) => factory.subscriptions.some(isPaidTerm)

/** The factory's plan at an instant, from the canonical access resolver. */
export function planAt(factory: GrowthFactory, at: string): PlanNow {
    const access = resolveFactoryAccess(factory.subscriptions, factory.hasFreeGrant, at)
    if (access.effectivePlan === 'free') return 'free'
    if (access.effectivePlan === 'base') return 'base'
    if (access.effectivePlan !== 'lite') return 'none'
    const now = time(at)
    const paidActive = factory.subscriptions.some(row => isPaidTerm(row) && time(row.current_start) <= now && now < time(row.current_end))
    const trialActive = factory.subscriptions.some(row => row.is_trial && time(row.current_start) <= now && now < time(row.current_end))
    return trialActive && !paidActive ? 'lite_trial' : 'lite_paid'
}

export function plansNow(factories: GrowthFactory[], asOf: string): Record<PlanNow, string[]> {
    const plans: Record<PlanNow, string[]> = { free: [], lite_trial: [], lite_paid: [], base: [], none: [] }
    for (const factory of factories) plans[planAt(factory, asOf)].push(factory.id)
    return plans
}

export function signupsByMonth(factories: GrowthFactory[], months: string[]): { month: string; ids: string[] }[] {
    return months.map(month => ({ month, ids: factories.filter(factory => indiaMonth(factory.createdAt) === month).map(factory => factory.id) }))
}

/** Signed up in these months and at least 7 days old: saved a first costing within 7 days, then used Weavly on a second day within 30. */
export function activation(factories: GrowthFactory[], months: string[], asOf: string): { signedUp: string[]; activated: string[]; cameBack: string[]; activatedRate: Rate; cameBackRate: Rate } {
    const signedUp: string[] = [], activated: string[] = [], cameBack: string[] = []
    for (const factory of factories) {
        if (!months.includes(indiaMonth(factory.createdAt)) || time(factory.createdAt) > time(asOf) - 7 * DAY) continue
        signedUp.push(factory.id)
        if (!factory.costings.first || time(factory.costings.first) - time(factory.createdAt) > 7 * DAY) continue
        activated.push(factory.id)
        if (new Set([...factory.activity.earlyDays, ...factory.costings.earlyDays]).size >= 2) cameBack.push(factory.id)
    }
    return { signedUp, activated, cameBack, activatedRate: rate(activated.length, signedUp.length), cameBackRate: rate(cameBack.length, activated.length) }
}

type Spread = { accounts: number; averageMinutes: number; medianMinutes: number }
function spread(values: number[]): Spread {
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
    return {
        accounts: sorted.length,
        averageMinutes: Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
        medianMinutes: sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2),
    }
}
/** Last instant of an India calendar month. */
function monthEnd(month: string): string {
    const [year, index] = month.split('-').map(Number)
    return new Date(Date.UTC(year, index, 1) - IST_OFFSET_MS - 1).toISOString()
}

export type MonthUsage = { month: string; accounts: number; averageMinutes: number | null; medianMinutes: number | null; byPlan: Partial<Record<Exclude<PlanNow, 'none'>, Spread>> }

/** Active minutes per factory per month, over factories active that month; plan as at month end. */
export function timeSpentByMonth(factories: GrowthFactory[], months: string[], asOf: string): MonthUsage[] {
    return months.map(month => {
        const at = new Date(Math.min(time(monthEnd(month)), time(asOf))).toISOString()
        const active = factories.map(factory => ({ factory, minutes: factory.activity.months.find(entry => entry.month === month)?.minutes ?? 0 })).filter(entry => entry.minutes > 0)
        if (active.length === 0) return { month, accounts: 0, averageMinutes: null, medianMinutes: null, byPlan: {} }
        const overall = spread(active.map(entry => entry.minutes))
        const grouped = new Map<Exclude<PlanNow, 'none'>, number[]>()
        for (const entry of active) {
            const plan = planAt(entry.factory, at)
            if (plan === 'none') continue
            grouped.set(plan, [...(grouped.get(plan) ?? []), entry.minutes])
        }
        return { month, ...overall, byPlan: Object.fromEntries([...grouped].map(([plan, values]) => [plan, spread(values)])) }
    })
}

/** Where the minutes go (areas) and on what (devices), as shares of 0–1. */
export function usageShare(factories: GrowthFactory[], months: string[]): { areas: Record<ActivityArea, number>; devices: { phone: number; tablet: number; desktop: number }; installedShare: number } {
    const areas = Object.fromEntries(ACTIVITY_AREAS.map(area => [area, 0])) as Record<ActivityArea, number>
    let total = 0, phone = 0, tablet = 0, desktop = 0, installed = 0
    for (const factory of factories) for (const entry of factory.activity.months) {
        if (!months.includes(entry.month)) continue
        total += entry.minutes; phone += entry.phone; tablet += entry.tablet; desktop += entry.desktop; installed += entry.installed
        for (const area of ACTIVITY_AREAS) areas[area] += entry.areas[area] ?? 0
    }
    const areaTotal = Object.values(areas).reduce((sum, value) => sum + value, 0)
    const share = (value: number, of: number) => (of === 0 ? 0 : value / of)
    return {
        areas: Object.fromEntries(ACTIVITY_AREAS.map(area => [area, share(areas[area], areaTotal)])) as Record<ActivityArea, number>,
        devices: { phone: share(phone, total), tablet: share(tablet, total), desktop: share(desktop, total) },
        installedShare: share(installed, total),
    }
}

/** The latest of activity, latest saved costing and the owner's last sign-in. */
export function lastSeen(factory: GrowthFactory): string | null {
    const candidates = [factory.activity.lastSeenAt, factory.costings.latest, factory.owner.lastSignInAt].filter((value): value is string => Boolean(value))
    return candidates.sort((a, b) => time(b) - time(a))[0] ?? null
}

/** No sign of use for 60+ days (new accounts count from signup). Estimated until tracking is 60 days old. */
export function ghosts(factories: GrowthFactory[], asOf: string, trackingSince: string | null): { neverStarted: string[]; wentQuiet: string[]; estimated: boolean } {
    const cutoff = time(asOf) - 60 * DAY
    const neverStarted: string[] = [], wentQuiet: string[] = []
    for (const factory of factories) {
        const seen = Math.max(time(factory.createdAt), time(lastSeen(factory)) || 0)
        if (seen > cutoff) continue
        if (factory.costings.count === 0) neverStarted.push(factory.id)
        else wentQuiet.push(factory.id)
    }
    const since = trackingSince ? Date.parse(`${trackingSince}T00:00:00+05:30`) : NaN
    return { neverStarted, wentQuiet, estimated: !Number.isFinite(since) || time(asOf) - since < 60 * DAY }
}

export type ContactRow = { orgId: string; factory: string; ownerName: string | null; phone: string | null; detail: string; at: string | null; minutesLast30: number; costingsSaved: number }
const contact = (factory: GrowthFactory, detail: string, at: string | null): ContactRow => ({
    orgId: factory.id, factory: factory.name, ownerName: factory.owner.name, phone: factory.owner.phone, detail, at,
    minutesLast30: factory.activity.minutesLast30, costingsSaved: factory.costings.count,
})

/** Unpaid trials ending within 14 days, busiest first. */
export function trialsEndingSoon(factories: GrowthFactory[], asOf: string): ContactRow[] {
    const now = time(asOf)
    return factories.flatMap(factory => {
        if (hasPaidTerm(factory)) return []
        const row = factory.subscriptions.find(entry => entry.is_trial && time(entry.current_end) >= now && time(entry.current_end) < now + 14 * DAY)
        if (!row?.current_end) return []
        const days = Math.ceil((time(row.current_end) - now) / DAY)
        return [contact(factory, days <= 0 ? 'Ends today' : `Ends in ${days} ${days === 1 ? 'day' : 'days'}`, row.current_end)]
    }).sort((a, b) => b.minutesLast30 - a.minutesLast30)
}

/** Paid terms ending within 30 days, soonest first. */
export function renewalsDue(factories: GrowthFactory[], asOf: string): ContactRow[] {
    const now = time(asOf)
    return factories.flatMap(factory => factory.subscriptions
        .filter(row => isPaidTerm(row) && time(row.current_end) >= now && time(row.current_end) < now + 30 * DAY)
        .map(row => contact(factory, `${row.plan_tier === 'base' ? 'Base' : 'Lite'} ends ${shortDate.format(new Date(row.current_end!))}`, row.current_end)))
        .sort((a, b) => time(a.at) - time(b.at))
}

/** One row per factory with its newest signal in the last 14 days, newest first. */
export function upgradeSignals(factories: GrowthFactory[], goLiveAt: string | null, asOf: string): ContactRow[] {
    const from = time(asOf) - 14 * DAY, to = time(asOf)
    const inWindow = (at: string) => time(at) > from && time(at) <= to
    return factories.flatMap(factory => {
        const signals: { detail: string; at: string }[] = []
        if (factory.interest && inWindow(factory.interest.lastAt)) signals.push({ detail: 'Tapped Notify me', at: factory.interest.lastAt })
        for (const signal of factory.freeSignals.filter(entry => inWindow(entry.at))) {
            signals.push({ detail: signal.event === 'quota_reached' ? 'Hit the monthly limit' : 'Opened upgrade', at: signal.at })
        }
        const attempts = factory.checkoutAttempts.filter(entry => inWindow(entry.at))
        if (goLiveAt && attempts.length > 0 && !attempts.some(entry => entry.status === 'captured' || entry.status === 'activated')) {
            signals.push({ detail: 'Checkout not completed', at: attempts.map(entry => entry.at).sort().at(-1)! })
        }
        const newest = signals.sort((a, b) => time(b.at) - time(a.at))[0]
        return newest ? [contact(factory, newest.detail, newest.at)] : []
    }).sort((a, b) => time(b.at) - time(a.at))
}

/** Factories whose owner tapped "Notify me when paid plans open", earliest first. */
export function wantedToPay(factories: GrowthFactory[]): ContactRow[] {
    return factories.filter(factory => factory.interest)
        .map(factory => contact(factory, `Tapped Notify me ${factory.interest!.taps === 1 ? 'once' : `${factory.interest!.taps} times`}`, factory.interest!.firstAt))
        .sort((a, b) => time(a.at) - time(b.at))
}
