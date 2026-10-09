'use server'

import { revalidatePath } from 'next/cache'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { YarnFilterSchema, YarnMutationSchema, yarnHistoryPage, type YarnActivity, type YarnBoard, type YarnFilter, type YarnMutation } from '@/lib/yarn-stock'
import { ACTIVITY_ROW_LIMIT, activitySince } from '@/lib/stock-activity'

async function owner(write = false) {
    const session = write ? await requireWritableOrg(['owner']) : await requireRole(['owner'])
    if (!hasCapability(await getOrgTier(session.profile.org_id), 'production')) throw new Error('Production access is required.')
    return session
}
/** The last three weeks of movements, for week totals, daily use and trend lines. Null when they cannot be read; the board still loads. */
async function readYarnActivity(db: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<YarnActivity[] | null> {
    const { data, error } = await db.from('yarn_stock_movements')
        .select('id,yarn_id,kind,kg_delta,balance_after,reason,challan_id,recipe_snapshot,created_at')
        .eq('org_id', orgId).gte('created_at', activitySince())
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(ACTIVITY_ROW_LIMIT)
    if (error || !data) {
        console.error('[yarn-stock] activity', error?.code)
        return null
    }
    return data.map(row => ({ ...row, kg_delta: Number(row.kg_delta), balance_after: Number(row.balance_after) })) as YarnActivity[]
}
export async function getYarnStockBoard(input: YarnFilter = {}): Promise<{ data: YarnBoard } | { error: string }> {
    const session = await owner()
    const parsed = YarnFilterSchema.safeParse(input)
    if (!parsed.success) return { error: 'Review the audit date and history filter.' }
    const db = await createClient()
    // Pace and trends describe today's stock of every yarn, so only the page's undated, unfiltered first page reads them.
    const fresh = parsed.data.activity === true && !parsed.data.asOf && !parsed.data.yarnId && !parsed.data.cursor
    const [{ data, error }, activity] = await Promise.all([
        db.rpc('get_yarn_stock_board', {
            p_as_of: parsed.data.asOf ?? null, p_yarn_id: parsed.data.yarnId ?? null,
            p_before_at: parsed.data.cursor?.at ?? null, p_before_id: parsed.data.cursor?.id ?? null,
        }),
        fresh ? readYarnActivity(db, session.profile.org_id) : Promise.resolve(undefined),
    ])
    if (error || !data) return { error: error?.code === '22023' ? error.message : 'Yarn stock could not be loaded. Please retry.' }
    return { data: { ...data, ...yarnHistoryPage(data.movements), ...(activity === undefined ? {} : { activity }) } as YarnBoard }
}
export async function mutateYarnStock(input: YarnMutation): Promise<{ success: true } | { error: string; uncertain: boolean }> {
    await owner(true)
    const parsed = YarnMutationSchema.safeParse(input)
    if (!parsed.success) return { error: 'Review the yarn details, weight and reason.', uncertain: false }
    const db = await createClient()
    const { error } = await db.rpc('mutate_yarn_stock', { p_request_id: parsed.data.requestId, p_action: parsed.data.action, p_payload: parsed.data.payload })
    if (error) {
        const certain = ['22023', '40001', '22P02', '42501'].includes(error.code)
        return { error: certain ? error.message : 'Save could not be confirmed. Retry the same request.', uncertain: !certain }
    }
    revalidatePath('/owner/stock'); revalidatePath('/owner/stock/yarn'); revalidatePath('/owner/dispatches')
    return { success: true }
}
