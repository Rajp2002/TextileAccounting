import 'server-only'
import { randomUUID } from 'node:crypto'
import { adminRecordAudit, requireFounder } from './founder'
import { ApiError } from './errors'
import { getFactorySummary } from './factories'
import { getSupportSummary } from './support'
import { getPaymentsReport } from './payments'
import { getAdminSystem } from './system'
import { getPaidPlansAdmin } from './paid-plans'
import { contactLists, loadGrowthInput } from './growth'

export type AttentionItem = { id: string; target: string; reason: string; observedAt: string; ageSeconds: number; severity: 'critical' | 'high' | 'normal'; owner: 'Founder'; nextAction: string; href: string; group: 'incidents' | 'payments' | 'support'; supportRank?: number; dueLabel?: string; dueAt?: string }
type Source<T> = { state: 'available'; value: T } | { state: 'unavailable'; value: null; detail: string }
function source<T>(result: PromiseSettledResult<T>): Source<T> {
    if (result.status === 'fulfilled') return { state: 'available', value: result.value }
    if (result.reason instanceof ApiError && (result.reason.status === 400 || result.reason.status === 401 || result.reason.status === 403 || result.reason.code === 'ADMIN_DISABLED')) throw result.reason
    return { state: 'unavailable', value: null, detail: 'This source is unavailable. Counts and queues cannot be established.' }
}

/** Optional source failure stays local; founder verification and required audit fail closed. */
export async function getAdminOverview(paymentQuery: unknown = {}) {
    const principal = await requireFounder(), requestId = randomUUID(), asOf = new Date().toISOString()
    const [factoryRead, supportRead, paymentRead, systemRead, paidPlansRead, contactsRead] = await Promise.allSettled([
        getFactorySummary(), getSupportSummary(), getPaymentsReport(paymentQuery), getAdminSystem(), getPaidPlansAdmin(),
        loadGrowthInput(principal, asOf).then(contactLists),
    ])
    const factories = source(factoryRead), support = source(supportRead), payments = source(paymentRead), system = source(systemRead)
    const paidPlans = source(paidPlansRead), contacts = source(contactsRead)
    const age = (time: string) => Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(time)) / 1000))
    const attention: AttentionItem[] = []
    if (system.value) for (const signal of system.value.signals) for (const item of signal.items) {
        if (signal.key === 'exports') continue
        attention.push({ ...item, target: item.orgId ?? item.id, owner: 'Founder', ageSeconds: age(item.observedAt),
            nextAction: signal.key === 'security_incidents' ? 'Review the incident in formal operations.' : 'Review payment event evidence.', group: signal.key === 'security_incidents' ? 'incidents' : 'payments' })
    }
    if (payments.value) for (const item of payments.value.exceptions) attention.push({ ...item, target: item.reference, owner: 'Founder', ageSeconds: age(item.observedAt), nextAction: 'Review evidence and the factory access state.', group: 'payments' })
    // Before go-live nobody can pay, so an ending trial drops a customer to Free unless the founder extends it.
    if (paidPlans.value && paidPlans.value.goLiveAt === null && paidPlans.value.endingIn14Days > 0) {
        const count = paidPlans.value.endingIn14Days
        attention.push({ id: 'paid_plans:trials_ending', group: 'payments', severity: 'high', owner: 'Founder', target: 'Lite trials',
            reason: `${count} unpaid ${count === 1 ? 'trial ends' : 'trials end'} in the next 14 days. Paid plans aren't live yet.`,
            nextAction: 'Extend trials from the Paid plans card.', href: '/admin/payments#paid-plans', observedAt: asOf, ageSeconds: 0 })
    }
    if (support.value) for (const item of support.value.attention) {
        const internalFollowUpDue = item.status === 'waiting_on_customer' && item.followUpDueAt
            && Date.parse(item.followUpDueAt) < Date.parse(support.value.asOf)
        const dueAt = internalFollowUpDue ? item.followUpDueAt : item.nextUpdateDueAt
        const dueLabel = internalFollowUpDue ? 'Internal customer follow-up due'
            : item.reason === 'Promised customer update overdue' ? 'Promised customer update due'
                : item.reason === 'Internal review update overdue' ? 'Internal review due' : null
        attention.push({ id: item.id, target: item.subject, reason: item.reason, observedAt: item.observedAt,
            ageSeconds: age(item.observedAt), severity: item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'normal', owner: 'Founder',
            nextAction: item.nextAction, href: `/admin/support/${item.ticketId}`, group: 'support', supportRank: item.sortRank,
            ...(dueLabel && dueAt ? { dueLabel, dueAt } : {}) })
    }
    const order = { incidents: 0, payments: 1, support: 2 }, severity = { critical: 0, high: 1, normal: 2 }
    const unique = [...new Map(attention.map(item => [item.id, item])).values()].sort((a, b) => severity[a.severity] - severity[b.severity] || order[a.group] - order[b.group]
        || (a.group === 'support' && b.group === 'support' ? (a.supportRank ?? 3) - (b.supportRank ?? 3) : 0)
        || a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id))
    await adminRecordAudit(principal, 'overview.read', 'overview', 'today', requestId, { after: { count: unique.length } })
    return { factories, support, payments, system, paidPlans, contacts, attention: unique.slice(0, 100), attentionLimit: 100,
        asOf, definitionVersion: 'admin-today-v1', reportingZone: 'Asia/Kolkata', requestId,
        activation: { state: 'unavailable' as const, detail: 'Activation-gap queues need complete prerequisite and event coverage. No missing history is treated as inactivity.' },
        sourceFreshness: [
            ...[factories, support, payments, system].map((entry, index) => ({ source: ['factories', 'support', 'payments', 'system'][index], state: entry.state, asOf: entry.value?.asOf ?? null })),
            // Read live on each request; a failure here would otherwise hide the trial warning and contact lists silently.
            { source: 'paid plans', state: paidPlans.state, asOf: paidPlans.value ? asOf : null },
            { source: 'customers to contact', state: contacts.state, asOf: contacts.value ? asOf : null },
        ] }
}
