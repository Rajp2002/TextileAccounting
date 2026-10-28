// Three synthetic owners (Lite, Base, Free) with just enough rows for the
// owner and Free shells to resolve. Tables without rows answer [] so pages
// render their empty states; the harness measures waiting, not content.
const LITE = { userId: '11111111-1111-4111-8111-111111111111', orgId: 'aaaaaaaa-1111-4111-8111-111111111111' }
const BASE = { userId: '22222222-2222-4222-8222-222222222222', orgId: 'bbbbbbbb-2222-4222-8222-222222222222' }
const FREE = { userId: '33333333-3333-4333-8333-333333333333', orgId: 'cccccccc-3333-4333-8333-333333333333' }

export const ACCOUNTS = { lite: LITE, base: BASE, free: FREE }

const iso = offsetDays => new Date(Date.now() + offsetDays * 86_400_000).toISOString()
const day = offsetDays => iso(offsetDays).slice(0, 10)

function authUser({ userId, orgId }, label, extraAppMetadata = {}) {
    return {
        id: userId, aud: 'authenticated', role: 'authenticated', email: `${label}@perf-harness.test`,
        email_confirmed_at: iso(-120), phone: '', confirmed_at: iso(-120), last_sign_in_at: iso(-1),
        app_metadata: { provider: 'email', providers: ['email'], role: 'owner', org_id: orgId, onboarding_complete: true, ...extraAppMetadata },
        user_metadata: {
            full_name: `${label} owner`, factory_cost_wizard_dismissed: true, cost_estimate_tutorial_dismissed: true,
            tour_preferences: { dismissed_all: true },
        },
        identities: [], created_at: iso(-120), updated_at: iso(-1), is_anonymous: false,
    }
}

function organization({ userId, orgId }, name, extra = {}) {
    return {
        id: orgId, owner_id: userId, name, production_mode: 'combined', onboarding_complete: true,
        is_locked_down: false, base_plan_visible: true, lite_trial_eligible: false,
        base_onboarding: { status: 'completed' }, base_go_live_date: day(-60), created_at: iso(-120),
        org_subscriptions: [], ...extra,
    }
}

function subscription(orgId, tier) {
    return {
        id: `sub-${orgId}`, org_id: orgId, status: 'active', plan_tier: tier, plan_id: `${tier}_annual`,
        current_start: iso(-30), current_end: iso(335), razorpay_payment_id: `pay_${tier}`,
        razorpay_subscription_id: null, razorpay_order_id: `order_${tier}`, billing_model: 'annual_manual',
        cancel_at_cycle_end: false, paid_count: 1, total_count: 1, created_at: iso(-30), is_trial: false,
    }
}

export function buildFixtures() {
    const liteSub = subscription(LITE.orgId, 'lite')
    const baseSub = subscription(BASE.orgId, 'base')
    // A Free grant's subject is the owner's own user id.
    const freeSubject = FREE.userId
    const costProfile = orgId => ({
        id: `fcp-${orgId}`, factory_id: orgId, warping_rate_per_kg: 2, sizing_rate_per_kg: 1.5, winding_rate_per_kg: 0,
        overhead_pct: 0, overhead_mode: 'monthly_expenses', monthly_output_m: 0, overhead_items: [], overhead_override_per_m: null,
        default_commission_pct: 0, default_margin_pct: 10, default_transport_per_m: 0, yarn_review_interval_days: 90,
        yarn_shortage_pct: 2, loom_count: 0, monthly_working_days: 26, avg_output_per_loom_per_day: 50,
        enabled_sections: { winding: false, processing: false, finishing: false, commission: false }, updated_at: iso(-5),
    })

    return {
        authUsers: {
            [LITE.userId]: authUser(LITE, 'lite'),
            [BASE.userId]: authUser(BASE, 'base'),
            [FREE.userId]: authUser(FREE, 'free', { free_signup: true }),
        },
        tables: {
            profiles: [LITE, BASE, FREE].map(({ userId, orgId }, index) => ({
                id: userId, role: 'owner', org_id: orgId, full_name: ['Lite', 'Base', 'Free'][index] + ' owner',
                phone: null, whatsapp_number: null, whatsapp_opted_in: false, access_revoked_at: null,
            })),
            organizations: [
                organization(LITE, 'Lite Weaving Works', { org_subscriptions: [liteSub] }),
                organization(BASE, 'Base Weaving Works', { org_subscriptions: [baseSub] }),
                organization(FREE, 'Free Weaving Works', { lite_trial_eligible: false }),
            ],
            org_subscriptions: [liteSub, baseSub],
            factory_cost_profile: [costProfile(LITE.orgId), costProfile(BASE.orgId)],
            free_account_grants: [{ org_id: FREE.orgId, subject_id: freeSubject, revoked_at: null, free_account_subjects: { active: true, verified_at: iso(-100), beta_allowed: true } }],
            free_account_subjects: [{ id: freeSubject, active: true, verified_at: iso(-100), beta_allowed: true }],
            free_rollout: [{ singleton: true, enrollment_enabled: true, estimation_enabled: true, tour_enabled: false, free_quota_policies: { id: 'policy', version: 1, monthly_limit: 10, period: 'month', receipt_retention_days: 30 } }],
            base_payroll_cycle_configs: [{ id: 'cycle-base', org_id: BASE.orgId, cycle_type: 'monthly', cycle_start_day: 1, pay_day: 5, effective_from: day(-200), effective_until: null, created_at: iso(-200) }],
        },
        rpc: {
            free_server_time: () => new Date().toISOString(),
            // A committed Calculate receipt (shape only; the harness times the wait).
            complete_free_saved_costing: () => ({ used: 1, allowance: 10, remaining: 9, savedCostingId: 'dddddddd-3333-4333-8333-333333333333', editWindow: null, costingsUsed: 1 }),
            get_quality_stock_board: { qualities: [], movements: [] },
            get_supervisor_display_names: [],
        },
    }
}
