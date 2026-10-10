'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { orgHasDocumentBranding, requireBrandingManager } from '@/lib/document-branding/access.server'
import { BrandingPreferencesSchema, BusinessProfileSchema, businessProfileToRow, type BusinessProfileInput } from '@/lib/document-branding/profile'
import {
    activateLogo,
    clearActiveLogo,
    getDocumentBrandingFor,
    loadBrandingSettingsView,
    logBrandingEvent,
    rejectCandidate,
    retryLogoProcessing,
} from '@/lib/document-branding/service.server'
import type { DocumentBranding, DocumentBrandingPreferences, DocumentBrandingSettingsView } from '@/lib/document-branding/types'

/** Results carry a code; the Settings screen turns it into a translated sentence. */
type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; code: string }

const AssetIdSchema = z.string().uuid()
const VariantSchema = z.enum(['svg', 'raster'])

export async function getDocumentBrandingSettings(): Promise<ActionResult<DocumentBrandingSettingsView>> {
    const { profile } = await requireRole(['owner'])
    try {
        const admin = createAdminClient()
        const [entitled, { data: organization }] = await Promise.all([
            orgHasDocumentBranding(profile.org_id),
            admin.from('organizations').select('name').eq('id', profile.org_id).maybeSingle(),
        ])
        const view = await loadBrandingSettingsView({
            orgId: profile.org_id,
            businessName: organization?.name ?? '',
            entitled,
            canManage: profile.role === 'owner',
        })
        return { ok: true, data: view }
    } catch {
        return { ok: false, code: 'load_failed' }
    }
}

export async function saveBusinessProfile(input: BusinessProfileInput): Promise<ActionResult<{ updatedAt: string }>> {
    const access = await requireBrandingManager()
    if (!access.ok) return access
    if (await checkAuthRateLimit(`branding-profile:${access.orgId}`) !== null) return { ok: false, code: 'rate_limited' }
    const parsed = BusinessProfileSchema.safeParse(input)
    if (!parsed.success) return { ok: false, code: parsed.error.issues[0]?.message?.match(/^[a-z_]+$/) ? parsed.error.issues[0].message : 'profile_invalid' }

    const updatedAt = new Date().toISOString()
    const { error } = await createAdminClient().from('document_branding_settings').upsert({
        org_id: access.orgId,
        ...businessProfileToRow(parsed.data),
        updated_by: access.userId,
        updated_at: updatedAt,
    }, { onConflict: 'org_id' })
    if (error) {
        logBrandingEvent('profile_save_failed', { org: access.orgId, code: error.code })
        return { ok: false, code: 'save_failed' }
    }
    revalidatePath('/owner/settings')
    return { ok: true, data: { updatedAt } }
}

export async function saveBrandingPreferences(input: DocumentBrandingPreferences): Promise<ActionResult<{ updatedAt: string }>> {
    const access = await requireBrandingManager()
    if (!access.ok) return access
    const parsed = BrandingPreferencesSchema.safeParse(input)
    if (!parsed.success) return { ok: false, code: 'preferences_invalid' }

    const updatedAt = new Date().toISOString()
    const { error } = await createAdminClient().from('document_branding_settings').upsert({
        org_id: access.orgId,
        quotation_logo_enabled: parsed.data.quotationLogoEnabled,
        internal_cost_sheet_logo_enabled: parsed.data.internalCostSheetLogoEnabled,
        delivery_challan_logo_enabled: parsed.data.deliveryChallanLogoEnabled,
        updated_by: access.userId,
        updated_at: updatedAt,
    }, { onConflict: 'org_id' })
    if (error) {
        logBrandingEvent('preferences_save_failed', { org: access.orgId, code: error.code })
        return { ok: false, code: 'save_failed' }
    }
    revalidatePath('/owner/settings')
    return { ok: true, data: { updatedAt } }
}

export async function approveLogo(input: { assetId: string; variant: 'svg' | 'raster' }): Promise<ActionResult> {
    const access = await requireBrandingManager()
    if (!access.ok) return access
    const assetId = AssetIdSchema.safeParse(input?.assetId)
    const variant = VariantSchema.safeParse(input?.variant)
    if (!assetId.success || !variant.success) return { ok: false, code: 'not_found' }
    const result = await activateLogo({ orgId: access.orgId, userId: access.userId, assetId: assetId.data, variant: variant.data })
    if (!result.ok) return result
    revalidatePath('/owner/settings')
    return { ok: true, data: undefined }
}

export async function rejectLogoCandidate(input: { assetId: string }): Promise<ActionResult> {
    const access = await requireBrandingManager()
    if (!access.ok) return access
    const assetId = AssetIdSchema.safeParse(input?.assetId)
    if (!assetId.success) return { ok: false, code: 'not_found' }
    const result = await rejectCandidate({ orgId: access.orgId, assetId: assetId.data })
    return result.ok ? { ok: true, data: undefined } : result
}

export async function removeActiveLogo(): Promise<ActionResult> {
    const access = await requireBrandingManager()
    if (!access.ok) return access
    const result = await clearActiveLogo({ orgId: access.orgId, userId: access.userId })
    if (!result.ok) return result
    revalidatePath('/owner/settings')
    return { ok: true, data: undefined }
}

export async function retryLogo(input: { assetId: string }): Promise<ActionResult> {
    const access = await requireBrandingManager()
    if (!access.ok) return access
    const assetId = AssetIdSchema.safeParse(input?.assetId)
    if (!assetId.success) return { ok: false, code: 'not_found' }
    const result = await retryLogoProcessing({ orgId: access.orgId, assetId: assetId.data })
    return result.ok ? { ok: true, data: undefined } : result
}

/**
 * Branding for the costing documents (customer quotation and internal cost
 * sheet), resolved on the server for the caller's own organization. Free
 * accounts and plans without branding get `null` and keep their existing
 * document layout; a branding failure never blocks the export.
 */
export async function getCostingDocumentBranding(): Promise<{ quotation: DocumentBranding; internal_cost_sheet: DocumentBranding } | null> {
    const { profile } = await requireRole(['owner'], { allowFreeAccount: true })
    try {
        if (!(await orgHasDocumentBranding(profile.org_id))) return null
        return await getDocumentBrandingFor(profile.org_id, ['quotation', 'internal_cost_sheet'])
    } catch {
        logBrandingEvent('resolve_failed', { org: profile.org_id, stage: 'export' })
        return null
    }
}
