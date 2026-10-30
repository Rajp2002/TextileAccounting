import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgPlanAccess } from '@/lib/subscription'
import { getRedis } from '@/lib/rate-limit'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'

// Founder-only email about customer support messages. Customers are never emailed.
const RESEND_URL = 'https://api.resend.com/emails'
const SENDER = 'Weavly Support <onboarding@resend.dev>'
const SUBJECT_LIMIT = 150
const MESSAGE_LIMIT = 4000
const DEDUPE_SECONDS = 86400

type Kind = 'created' | 'customer_reply'

export function planLabel(tier: string): string {
    return tier === 'free' ? 'Free' : tier === 'lite' ? 'Lite' : tier === 'base' ? 'Base' : 'No plan'
}

function truncate(value: string, limit: number) {
    return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function buildFounderEmail(input: { kind: Kind; ticketId: string; subject: string; category: string; factory: string; plan: string; message: string; siteUrl: string }) {
    const subjectLine = input.kind === 'created'
        ? `New ticket · ${input.factory} (${input.plan}): ${input.subject}`
        : `Customer replied · ${input.factory}: ${input.subject}`
    const subject = truncate(subjectLine.replace(/\s+/g, ' ').trim(), SUBJECT_LIMIT)
    const message = input.message.length > MESSAGE_LIMIT ? `${input.message.slice(0, MESSAGE_LIMIT)}…` : input.message
    const link = `${input.siteUrl.replace(/\/$/, '')}/admin/support/${encodeURIComponent(input.ticketId)}`
    const heading = input.kind === 'created' ? 'New support ticket' : 'Customer replied'
    const category = input.category.replaceAll('_', ' ')
    const text = [
        `${heading}: ${input.subject}`,
        `Factory: ${input.factory} (${input.plan})`,
        `Category: ${category}`,
        '',
        message,
        '',
        `Open ticket: ${link}`,
    ].join('\n')
    const html = [
        `<p><strong>${escapeHtml(heading)}:</strong> ${escapeHtml(input.subject)}</p>`,
        `<p>Factory: ${escapeHtml(input.factory)} (${escapeHtml(input.plan)})<br>Category: ${escapeHtml(category)}</p>`,
        `<p>${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p>`,
        `<p><a href="${escapeHtml(link)}">Open ticket</a></p>`,
    ].join('\n')
    return { subject, text, html }
}

// The first delivery of a request id claims the key; a retried request that returns
// the stored RPC result does not email twice. Without Redis, send anyway.
async function firstDelivery(requestId: string) {
    const redis = getRedis()
    if (!redis) return true
    try {
        return (await redis.set(`support-email:${requestId}`, '1', { nx: true, ex: DEDUPE_SECONDS })) !== null
    } catch {
        return true
    }
}

async function readContext(ticketId: string) {
    const admin = createAdminClient()
    const { data: ticket, error } = await admin.from('support_tickets').select('subject,category,org_id').eq('id', ticketId).maybeSingle()
    if (error || !ticket) throw new Error(`Support email could not read ticket: ${error?.code ?? 'missing'}`)
    const [message, org, plan] = await Promise.all([
        admin.from('support_messages').select('body').eq('ticket_id', ticketId).eq('author_kind', 'customer').order('message_seq', { ascending: false }).limit(1).maybeSingle(),
        admin.from('organizations').select('name').eq('id', ticket.org_id).maybeSingle(),
        getOrgPlanAccess(ticket.org_id).then(access => planLabel(access.effectiveTier), () => 'Plan unavailable'),
    ])
    return {
        subject: ticket.subject as string,
        category: ticket.category as string,
        message: (message.data?.body as string | undefined) ?? '(Message unavailable)',
        factory: (org.data?.name as string | undefined) ?? 'Unknown factory',
        plan,
    }
}

export async function notifyFounderOfCustomerMessage(input: { kind: Kind; ticketId: string; requestId: string }): Promise<void> {
    try {
        if (!(await firstDelivery(input.requestId))) return
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) throw new Error('RESEND_API_KEY is not set; founder support email not sent.')
        const context = await readContext(input.ticketId)
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        const email = buildFounderEmail({ kind: input.kind, ticketId: input.ticketId, siteUrl, ...context })
        const response = await fetch(RESEND_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: SENDER, to: [LEGAL_OPERATOR.contactEmail], subject: email.subject, text: email.text, html: email.html }),
        })
        if (!response.ok) throw new Error(`Resend rejected the founder support email: ${response.status}`)
    } catch (error) {
        console.error('[support] founder email failed', error)
        Sentry.captureException(error, { tags: { support_email: true } })
    }
}
