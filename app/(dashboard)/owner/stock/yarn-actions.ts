'use server'

import { revalidatePath } from 'next/cache'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { YarnFilterSchema, YarnMutationSchema, yarnHistoryPage, type YarnBoard, type YarnFilter, type YarnMutation } from '@/lib/yarn-stock'

async function owner(write = false) {
    const session = write ? await requireWritableOrg(['owner']) : await requireRole(['owner'])
    if (!hasCapability(await getOrgTier(session.profile.org_id), 'production')) throw new Error('Production access is required.')
}
export async function getYarnStockBoard(input: YarnFilter = {}): Promise<{ data: YarnBoard } | { error: string }> {
    await owner()
    const parsed = YarnFilterSchema.safeParse(input)
    if (!parsed.success) return { error: 'Review the audit date and history filter.' }
    const db = await createClient()
    const { data, error } = await db.rpc('get_yarn_stock_board', {
        p_as_of: parsed.data.asOf ?? null, p_yarn_id: parsed.data.yarnId ?? null,
        p_before_at: parsed.data.cursor?.at ?? null, p_before_id: parsed.data.cursor?.id ?? null,
    })
    if (error || !data) return { error: error?.code === '22023' ? error.message : 'Yarn stock could not be loaded. Please retry.' }
    return { data: { ...data, ...yarnHistoryPage(data.movements) } as YarnBoard }
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
