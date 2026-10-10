import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
    return readFileSync(path, 'utf8')
}

describe('permanent account deletion guardrails', () => {
    const migration = source('supabase/migrations/20260808115518_20260808064552_permanently_delete_account_data.sql')
    const action = source('app/(dashboard)/owner/settings/account-deletion.ts')
    const card = source('components/settings/delete-account-card.tsx')
    const settings = source('app/(dashboard)/owner/settings/page.tsx')
    const oldExportAction = source('app/(dashboard)/owner/settings/data-export.ts')

    it('uses an owner-bound, transaction-local SECURITY DEFINER RPC for hard deletion', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.delete_account_permanently(')
        expect(migration).toContain('SECURITY DEFINER')
        expect(migration).toContain("SET search_path = ''")
        expect(migration).toContain('v_user_id uuid := auth.uid()')
        expect(migration).toContain("membership.role::text = 'owner'")
        expect(migration).toContain('organization.owner_id')
        expect(migration).toContain('pg_advisory_xact_lock')
        expect(migration).toContain("set_config('app.account_deletion', 'true', true)")
        expect(migration).toContain('DELETE FROM auth.users')
        expect(migration).toContain('DELETE FROM public.organizations')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.delete_account_permanently(text, text)')
        expect(migration).toContain('TO authenticated')
        expect(migration).toContain('FROM PUBLIC, anon')
    })

    it('covers cross-tenant references, legacy boundaries, and future org-scoped tables', () => {
        expect(migration).toContain('referral_discount_windows')
        expect(migration).toContain('referral_uses')
        expect(migration).toContain('referral_codes')
        expect(migration).toContain('machine_assignments')
        expect(migration).toContain('factory_cost_profile')
        expect(migration).toContain('supervisor_float_transactions')
        expect(migration).toContain("relation.relname NOT IN ('organizations', 'profiles', 'audit_log')")
        expect(migration).toContain("DELETE FROM public.audit_log")
        expect(migration).toContain("constraint_row.confrelid = 'public.profiles'::regclass")
        expect(migration).toContain("constraint_row.confrelid = 'auth.users'::regclass")
        expect(migration).toContain('Account-owned Storage files must be removed')
    })

    it('requires review for legacy provider references without changing financial records', () => {
        expect(action).toContain("const { profile, user } = await requireRole(['owner'], { allowFreeAccount: true })")
        expect(action).not.toContain('getRazorpay')
        expect(action).not.toContain('subscriptions.cancel')
        expect(action).toContain("not('razorpay_subscription_id', 'is', null)")
        expect(action).toContain('ACCOUNT_DELETION_REVIEW_MESSAGE')
        expect(action).not.toContain('cancellableSubscriptionStatuses')
        expect(action).toContain("supabase.rpc('delete_account_permanently'")
        expect(action).toContain('Nothing was removed')
        expect(action).toContain('getDestructiveLimiter')
        expect(action.indexOf("not('razorpay_subscription_id', 'is', null)"))
            .toBeLessThan(action.indexOf("supabase.rpc('delete_account_permanently'"))
    })

    it('requires two explicit confirmations and clears browser state before redirecting', () => {
        expect(card).toContain('ACCOUNT_DELETION_CONFIRMATION_PHRASE')
        expect(card).toContain('organizationName.trim()')
        expect(card).toContain('clearClientSessionState()')
        expect(card).toContain("window.location.assign('/login?account-deleted=1')")
        expect(card).toContain('Delete everything permanently')
    })

    it('wires the dangerous control into owner settings and removes the partial legacy action', () => {
        expect(settings).toContain("import('@/components/settings/delete-account-card')")
        expect(settings).toContain('<DeleteAccountCard organizationName={org?.name || \'\'} />')
        expect(oldExportAction).not.toContain('deleteOrganizationData')
    })
})
