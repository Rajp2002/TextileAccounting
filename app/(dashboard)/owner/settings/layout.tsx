import AccessGate from '@/components/billing/AccessGate'
import { requireRole } from '@/lib/auth'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { normalizeProductionMode } from '@/lib/production-mode'
import { SettingsBootstrapProvider } from '@/components/providers/settings-bootstrap-provider'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <AccessGate requiredTier="base">
            <SettingsDataLoader>{children}</SettingsDataLoader>
        </AccessGate>
    )
}

async function SettingsDataLoader({ children }: { children: React.ReactNode }) {
    const { user, profile } = await requireRole(['owner'])
    const { data: organization } = await getCachedOwnerOrganization(profile.org_id)

    return (
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
                join_code: organization?.join_code ?? null,
                join_code_expires_at: organization?.join_code_expires_at ?? null,
                production_mode: normalizeProductionMode(organization?.production_mode),
            }}
        >
            {children}
        </SettingsBootstrapProvider>
    )
}
