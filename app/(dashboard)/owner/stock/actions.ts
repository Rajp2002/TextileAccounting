'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { StockAdjustmentSchema, stockHistoryPage, type QualityStockBoard, type StockActivity, type StockAdjustmentInput, type StockCursor } from '@/lib/quality-stock'
import { ACTIVITY_ROW_LIMIT, activitySince } from '@/lib/stock-activity'
import { LegacyMutationSchema, legacyPayload, repeatedTakas, type LegacyMovement, type LegacyMutation, type LegacyStock } from '@/lib/legacy-stock'

async function requireStockOwner(write = false) {
    const session = write ? await requireWritableOrg(['owner']) : await requireRole(['owner'])
    if (!hasCapability(await getOrgTier(session.profile.org_id), 'production')) throw new Error('Production access is required for stock.')
    return session
}

/** The last three weeks of movements, for week totals and trend lines. Null when they cannot be read; the board still loads. */
async function readStockActivity(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<StockActivity[] | null> {
    const { data, error } = await supabase.from('quality_stock_movements')
        .select('id,quality_id,kind,meters_delta,balance_after,reason,source_table,source_id,created_at')
        .eq('org_id', orgId).gte('created_at', activitySince())
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(ACTIVITY_ROW_LIMIT)
    if (error || !data) {
        console.error('[quality-stock] activity', error?.code)
        return null
    }
    return data.map(row => ({ ...row, meters_delta: Number(row.meters_delta), balance_after: Number(row.balance_after) })) as StockActivity[]
}

const LEGACY_COLUMNS = 'id,quality_id,basis,balance_meters,basis_meters,basis_at,dispatched_meters,onboarded_meters,status,started_at,closed_at,version'
const LEGACY_MOVEMENT_COLUMNS = 'id,quality_id,kind,meters_delta,balance_after,basis_after,entered_meters,expected_meters,reason,lines,source_table,source_id,created_at'
const numberOrNull = (value: unknown) => value === null || value === undefined ? null : Number(value)

/** Legacy stock for every quality that started it. Null when it cannot be read; the board still loads. */
async function readLegacyStock(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<LegacyStock[] | null> {
    const { data, error } = await supabase.from('legacy_stock').select(LEGACY_COLUMNS).eq('org_id', orgId)
    if (error || !data) {
        console.error('[legacy-stock] load', error?.code)
        return null
    }
    return data.map(row => ({
        ...row,
        balance_meters: numberOrNull(row.balance_meters),
        basis_meters: numberOrNull(row.basis_meters),
        dispatched_meters: Number(row.dispatched_meters),
        onboarded_meters: Number(row.onboarded_meters),
    })) as LegacyStock[]
}

export async function getQualityStockBoard(input: { qualityId?: string; cursor?: StockCursor; activity?: boolean } = {}): Promise<{ data: QualityStockBoard } | { error: string }> {
    const session = await requireStockOwner()
    const parsed = z.object({ qualityId: z.string().uuid().optional(), cursor: z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() }).optional(), activity: z.boolean().optional() }).safeParse(input)
    if (!parsed.success) return { error: 'Invalid stock history filter.' }
    const supabase = await createClient()
    // Week totals and trends describe all qualities, so only the stock page's unfiltered first page reads them.
    const fresh = parsed.data.activity === true && !parsed.data.qualityId && !parsed.data.cursor
    const [{ data, error }, activity, legacy] = await Promise.all([
        supabase.rpc('get_quality_stock_board', {
            p_quality_id: parsed.data.qualityId ?? null,
            p_before_at: parsed.data.cursor?.at ?? null,
            p_before_id: parsed.data.cursor?.id ?? null,
        }),
        fresh ? readStockActivity(supabase, session.profile.org_id) : Promise.resolve(undefined),
        readLegacyStock(supabase, session.profile.org_id),
    ])
    if (error || !data) {
        console.error('[quality-stock] load', error?.code)
        return { error: 'Stock could not be loaded. Please try again.' }
    }
    return { data: { ...data, ...stockHistoryPage(data.movements), ...(activity === undefined ? {} : { activity }), legacy } as QualityStockBoard }
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

/** One quality's legacy stock ledger, newest first. */
export async function getLegacyStockHistory(qualityId: string): Promise<{ data: LegacyMovement[] } | { error: string }> {
    const session = await requireStockOwner()
    if (!z.string().uuid().safeParse(qualityId).success) return { error: 'Invalid quality.' }
    const supabase = await createClient()
    const { data, error } = await supabase.from('legacy_stock_movements').select(LEGACY_MOVEMENT_COLUMNS)
        .eq('org_id', session.profile.org_id).eq('quality_id', qualityId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200)
    if (error || !data) {
        console.error('[legacy-stock] history', error?.code)
        return { error: 'Legacy stock history could not be loaded.' }
    }
    return {
        data: data.map(row => ({
            ...row,
            meters_delta: numberOrNull(row.meters_delta),
            balance_after: numberOrNull(row.balance_after),
            entered_meters: numberOrNull(row.entered_meters),
            expected_meters: numberOrNull(row.expected_meters),
        })) as LegacyMovement[],
    }
}

/** Taka numbers among `lots` that were already added from legacy stock for this quality. A warning, not a block: numbers can repeat over the years. */
export async function findOnboardedTakas(qualityId: string, lots: string[]): Promise<{ data: { lot: string; at: string }[] } | { error: string }> {
    const session = await requireStockOwner()
    const parsed = z.object({ qualityId: z.string().uuid(), lots: z.array(z.string().trim().max(80)).max(500) }).safeParse({ qualityId, lots })
    if (!parsed.success) return { error: 'Invalid lot numbers.' }
    const supabase = await createClient()
    const { data, error } = await supabase.from('legacy_stock_movements').select('kind,lines,created_at')
        .eq('org_id', session.profile.org_id).eq('quality_id', parsed.data.qualityId).eq('kind', 'onboard')
        .order('created_at', { ascending: false }).limit(2000)
    if (error || !data) return { error: 'Earlier legacy lots could not be checked.' }
    return { data: repeatedTakas(parsed.data.lots, data as Pick<LegacyMovement, 'kind' | 'lines' | 'created_at'>[]) }
}

export async function mutateLegacyStock(input: LegacyMutation): Promise<{ success: true; duplicate: boolean } | { error: string; errorKey: string; uncertain?: boolean }> {
    await requireStockOwner(true)
    const parsed = LegacyMutationSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Review the legacy stock details.', errorKey: 'validation' }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('mutate_legacy_stock', {
        p_quality_id: parsed.data.qualityId, p_request_id: parsed.data.requestId, p_version: parsed.data.version,
        p_action: parsed.data.input.action, p_payload: legacyPayload(parsed.data.input),
    })
    if (error) {
        if (error.code === '40001') return { error: error.message, errorKey: 'staleSave' }
        if (['22023', '22P02'].includes(error.code)) return { error: error.message, errorKey: 'server' }
        if (error.code === '42501') return { error: error.message, errorKey: 'forbidden' }
        console.error('[legacy-stock] save', error.code)
        return { error: 'Legacy stock could not be saved. Retry with the same details.', errorKey: 'retrySame', uncertain: true }
    }
    revalidatePath('/owner/stock')
    revalidatePath('/owner/dispatches')
    return { success: true as const, duplicate: Boolean(data?.duplicate) }
}
