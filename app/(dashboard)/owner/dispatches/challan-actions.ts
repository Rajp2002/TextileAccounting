'use server'
import { revalidatePath } from 'next/cache'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import {
    ChallanDraftSchema,
    MutationSchema,
    PaymentTermsSchema,
    type Challan,
    type ChallanEvent,
    type ChallanMutation,
} from '@/lib/delivery-challans'
import { z } from 'zod'
import { getBaseGoLiveState } from '@/lib/base-go-live.server'
import { formatDateLabel } from '@/lib/payroll-cycle-engine'
async function owner(write = false) {
    const session = write
        ? await requireWritableOrg(['owner'])
        : await requireRole(['owner'])
    if (!hasCapability(await getOrgTier(session.profile.org_id), 'production'))
        throw new Error('Production access is required.')
    return session
}
export async function listChallans(history = false, search = '', offset = 0) {
    const session = await owner()
    const db = await createClient()
    let query = db
        .from('delivery_challans')
        .select('*')
        .eq('org_id', session.profile.org_id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
    query = history
        ? query.not('archived_at', 'is', null)
        : query.is('archived_at', null)
    if (search.trim())
        query = query.or(
            `number.ilike.%${search.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 100)}%,document->>customer_name.ilike.%${search.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 100)}%`,
        )
    const start = Math.max(0, Math.floor(offset))
    const { data, error } = await query.range(start, start + 49)
    if (error) return { error: 'Dispatches could not be loaded.' }
    return { data: data as Challan[] }
}
export async function getChallan(id: string) {
    const session = await owner()
    if (!z.string().uuid().safeParse(id).success)
        return { error: 'Invalid dispatch.' }
    const db = await createClient()
    const document = await db
        .from('delivery_challans')
        .select('*')
        .eq('org_id', session.profile.org_id)
        .eq('id', id)
        .single()
    if (document.error)
        return { error: 'Dispatch history could not be loaded.' }
    const events: ChallanEvent[] = []
    // Read every immutable event; PostgREST's default row cap must not hide old money.
    for (let offset = 0; ; offset += 500) {
        const page = await db
            .from('delivery_challan_events')
            .select('*')
            .eq('org_id', session.profile.org_id)
            .eq('challan_id', id)
            .order('created_at')
            .order('id')
            .range(offset, offset + 499)
        if (page.error)
            return { error: 'Dispatch history could not be loaded.' }
        events.push(...(page.data as ChallanEvent[]))
        if (page.data.length < 500) break
    }
    return { data: document.data as Challan, events }
}
export async function mutateChallan(input: ChallanMutation) {
    const { profile } = await owner(true)
    // New dispatch is recorded from go-live; before it fabric leaves on paper from legacy stock. Payments,
    // receipts and reversals on challans that already exist stay open.
    const goLive = await getBaseGoLiveState(profile.org_id)
    if ((input.action === 'save' || input.action === 'confirm') && goLive.phase !== 'live')
        return { error: goLive.goLive ? `Challans open on ${formatDateLabel(goLive.goLive)}.` : 'Schedule daily recording first.', uncertain: false }
    const parsed = MutationSchema.safeParse(input)
    if (!parsed.success) return { error: 'Review the dispatch details.' }
    if (input.action === 'save') {
        const draft = ChallanDraftSchema.safeParse(input.payload)
        if (!draft.success) return { error: draft.error.issues[0].message }
    }
    if (input.action === 'payment_terms') {
        const terms = PaymentTermsSchema.safeParse(input.payload)
        if (!terms.success) return { error: terms.error.issues[0].message }
    }
    const db = await createClient()
    // Fail closed if the app reaches a database without legacy stock (20261015120000): the older RPC
    // ignores a line's source and would take Legacy metres from orange stock.
    if (input.action === 'save' || input.action === 'confirm') {
        const lines = input.action === 'save'
            ? (input.payload.lines as { source?: string }[] | undefined) ?? []
            : ((await db.from('delivery_challans').select('lines').eq('id', input.id).maybeSingle()).data?.lines as { source?: string }[] | undefined) ?? []
        if (lines.some((line) => line?.source === 'legacy')) {
            const probe = await db.from('delivery_challans').select('legacy_meters').limit(0)
            if (probe.error) return { error: 'Legacy stock is not available yet. Mark these takas Orange or try again later.', uncertain: false }
        }
    }
    const { data, error } = await db.rpc('mutate_delivery_challan', {
        p_id: input.id,
        p_request_id: input.requestId,
        p_version: input.version,
        p_action: input.action,
        p_payload: input.payload,
    })
    if (error)
        return {
            error: ['22023', '40001', '22007', '22008', '22P02'].includes(
                error.code,
            )
                ? error.message
                : 'Save could not be confirmed. Retry the same request.',
            uncertain: ![
                '22023',
                '40001',
                '22007',
                '22008',
                '22P02',
                '42501',
            ].includes(error.code),
        }
    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/stock')
    return { success: true, id: data.id as string }
}
