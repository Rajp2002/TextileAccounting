'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { requestPasswordReset } from '@/app/(auth)/actions/auth'

function validateExpectedTimestamp(value: string | undefined, label: string): string | null {
    if (!value || !Number.isFinite(Date.parse(value))) {
        return `${label} changed or is missing its version. Refresh before saving again.`
    }
    return null
}

// ─── 1. Personal Information ──────────────────────────────────────────────────

const UpdatePersonalInputSchema = z.object({
    fullName: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters long')
        .max(100, 'Name must be 100 characters or fewer'),
}).strict()

export async function updatePersonalInformation(input: { fullName: string }) {
    try {
        const { user } = await requireRole(['owner'], { allowFreeAccount: true })

        const rateLimitReset = await checkAuthRateLimit(`profile-update:${user.id}`)
        if (rateLimitReset !== null) {
            return { error: 'Too many updates. Please wait a moment and try again.' }
        }

        const parsed = UpdatePersonalInputSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid name provided.' }
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from('profiles')
            .update({ full_name: parsed.data.fullName })
            .eq('id', user.id)

        if (error) {
            console.error('Failed to update personal name:', error)
            return { error: 'Failed to save name. Please try again.' }
        }

        revalidatePath('/owner/settings')
        revalidatePath('/free/account')

        return { success: true, fullName: parsed.data.fullName }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to update personal information.' }
    }
}

// ─── 2. Factory Details ───────────────────────────────────────────────────────

const UpdateFactoryInputSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Factory name is required')
        .max(120, 'Factory name must be 120 characters or fewer'),
}).strict()

export async function updateFactoryDetails(input: { name: string }) {
    try {
        const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })

        const rateLimitReset = await checkAuthRateLimit(`factory-update:${profile.org_id}`)
        if (rateLimitReset !== null) {
            return { error: 'Too many updates. Please wait a moment and try again.' }
        }

        const parsed = UpdateFactoryInputSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid factory name.' }
        }

        const supabase = await createClient()
        try {
            await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
        } catch {
            // Non-fatal audit context initialization
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from('organizations')
            .update({ name: parsed.data.name })
            .eq('id', profile.org_id)

        if (error) {
            console.error('Failed to update factory name:', error)
            return { error: 'Failed to update factory name. Please try again.' }
        }

        revalidatePath('/owner/settings')
        revalidatePath('/free/account')

        return { success: true, name: parsed.data.name }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to update factory details.' }
    }
}

// ─── 3. Costing Defaults ──────────────────────────────────────────────────────

const CostingDefaultsInputSchema = z.object({
    yarnShortagePct: z
        .number()
        .min(0, 'Wastage percentage cannot be negative')
        .max(100, 'Wastage percentage cannot exceed 100%'),
    defaultMarginPct: z
        .number()
        .min(0, 'Target margin cannot be negative')
        .max(99.99, 'Target margin must be less than 100%'),
    overheadMode: z.enum(['direct', 'monthly_expenses']),
    warpingMode: z.enum(['in_house', 'outsourced']),
    sizingMode: z.enum(['in_house', 'outsourced']),
    expectedUpdatedAt: z.string().optional().nullable(),
}).strict()

export type CostingDefaultsInput = z.infer<typeof CostingDefaultsInputSchema>

export async function saveCostingDefaults(input: CostingDefaultsInput) {
    try {
        const { user, profile } = await requireRole(['owner'], { allowFreeAccount: true })

        // Check authoritative capability
        const planAccess = await getCachedOrgPlanAccess(profile.org_id)
        if (!hasCapability(planAccess.effectiveTier, 'costing_defaults')) {
            return { error: 'Costing defaults require a Weavly Lite or Base plan.' }
        }

        const parsed = CostingDefaultsInputSchema.safeParse(input)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message || 'Invalid costing defaults provided.' }
        }

        const supabase = await createClient()
        try {
            await supabase.rpc('set_actor_for_audit', { p_actor_id: user.id })
        } catch {
            // Non-fatal audit context initialization
        }

        // Read current record to verify optimistic concurrency
        const { data: current, error: readError } = await supabase
            .from('factory_cost_profile')
            .select('updated_at, factory_id')
            .eq('factory_id', profile.org_id)
            .maybeSingle()

        if (readError) {
            return { error: 'Failed to verify existing settings. Please try again.' }
        }

        if (parsed.data.expectedUpdatedAt && current?.updated_at) {
            const timestampError = validateExpectedTimestamp(parsed.data.expectedUpdatedAt, 'Factory defaults')
            if (timestampError) return { error: timestampError, stale: true }

            if (new Date(current.updated_at).getTime() !== new Date(parsed.data.expectedUpdatedAt).getTime()) {
                return {
                    error: 'These settings changed elsewhere. Review the latest values before saving.',
                    stale: true,
                }
            }
        }

        const nextUpdatedAt = new Date().toISOString()
        const updatePayload: Record<string, unknown> = {
            yarn_shortage_pct: parsed.data.yarnShortagePct,
            default_margin_pct: parsed.data.defaultMarginPct,
            overhead_mode: parsed.data.overheadMode,
            default_warping_mode: parsed.data.warpingMode,
            default_sizing_mode: parsed.data.sizingMode,
            updated_at: nextUpdatedAt,
        }

        // Attempt update with all columns, falling back to base columns if migration is pending
        let saveResult = current
            ? await supabase
                .from('factory_cost_profile')
                .update(updatePayload)
                .eq('factory_id', profile.org_id)
                .select('updated_at')
                .maybeSingle()
            : await supabase
                .from('factory_cost_profile')
                .insert({
                    factory_id: profile.org_id,
                    ...updatePayload,
                })
                .select('updated_at')
                .maybeSingle()

        if (saveResult.error && (saveResult.error.message.includes('default_warping_mode') || saveResult.error.message.includes('default_sizing_mode'))) {
            // Pending schema migration: save the baseline columns that exist
            delete updatePayload.default_warping_mode
            delete updatePayload.default_sizing_mode
            saveResult = current
                ? await supabase
                    .from('factory_cost_profile')
                    .update(updatePayload)
                    .eq('factory_id', profile.org_id)
                    .select('updated_at')
                    .maybeSingle()
                : await supabase
                    .from('factory_cost_profile')
                    .insert({
                        factory_id: profile.org_id,
                        ...updatePayload,
                    })
                    .select('updated_at')
                    .maybeSingle()
        }

        if (saveResult.error) {
            console.error('Failed to save costing defaults:', saveResult.error)
            return { error: 'Failed to save costing defaults. Please try again.' }
        }

        revalidatePath('/owner/settings')
        revalidatePath('/owner/estimator')

        return {
            success: true,
            updatedAt: saveResult.data?.updated_at || nextUpdatedAt,
            defaults: {
                yarnShortagePct: parsed.data.yarnShortagePct,
                defaultMarginPct: parsed.data.defaultMarginPct,
                overheadMode: parsed.data.overheadMode,
                warpingMode: parsed.data.warpingMode,
                sizingMode: parsed.data.sizingMode,
            },
        }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to save costing defaults.' }
    }
}

// ─── 4. Security Password Reset ───────────────────────────────────────────────

export async function requestSecurityPasswordReset() {
    try {
        const { user } = await requireRole(['owner'], { allowFreeAccount: true })

        if (!user.email) {
            return { error: 'No email address associated with this account.' }
        }

        const rateLimitReset = await checkAuthRateLimit(`pwd-reset:${user.id}`)
        if (rateLimitReset !== null) {
            return { error: 'Password reset link was recently sent. Please check your inbox or wait before retrying.' }
        }

        const result = await requestPasswordReset({ email: user.email })
        if ('error' in result && result.error) {
            return { error: result.error }
        }

        return { success: true, email: user.email }
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Unable to request password reset link.' }
    }
}
