import 'server-only'
import { randomUUID } from 'node:crypto'
import { adminRecordAudit, requireFounder } from './founder'
import { ApiError } from './errors'
import { getFactorySummary } from './factories'
import { getSupportSummary } from './support'
import { getPaymentsReport } from './payments'
import { getAdminSystem } from './system'

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
    const [factoryRead, supportRead, paymentRead, systemRead] = await Promise.allSettled([
        getFactorySummary(), getSupportSummary(), getPaymentsReport(paymentQuery), getAdminSystem(),
    ])
    const factories = source(factoryRead), support = source(supportRead), payments = source(paymentRead), system = source(systemRead)
    const age = (time: string) => Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(time)) / 1000))
    const attention: AttentionItem[] = []
    if (system.value) for (const signal of system.value.signals) for (const item of signal.items) {
        if (signal.key === 'exports') continue
        attention.push({ ...item, target: item.orgId ?? item.id, owner: 'Founder', ageSeconds: age(item.observedAt),
            nextAction: signal.key === 'security_incidents' ? 'Review the incident in formal operations.' : 'Review payment event evidence.', group: signal.key === 'security_incidents' ? 'incidents' : 'payments' })
    }
    if (payments.value) for (const item of payments.value.exceptions) attention.push({ ...item, target: item.reference, owner: 'Founder', ageSeconds: age(item.observedAt), nextAction: 'Review evidence and the factory access state.', group: 'payments' })
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
    return { factories, support, payments, system, attention: unique.slice(0, 100), attentionLimit: 100,
        asOf, definitionVersion: 'admin-today-v1', reportingZone: 'Asia/Kolkata', requestId,
        activation: { state: 'unavailable' as const, detail: 'Activation-gap queues need complete prerequisite and event coverage. No missing history is treated as inactivity.' },
        sourceFreshness: [factories, support, payments, system].map((entry, index) => ({ source: ['factories', 'support', 'payments', 'system'][index], state: entry.state, asOf: entry.value?.asOf ?? null })) }
}
