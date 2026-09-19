'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import {
    AuditAdjustmentSchema,
    AuditPhysicalCountSchema,
    CreateAuditSchema,
    FinalizeAuditSchema,
    type InventoryAuditBoard
} from '@/lib/inventory-audit'

export async function getInventoryAuditDataAction(input?: {
    auditDate?: string
    auditId?: string
}): Promise<{ data: InventoryAuditBoard } | { error: string }> {
    try {
        await requireRole(['owner'])
        const supabase = await createClient()
        const { data, error } = await supabase.rpc('get_inventory_audit_data', {
            p_audit_date: input?.auditDate || undefined,
            p_audit_id: input?.auditId || undefined,
        })

        if (error) {
            return { error: error.message || 'Failed to load inventory audit data.' }
        }

        return { data: data as InventoryAuditBoard }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Authentication or network error.' }
    }
}

export async function createInventoryAuditAction(
    input: z.input<typeof CreateAuditSchema>
): Promise<{ success: true; auditId: string } | { error: string }> {
    try {
        const { profile, user } = await requireRole(['owner'])
        const parsed = CreateAuditSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid audit input.' }
        }

        const supabase = await createClient()
        const { data, error } = await supabase
            .from('inventory_audits')
            .insert({
                org_id: profile.org_id,
                audit_date: parsed.data.auditDate,
                title: parsed.data.title,
                notes: parsed.data.notes || null,
                status: 'draft',
                created_by: user.id,
            })
            .select('id')
            .single()

        if (error) {
            return { error: error.message || 'Failed to create inventory audit.' }
        }

        revalidatePath('/owner/stock/audit')
        return { success: true, auditId: data.id }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error creating audit.' }
    }
}

export async function saveAuditPhysicalCountAction(
    input: z.input<typeof AuditPhysicalCountSchema>
): Promise<{ success: true } | { error: string }> {
    try {
        const { profile } = await requireRole(['owner'])
        const parsed = AuditPhysicalCountSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid physical count.' }
        }

        const supabase = await createClient()
        const { error } = await supabase
            .from('inventory_audit_lines')
            .upsert(
                {
                    audit_id: parsed.data.auditId,
                    org_id: profile.org_id,
                    item_type: parsed.data.itemType,
                    item_id: parsed.data.itemId,
                    item_label: parsed.data.itemLabel,
                    system_quantity: parsed.data.systemQuantity,
                    physical_count: parsed.data.physicalCount,
                    notes: parsed.data.notes || null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'audit_id,item_type,item_id' }
            )

        if (error) {
            return { error: error.message || 'Failed to record physical count.' }
        }

        revalidatePath('/owner/stock/audit')
        return { success: true }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error saving physical count.' }
    }
}

export async function applyAuditAdjustmentAction(
    input: z.input<typeof AuditAdjustmentSchema>
): Promise<{ success: true; variance: number } | { error: string }> {
    try {
        await requireRole(['owner'])
        const parsed = AuditAdjustmentSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid adjustment parameters.' }
        }

        const supabase = await createClient()
        const { data, error } = await supabase.rpc('apply_inventory_audit_adjustment', {
            p_audit_id: parsed.data.auditId,
            p_item_type: parsed.data.itemType,
            p_item_id: parsed.data.itemId,
            p_physical_count: parsed.data.physicalCount,
            p_reason: parsed.data.reason,
        })

        if (error) {
            return { error: error.message || 'Failed to apply inventory audit adjustment.' }
        }

        revalidatePath('/owner/stock')
        revalidatePath('/owner/stock/yarn')
        revalidatePath('/owner/stock/audit')
        return { success: true, variance: (data as { variance?: number })?.variance ?? 0 }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error applying adjustment.' }
    }
}

export async function finalizeInventoryAuditAction(
    input: z.input<typeof FinalizeAuditSchema>
): Promise<{ success: true; auditId: string } | { error: string }> {
    try {
        await requireRole(['owner'])
        const parsed = FinalizeAuditSchema.safeParse(input)
        if (!parsed.success) {
            return { error: 'Invalid audit ID.' }
        }

        const supabase = await createClient()
        const { data, error } = await supabase.rpc('finalize_inventory_audit', {
            p_audit_id: parsed.data.auditId,
        })

        if (error) {
            return { error: error.message || 'Failed to finalize inventory audit.' }
        }

        revalidatePath('/owner/stock/audit')
        return { success: true, auditId: (data as { audit_id: string }).audit_id }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error finalizing audit.' }
    }
}
