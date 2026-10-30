import AccessGate from '@/components/billing/AccessGate'
import { requireRole } from '@/lib/auth'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { normalizeProductionMode } from '@/lib/production-mode'
import { SettingsBootstrapProvider } from '@/components/providers/settings-bootstrap-provider'
import QueryProvider from '@/components/query-provider'
import { createPrincipalCacheScope } from '@/lib/auth-cache-scope'
import { getFactoryCostProfile } from '@/app/(dashboard)/owner/estimator/actions'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    // Settings opens showing the costing defaults instead of requesting them
    // once it has hydrated. The read starts here, ahead of the access gate,
    // so it runs alongside the identity check (see getFactoryCostProfile);
    // the gate still decides whether anything is shown. If the read fails,
    // the page requests the defaults itself as before.
    const costProfileRead = getFactoryCostProfile({ createIfMissing: false }).catch(() => null)
    return (
        <AccessGate requiredCapability="account_data" routeName="/owner/settings">
            <SettingsDataLoader costProfileRead={costProfileRead}>{children}</SettingsDataLoader>
        </AccessGate>
    )
}

async function SettingsDataLoader({ costProfileRead, children }: {
    costProfileRead: Promise<Awaited<ReturnType<typeof getFactoryCostProfile>> | null>
    children: React.ReactNode
}) {
    const { user, profile } = await requireRole(['owner'])
    const [{ data: organization }, costProfileResult] = await Promise.all([
        getCachedOwnerOrganization(user.id, profile.org_id),
        costProfileRead,
    ])
    const costProfile = costProfileResult && 'data' in costProfileResult ? costProfileResult.data : undefined
    const cacheScope = createPrincipalCacheScope({
        userId: user.id,
        organizationId: profile.org_id,
    })

    return (
        <QueryProvider scope={cacheScope}>
            <SettingsBootstrapProvider
                profile={{
                    userId: user.id,
                    org_id: profile.org_id,
                    role: profile.role,
                    full_name: profile.full_name ?? null,
                    phone: profile.phone,
                    whatsapp_number: profile.whatsapp_number,
                    whatsapp_opted_in: profile.whatsapp_opted_in,
                }}
                organization={{
                    org_id: profile.org_id,
                    name: organization?.name ?? 'Weavly',
                    production_mode: normalizeProductionMode(organization?.production_mode),
                }}
                costProfile={costProfile === undefined ? undefined : costProfile && {
                    yarn_shortage_pct: costProfile.yarn_shortage_pct ?? null,
                    default_margin_pct: costProfile.default_margin_pct ?? null,
                    overhead_mode: costProfile.overhead_mode ?? null,
                    warping_mode: costProfile.warping_mode ?? null,
                    default_warping_mode: costProfile.default_warping_mode ?? null,
                    sizing_mode: costProfile.sizing_mode ?? null,
                    default_sizing_mode: costProfile.default_sizing_mode ?? null,
                    updated_at: costProfile.updated_at ?? null,
                }}
                account={{
                    email: user.email ?? '',
                    emailVerified: Boolean(user.email_confirmed_at),
                }}
            >
                {children}
            </SettingsBootstrapProvider>
        </QueryProvider>
    )
}
