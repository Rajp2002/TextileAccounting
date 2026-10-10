import 'server-only'

import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const ACCOUNT_DELETION_REVIEW_MESSAGE = 'Your account needs a manual check before it can be deleted, because some older billing records are linked to it. Nothing has been deleted. Send a privacy request and we will arrange the check.'
export const ACCOUNT_DELETION_UNAVAILABLE_MESSAGE = 'Account deletion readiness could not be verified. Nothing was deleted and no provider changes were requested. Please try again.'
const EXPORT_UNAVAILABLE = 'Your public support export is unavailable or incomplete. No export was generated; please try again.'

const safeEventValues = z.object({
    status: z.string().optional(), priority: z.string().optional(), category: z.string().optional(),
    resolutionCode: z.string().nullable().optional(), nextUpdateDueAt: z.string().nullable().optional(),
}).strict()
const ticket = z.object({
    id: z.uuid(), subject: z.string(), category: z.string(), priority: z.string(), status: z.string(), source: z.string(),
    createdAt: z.string(), updatedAt: z.string(), nextUpdateDueAt: z.string().nullable(), resolvedAt: z.string().nullable(),
    resolutionCode: z.string().nullable(), resolutionSummary: z.string().nullable(),
}).strict()
const message = z.object({
    id: z.uuid(), ticketId: z.uuid(), authorKind: z.enum(['customer', 'founder']),
    messageKind: z.enum(['initial_intake', 'public_reply']), body: z.string(), createdAt: z.string(), messageSeq: z.string(),
}).strict()
const event = z.object({
    id: z.uuid(), ticketId: z.uuid(), eventType: z.string(), createdAt: z.string(), before: safeEventValues, after: safeEventValues,
}).strict()
const record = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ticket'), value: ticket }).strict(),
    z.object({ kind: z.literal('message'), value: message }).strict(),
    z.object({ kind: z.literal('event'), value: event }).strict(),
])
const cursor = z.object({ rank: z.number().int().min(0).max(2), createdAt: z.string(), id: z.uuid() }).strict()
const page = z.object({ items: z.array(record).max(100), nextCursor: cursor.nullable() }).strict()

/** Independent from support rollout/paid access; only the verified requester's public records. */
export async function readOwnSupportExport() {
    const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })
    const admin = createAdminClient()
    const asOf = new Date().toISOString()
    const datasets: {
        support_tickets: z.infer<typeof ticket>[]
        support_messages: z.infer<typeof message>[]
        support_ticket_events: z.infer<typeof event>[]
    } = { support_tickets: [], support_messages: [], support_ticket_events: [] }
    let next: z.infer<typeof cursor> | null = null
    const seen = new Set<string>()
    // Stop a corrupt/repeating cursor or an unexpectedly huge response; never claim a truncated export is complete.
    for (let pages = 0; pages < 1000; pages++) {
        const { data, error } = await admin.rpc('admin_requester_support_export', {
            p_actor_id: user.id, p_org_id: profile.org_id, p_as_of: asOf, p_limit: 100, p_cursor: next,
        })
        const parsed = page.safeParse(data)
        if (error || !parsed.success) throw new Error(EXPORT_UNAVAILABLE)
        for (const item of parsed.data.items) {
            if (item.kind === 'ticket') datasets.support_tickets.push(item.value)
            else if (item.kind === 'message') datasets.support_messages.push(item.value)
            else datasets.support_ticket_events.push(item.value)
        }
        next = parsed.data.nextCursor
        if (!next) return { datasets, asOf, scope: 'requester_public_support' as const }
        const key = JSON.stringify(next)
        if (seen.has(key) || !parsed.data.items.length) throw new Error(EXPORT_UNAVAILABLE)
        seen.add(key)
    }
    throw new Error(EXPORT_UNAVAILABLE)
}

/** The deletion RPC independently rechecks retained evidence under row locks. */
export async function checkOwnAccountDeletion(): Promise<{ allowed: boolean; reason: 'ready' | 'review_required' }> {
    const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })
    const { data, error } = await createAdminClient().rpc('admin_account_deletion_preflight', {
        p_actor_id: user.id, p_org_id: profile.org_id,
    })
    const parsed = z.object({ allowed: z.boolean(), reason: z.enum(['ready', 'review_required']) }).strict().safeParse(data)
    if (error || !parsed.success || parsed.data.allowed !== (parsed.data.reason === 'ready')) {
        throw new Error(ACCOUNT_DELETION_UNAVAILABLE_MESSAGE)
    }
    return parsed.data
}
