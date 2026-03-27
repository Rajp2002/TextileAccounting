'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
    EstimatorSettingsSchema,
    EstimatorTemplateSchema,
    EstimatorQuoteSchema,
    UuidSchema,
    safeParse,
} from '@/lib/schemas'

/**
 * Fetch estimator settings for the current organization.
 */
export async function getEstimatorSettings() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_settings')
        .select('*')
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (error) {
        console.error('Failed to fetch estimator settings:', error)
        return { error: 'Failed to fetch settings' }
    }

    return { data }
}

/**
 * Upsert estimator settings.
 */
export async function upsertEstimatorSettings(data: any) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(EstimatorSettingsSchema, data)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('estimator_settings')
        .upsert({ org_id: profile.org_id, ...parsed.data })

    if (error) {
        console.error('Failed to upsert estimator settings:', error)
        return { error: 'Failed to save settings' }
    }

    revalidatePath('/owner/settings')
    return { success: true }
}

/**
 * Fetch active estimator templates.
 */
export async function getEstimatorTemplates() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_templates')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('name')

    if (error) {
        console.error('Failed to fetch templates:', error)
        return { error: 'Failed to fetch templates' }
    }

    return { data }
}

/**
 * Upsert an estimator template.
 */
export async function upsertEstimatorTemplate(data: any) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(EstimatorTemplateSchema, data)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('estimator_templates')
        .upsert({ org_id: profile.org_id, ...parsed.data })

    if (error) {
        console.error('Failed to upsert template:', error)
        return { error: 'Failed to save template' }
    }

    revalidatePath('/owner/settings') // Templates are managed in settings
    return { success: true }
}

export async function convertQuoteToOrder(quoteId: string, partyName: string, deadlineDate: string) {
    const supabase = await createServerClient() // Changed to createServerClient
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        // 1. Fetch the quote
        const { data: quote, error: fetchError } = await supabase
            .from('estimator_quotes')
            .select('*')
            .eq('id', quoteId)
            .single()

        if (fetchError || !quote) throw new Error('Quote not found')

        // 2. Find or create Quality
        // Calculate target yield from GSM (Assuming 44 inch width = 1.12m)
        const gsm = Number(quote.gsm) || 80
        const targetYield = Number((1000 / (gsm * 1.12)).toFixed(2))

        let { data: quality, error: qError } = await supabase
            .from('qualities')
            .select('id')
            .eq('name', quote.fabric_style)
            .eq('org_id', user.user_metadata.org_id)
            .single()

        if (!quality) throw new Error('Failed to find or create quality')

        // 3. Create Order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                org_id: user.user_metadata.org_id,
                quality_id: quality.id,
                party_name: partyName || quote.party_name,
                total_target_meters: quote.meters,
                deadline: deadlineDate,
                status: 'active'
            })
            .select()
            .single()

        if (orderError || !order) throw orderError || new Error('Failed to create order')

        // 4. Link quote to order
        await supabase
            .from('estimator_quotes')
            .update({ order_id: order.id })
            .eq('id', quoteId)

        return { success: true, orderId: order.id }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Delete (deactivate) an estimator template.
 */
export async function deleteEstimatorTemplate(id: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(UuidSchema, id)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('estimator_templates')
        .update({ is_active: false })
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to delete template:', error)
        return { error: 'Failed to delete template' }
    }

    revalidatePath('/owner/settings')
    return { success: true }
}

/**
 * Save an estimator quote (snapshot).
 */
export async function saveEstimatorQuote(data: any) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(EstimatorQuoteSchema, data)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('estimator_quotes')
        .insert({ org_id: profile.org_id, ...parsed.data })

    if (error) {
        console.error('Failed to save quote:', error)
        return { error: 'Failed to save quote' }
    }

    return { success: true }
}
