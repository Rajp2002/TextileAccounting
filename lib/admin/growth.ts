import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminRecordAudit, requireFounder, type FounderPrincipal } from './founder'
import { AdminError } from './errors'
import { growthInputSchema, type GrowthInput } from './growth-input'
import { financialYear, financialYearFromLabel, financialYearMonths } from './fiscal'
import { freeToLite, liteRenewals, revenueReport, trialOutcomes } from './growth-money'
import { activation, ghosts, lastSeen, planAt, plansNow, renewalsDue, signupsByMonth, timeSpentByMonth, trialsEndingSoon, upgradeSignals, usageShare, wantedToPay, type ContactRow } from './growth-usage'

/** Founder Metrics (spec 2026-10-30 sections D–G): one audited read, every number computed from it. */
export const METRIC_LISTS = [
    'plan_free', 'plan_lite_trial', 'plan_lite_paid', 'plan_base', 'plan_none', 'signups', 'activated', 'not_activated', 'came_back',
    'trial_converted', 'trial_back_to_free', 'trial_deciding', 'free_to_lite', 'renewed', 'won_back',
    'ghost_never_started', 'ghost_went_quiet', 'trials_ending', 'renewals_due', 'upgrade_signals', 'wanted_to_pay',
] as const
export type MetricList = typeof METRIC_LISTS[number]
export type MetricsPeriod = { kind: 'fy'; fy: string } | { kind: 'month'; month: string }

/** Never throws: anything unrecognised falls back to the current financial year and no list. */
export function parseMetricsQuery(query: Record<string, string | undefined>, asOf: string): { period: MetricsPeriod; list: MetricList | null } {
    const raw = query.period ?? ''
    let period: MetricsPeriod = { kind: 'fy', fy: financialYear(asOf).label }
    const fy = /^fy-(\d{4}-\d{2})$/.exec(raw)
    const year = fy ? financialYearFromLabel(fy[1]) : null
    if (year) period = { kind: 'fy', fy: year.label }
    else if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) period = { kind: 'month', month: raw }
    const list = (METRIC_LISTS as readonly string[]).includes(query.list ?? '') ? query.list as MetricList : null
    return { period, list }
}

/** ASCII key for links and audit target IDs (the audit allowlist has no en dash). */
export function periodKey(period: MetricsPeriod): string {
    return period.kind === 'month' ? period.month : `fy-${period.fy.replace('–', '-')}`
}

function periodMonths(period: MetricsPeriod): string[] {
    return period.kind === 'fy' ? financialYearMonths(period.fy) : [period.month]
}
function periodFy(period: MetricsPeriod): string {
    return period.kind === 'fy' ? period.fy : financialYear(`${period.month}-15T00:00:00+05:30`).label
}

export async function loadGrowthInput(principal: FounderPrincipal, asOf: string): Promise<GrowthInput> {
    const { data, error } = await createAdminClient().rpc('admin_growth_input', { p_actor_id: principal.userId, p_session_id: principal.sessionId, p_as_of: asOf })
    if (error?.code === '42501') throw new AdminError('FORBIDDEN', 403, 'Founder access is required.')
    const parsed = growthInputSchema.safeParse(data)
    if (error || !parsed.success) throw new AdminError('SOURCE_UNAVAILABLE', 503, "Metrics couldn't be loaded.")
    return parsed.data
}

function computeMetrics(input: GrowthInput, period: MetricsPeriod) {
    const { factories, goLiveAt, asOf } = input
    const months = periodMonths(period)
    return {
        asOf, period, periodKey: periodKey(period), goLiveAt, trackingSince: input.trackingSince, months,
        plans: plansNow(factories, asOf),
        revenue: revenueReport(factories, goLiveAt, asOf, periodFy(period)),
        trials: trialOutcomes(factories, goLiveAt, asOf),
        freeToLite: freeToLite(factories, goLiveAt, asOf),
        renewals: liteRenewals(factories, goLiveAt, asOf),
        signups: signupsByMonth(factories, months),
        activation: activation(factories, months, asOf),
        timeSpent: timeSpentByMonth(factories, months, asOf),
        usage: usageShare(factories, months),
        ghosts: ghosts(factories, asOf, input.trackingSince),
        wantedToPay: wantedToPay(factories),
    }
}
export type MetricsReport = ReturnType<typeof computeMetrics>

export async function getMetricsReport(query: Record<string, string | undefined>): Promise<MetricsReport> {
    const principal = await requireFounder()
    const requestId = randomUUID(), asOf = new Date().toISOString()
    const { period } = parseMetricsQuery(query, asOf)
    const report = computeMetrics(await loadGrowthInput(principal, asOf), period)
    await adminRecordAudit(principal, 'metrics.read', 'metrics', periodKey(period), requestId)
    return report
}

function listIds(input: GrowthInput, period: MetricsPeriod, list: MetricList): string[] {
    const metrics = computeMetrics(input, period)
    const orgIds = (rows: ContactRow[]) => rows.map(row => row.orgId)
    switch (list) {
        case 'plan_free': return metrics.plans.free
        case 'plan_lite_trial': return metrics.plans.lite_trial
        case 'plan_lite_paid': return metrics.plans.lite_paid
        case 'plan_base': return metrics.plans.base
        case 'plan_none': return metrics.plans.none
        case 'signups': return metrics.signups.flatMap(entry => entry.ids)
        case 'activated': return metrics.activation.activated
        case 'not_activated': return metrics.activation.signedUp.filter(id => !metrics.activation.activated.includes(id))
        case 'came_back': return metrics.activation.cameBack
        case 'trial_converted': return metrics.trials?.converted ?? []
        case 'trial_back_to_free': return metrics.trials?.backToFree ?? []
        case 'trial_deciding': return metrics.trials?.deciding ?? []
        case 'free_to_lite': return metrics.freeToLite?.converted ?? []
        case 'renewed': return metrics.renewals?.renewed ?? []
        case 'won_back': return metrics.renewals?.wonBack ?? []
        case 'ghost_never_started': return metrics.ghosts.neverStarted
        case 'ghost_went_quiet': return metrics.ghosts.wentQuiet
        case 'trials_ending': return orgIds(trialsEndingSoon(input.factories, input.asOf))
        case 'renewals_due': return orgIds(renewalsDue(input.factories, input.asOf))
        case 'upgrade_signals': return orgIds(upgradeSignals(input.factories, input.goLiveAt, input.asOf))
        case 'wanted_to_pay': return orgIds(metrics.wantedToPay)
    }
}

export type MetricAccountRow = { orgId: string; name: string; plan: string; joinedAt: string; lastSeen: string | null; minutesLast30: number }

export async function getMetricAccounts(query: Record<string, string | undefined>): Promise<{ list: MetricList; period: MetricsPeriod; periodKey: string; rows: MetricAccountRow[] }> {
    const principal = await requireFounder()
    const requestId = randomUUID(), asOf = new Date().toISOString()
    const { period, list } = parseMetricsQuery(query, asOf)
    if (!list) throw new AdminError('INVALID_QUERY', 400, 'Choose a metric to list.', undefined, requestId)
    const input = await loadGrowthInput(principal, asOf)
    const byId = new Map(input.factories.map(factory => [factory.id, factory]))
    const rows = [...new Set(listIds(input, period, list))].flatMap(id => {
        const factory = byId.get(id)
        return factory ? [{ orgId: id, name: factory.name, plan: planAt(factory, asOf), joinedAt: factory.createdAt, lastSeen: lastSeen(factory), minutesLast30: factory.activity.minutesLast30 }] : []
    })
    await adminRecordAudit(principal, 'metrics.accounts.read', 'metrics', list, requestId)
    return { list, period, periodKey: periodKey(period), rows }
}

/** Today's "Customers to contact" lists, up to 10 rows each. */
export function contactLists(input: GrowthInput): { trialsEnding: ContactRow[]; renewalsDue: ContactRow[]; upgradeSignals: ContactRow[] } {
    return {
        trialsEnding: trialsEndingSoon(input.factories, input.asOf).slice(0, 10),
        renewalsDue: renewalsDue(input.factories, input.asOf).slice(0, 10),
        upgradeSignals: upgradeSignals(input.factories, input.goLiveAt, input.asOf).slice(0, 10),
    }
}
