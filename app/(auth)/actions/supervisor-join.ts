'use server'

/**
 * Supervisor join (public /join page). The visitor has no session yet, so the
 * factory-code lookup and the request registration run as service-role
 * database functions that only answer for an enabled code of an active,
 * unlocked Base factory. The new supervisor has no organization and no access
 * until the owner approves the request.
 *
 * Errors are returned as copy keys (lib/i18n/supervisor-access.ts) and never
 * distinguish an unknown code from a disabled or inactive one.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checkSupervisorJoinRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { normalizeIndianPhone } from '@/lib/phone'
import { SupervisorJoinSchema } from '@/lib/schemas'
import { LEGAL_DOCUMENTS } from '@/lib/legal-documents'
import { founderEmailAllowed } from '@/lib/admin/founder-email'
import { isValidJoinCode, normalizeJoinCode, SUPERVISOR_HOME_PATH } from '@/lib/supervisor-access'
import type { SupervisorTextKey } from '@/lib/i18n/supervisor-access'

type JoinFactory = { org_id: string; factory_name: string }

export type SupervisorJoinInput = {
    code: string
    fullName: string
    email: string
    phone: string
    password: string
    confirmPassword: string
    legalAcceptance: { accepted: boolean; termsVersion: string; privacyVersion: string }
}

async function throttled() {
    const ip = getClientIpFromHeaders(await headers())
    return (await checkSupervisorJoinRateLimit(ip)) !== null
}

async function lookupFactory(code: string): Promise<JoinFactory | null> {
    const { data, error } = await createAdminClient().rpc('lookup_supervisor_join_code', { p_code: code })
    if (error || !data) return null
    return data as JoinFactory
}

export async function checkSupervisorJoinCode(code: string): Promise<
    { valid: true; factoryName: string } | { valid: false; error: SupervisorTextKey }
> {
    if (await throttled()) return { valid: false, error: 'tooManyAttempts' }
    const normalized = normalizeJoinCode(String(code ?? ''))
    if (!isValidJoinCode(normalized)) return { valid: false, error: 'codeInvalid' }
    const factory = await lookupFactory(normalized)
    return factory ? { valid: true, factoryName: factory.factory_name } : { valid: false, error: 'codeInvalid' }
}

const FIELD_ERRORS: Record<string, SupervisorTextKey> = {
    code: 'codeInvalid',
    fullName: 'nameInvalid',
    email: 'emailInvalid',
    phone: 'phoneInvalid',
    confirmPassword: 'passwordMismatch',
    legalAcceptance: 'legalRequired',
}

/** On success, signs the supervisor in and redirects to the pending page. */
export async function joinFactoryAsSupervisor(input: SupervisorJoinInput): Promise<{ error: SupervisorTextKey; message?: string }> {
    if (await throttled()) return { error: 'tooManyAttempts' }

    const phone = normalizeIndianPhone(String(input?.phone ?? ''))
    if (!phone) return { error: 'phoneInvalid' }
    const parsed = SupervisorJoinSchema.safeParse({ ...input, phone })
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        const field = String(issue?.path[0] ?? '')
        return { error: FIELD_ERRORS[field] ?? 'joinFailed', message: FIELD_ERRORS[field] ? undefined : issue?.message }
    }
    const data = parsed.data
    if (founderEmailAllowed(data.email)) return { error: 'joinFailed' }

    const factory = await lookupFactory(data.code)
    if (!factory) return { error: 'codeInvalid' }

    const admin = createAdminClient()
    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
    })
    if (createError || !created?.user) {
        const message = createError?.message?.toLowerCase() ?? ''
        if (message.includes('already') || createError?.status === 422) return { error: 'emailTaken' }
        return { error: 'joinFailed' }
    }
    const userId = created.user.id

    const { data: registered, error: registerError } = await admin.rpc('register_supervisor_join_request', {
        p_user_id: userId,
        p_code: data.code,
        p_full_name: data.fullName,
        p_email: data.email,
        p_phone: phone,
    })
    if (registerError || !registered) {
        await admin.auth.admin.deleteUser(userId)
        return { error: registerError?.code === '22023' ? 'codeInvalid' : 'joinFailed' }
    }
    const orgId = (registered as JoinFactory).org_id

    const userAgent = (await headers()).get('user-agent')?.trim().slice(0, 512) || null
    const { error: acceptanceError } = await admin.from('legal_document_acceptances').insert(
        [LEGAL_DOCUMENTS.terms, LEGAL_DOCUMENTS.privacy].map(document => ({
            org_id: orgId,
            actor_user_id: userId,
            document_type: document.type,
            document_version: document.version,
            document_identifier: document.identifier,
            document_path: document.path,
            acceptance_method: 'signup_checkbox',
            language_code: 'en',
            user_agent: userAgent,
        })),
    )
    if (acceptanceError) {
        // The profile delete cascades the pending request.
        await admin.from('profiles').delete().eq('id', userId)
        await admin.auth.admin.deleteUser(userId)
        return { error: 'joinFailed' }
    }

    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (signInError) return { error: 'joinedSignInFailed' }

    redirect(SUPERVISOR_HOME_PATH)
}
