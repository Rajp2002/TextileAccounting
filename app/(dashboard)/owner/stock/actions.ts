'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { StockAdjustmentSchema, stockHistoryPage, type QualityStockBoard, type StockAdjustmentInput, type StockCursor } from '@/lib/quality-stock'

async function requireStockOwner(write = false) {
    const session = write ? await requireWritableOrg(['owner']) : await requireRole(['owner'])
    if (!hasCapability(await getOrgTier(session.profile.org_id), 'production')) throw new Error('Production access is required for stock.')
    return session
}

export async function getQualityStockBoard(input: { qualityId?: string; cursor?: StockCursor } = {}): Promise<{ data: QualityStockBoard } | { error: string }> {
    await requireStockOwner()
    const parsed = z.object({ qualityId: z.string().uuid().optional(), cursor: z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() }).optional() }).safeParse(input)
    if (!parsed.success) return { error: 'Invalid stock history filter.' }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_quality_stock_board', {
        p_quality_id: parsed.data.qualityId ?? null,
        p_before_at: parsed.data.cursor?.at ?? null,
        p_before_id: parsed.data.cursor?.id ?? null,
    })
    if (error || !data) {
        console.error('[quality-stock] load', error?.code)
        return { error: 'Stock could not be loaded. Please try again.' }
    }
    return { data: { ...data, ...stockHistoryPage(data.movements) } as QualityStockBoard }
}

export async function recordQualityStockAdjustment(input: StockAdjustmentInput): Promise<{ success: true; duplicate: boolean } | { error: string; errorKey: string }> {
    await requireStockOwner(true)
    const parsed = StockAdjustmentSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Review the stock details.', errorKey: 'validation' }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('record_quality_stock_adjustment', {
        p_quality_label: parsed.data.qualityLabel, p_meters: parsed.data.meters,
        p_kind: parsed.data.kind, p_reason: parsed.data.reason,
        p_client_request_id: parsed.data.clientRequestId, p_expected_meters: parsed.data.expectedMeters ?? null,
    })
    if (error) {
        if (['22023', '40001'].includes(error.code)) return { error: error.message, errorKey: error.message.includes('Opening stock') ? 'openingRecorded' : error.code === '40001' ? 'staleSave' : 'validation' }
        console.error('[quality-stock] save', error.code)
        return { error: 'Stock could not be saved. Retry with the same details.', errorKey: 'retrySame' }
    }
    revalidatePath('/owner/stock')
    return { success: true as const, duplicate: Boolean(data?.duplicate) }
}
