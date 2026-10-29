'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Download, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import { hasCapability } from '@/lib/subscription-access'
import { useSettingsBootstrap } from '@/components/providers/settings-bootstrap-provider'
import { PlanAwareSettingsView } from '@/components/settings/plan-aware/plan-aware-settings-view'
import { getFactoryCostProfile } from '@/app/(dashboard)/owner/estimator/actions'
import { getBasePayrollCycleConfig } from '@/app/(dashboard)/owner/production/actions'
import { RouteMilestones } from '@/components/performance/route-milestones'
import styles from './lite-settings.module.css'
import { useTranslation } from '@/lib/i18n/context'
import { liteSupportingText } from '@/lib/i18n/lite-supporting'
import { Skeleton } from '@/components/ui/skeleton'

type OrganizationSettings = {
    name: string
    production_mode: string | null
}

const OrganizationDataExportButton = dynamic(
    () => import('@/components/settings/organization-data-export-button').then(module => module.OrganizationDataExportButton),
    { ssr: false },
)
const DeleteAccountCard = dynamic(
    () => import('@/components/settings/delete-account-card').then(module => module.DeleteAccountCard),
    { ssr: false },
)

export default function SettingsPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const settingsBootstrap = useSettingsBootstrap()
    const tier = useOwnerPlan()
    const { language } = useTranslation()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()
    const [factoryName, setFactoryName] = useState('')

    const { data: org, isLoading: orgLoading } = useQuery({
        queryKey: ['organization', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('name, production_mode')
                .eq('id', userProfile!.org_id)
                .single()
            if (error) throw error
            return data as OrganizationSettings
        },
        initialData: settingsBootstrap?.organization
            ? {
                name: settingsBootstrap.organization.name,
                production_mode: settingsBootstrap.organization.production_mode,
            }
            : undefined,
        staleTime: 1000 * 60 * 5,
    })
    const { data: costProfileData } = useQuery({
        queryKey: ['factory_cost_profile', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const result = await getFactoryCostProfile({ createIfMissing: false })
            if (result.error) throw new Error(result.error)
            return result.data
        },
        staleTime: 1000 * 60 * 5,
    })
    const { data: payrollCycleData } = useQuery({
        queryKey: ['base_payroll_cycle_config', userProfile?.org_id],
        // The action rejects tiers without production, and the card is Base-only.
        enabled: !!userProfile?.org_id && hasCapability(tier, 'production'),
        queryFn: getBasePayrollCycleConfig,
        staleTime: 1000 * 60 * 5,
    })
    const { data: authUser } = useQuery({
        queryKey: ['auth_user_details'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            return user
        },
        staleTime: 1000 * 60 * 30,
    })

    if (profileLoading || orgLoading) {
        return <div className="settings-page-frame space-y-6">
            <div className="border-b border-hairline/70 pb-5 sm:pb-6">
                <Skeleton className="h-9 w-40" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-56 rounded-2xl" />
            </div>
        </div>
    }
    if (!userProfile) return null

    return <div className={`settings-page-frame space-y-6 ${tier === 'lite' ? styles.root : ''}`}>
        <RouteMilestones route="/owner/settings" shellVisible primaryUsable secondaryReady />
        <PlanAwareSettingsView
            profile={{
                userId: userProfile.id || userProfile.userId || '',
                fullName: userProfile.full_name || '',
                email: authUser?.email || '',
                emailVerified: !!authUser?.email_confirmed_at,
                phone: userProfile.phone,
                role: userProfile.role || 'owner',
            }}
            factory={{
                id: userProfile.org_id || '',
                name: factoryName || org?.name || '',
                isAuthorizedEditor: userProfile.role === 'owner' || userProfile.role === 'admin',
            }}
            tier={tier}
            canEditDefaults
            initialDefaults={costProfileData ? {
                yarnShortagePct: Number(costProfileData.yarn_shortage_pct ?? 0),
                defaultMarginPct: Number(costProfileData.default_margin_pct ?? 10),
                overheadMode: costProfileData.overhead_mode === 'direct' ? 'direct' : 'monthly_expenses',
                warpingMode: (costProfileData.default_warping_mode ?? costProfileData.warping_mode ?? 'in_house') as 'in_house' | 'outsourced',
                sizingMode: (costProfileData.default_sizing_mode ?? costProfileData.sizing_mode ?? 'in_house') as 'in_house' | 'outsourced',
                updatedAt: costProfileData.updated_at,
            } : null}
            payrollCycleConfig={payrollCycleData ?? null}
            onFactoryNameChange={(newName) => {
                setFactoryName(newName)
                queryClient.setQueryData(['organization', userProfile.org_id], (previous: OrganizationSettings | undefined) =>
                    previous ? { ...previous, name: newName } : previous
                )
            }}
            onDefaultsChange={() => queryClient.invalidateQueries({ queryKey: ['factory_cost_profile'] })}
        />
        <div>
            <details id="account-data" className="ui-details group overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                <summary className="relative flex cursor-pointer list-none items-center justify-center gap-4 px-12 py-4 text-center">
                    <div className="min-w-0">
                        <div className="flex items-center justify-center gap-2"><User className="h-4 w-4" /><h2 className="text-base font-semibold text-ink">{tier === 'lite' ? liteSupportingText(language, 'accountData') : 'Account & data'}</h2></div>
                        {tier === 'lite' && <p className={`mt-1 text-sm text-muted-foreground ${styles.mobileSummary}`}>{liteSupportingText(language, 'accountDataSummary')}</p>}
                        <p className={`mt-1 text-sm text-muted-foreground ${tier === 'lite' ? styles.desktopSummary : ''}`}>Organization export, export history, and account deletion.</p>
                    </div>
                    <ChevronDown className="absolute right-4 h-4 w-4 transition-transform group-open:rotate-180 sm:right-5" />
                </summary>
                <div className="space-y-4 border-t border-hairline px-4 py-4 sm:px-5">
                    <section id="privacy-data" className="rounded-xl border border-hairline p-5 text-center">
                        <h3 className="flex items-center justify-center gap-2 font-semibold"><Download className="h-4 w-4" /> Download organization data</h3>
                        <p className="mt-2 text-sm text-muted-foreground">Create an export of the factory records your account can access.</p>
                        <div className="mt-4"><OrganizationDataExportButton centered /></div>
                        <Link href="/owner/data-export" className="mt-3 inline-flex text-xs font-semibold text-saffron-deep hover:underline">View export history</Link>
                        <Link href="/privacy-request" className="mt-3 block text-xs font-semibold text-saffron-deep hover:underline">Make a privacy or grievance request</Link>
                        <Link href="/security-incident" className="mt-3 block text-xs font-semibold text-saffron-deep hover:underline">Report a security incident</Link>
                    </section>
                    <div id="account-deletion" className={tier === 'lite' ? styles.duplicateDeletion : undefined}><DeleteAccountCard organizationName={org?.name || ''} /></div>
                </div>
            </details>
        </div>
    </div>
}
