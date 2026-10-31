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
        // The layout reads the defaults with the page (null: no profile yet).
        initialData: settingsBootstrap?.costProfile,
        staleTime: 1000 * 60 * 5,
    })
    const { data: payrollCycleData } = useQuery({
        queryKey: ['base_payroll_cycle_config', userProfile?.org_id],
        // The action rejects tiers without production, and the card is Base-only.
        enabled: !!userProfile?.org_id && hasCapability(tier, 'production'),
        queryFn: getBasePayrollCycleConfig,
        staleTime: 1000 * 60 * 5,
    })
    // The layout passes the verified account's email; ask Auth only without it.
    const bootstrapAccount = settingsBootstrap?.account
    const { data: authUser } = useQuery({
        queryKey: ['auth_user_details'],
        enabled: !bootstrapAccount,
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
                email: bootstrapAccount?.email ?? authUser?.email ?? '',
                emailVerified: bootstrapAccount?.emailVerified ?? !!authUser?.email_confirmed_at,
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
                <summary className="flex cursor-pointer list-none items-center gap-3.5 px-4 py-5 sm:px-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-subtle"><User className="size-[18px]" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1 space-y-1">
                        <h2 className="text-base font-semibold leading-tight text-ink">{tier === 'lite' ? liteSupportingText(language, 'accountData') : 'Account & data'}</h2>
                        {tier === 'lite' && <p className={`text-sm text-muted-foreground ${styles.mobileSummary}`}>{liteSupportingText(language, 'accountDataSummary')}</p>}
                        <p className={`text-sm text-muted-foreground ${tier === 'lite' ? styles.desktopSummary : ''}`}>Organization export, export history, and account deletion.</p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-4 border-t border-hairline px-4 py-5 sm:px-6">
                    <section id="privacy-data" className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Download className="h-4 w-4 text-subtle" aria-hidden="true" /> Download organization data</h3>
                            <p className="text-sm text-muted-foreground">Create an export of the factory records your account can access.</p>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2">
                                <Link href="/owner/data-export" className="inline-flex min-h-8 items-center text-xs font-semibold text-saffron-deep hover:underline">View export history</Link>
                                <Link href="/privacy-request" className="inline-flex min-h-8 items-center text-xs font-semibold text-saffron-deep hover:underline">Make a privacy or grievance request</Link>
                                <Link href="/security-incident" className="inline-flex min-h-8 items-center text-xs font-semibold text-saffron-deep hover:underline">Report a security incident</Link>
                            </div>
                        </div>
                        <div className="shrink-0"><OrganizationDataExportButton /></div>
                    </section>
                    <div id="account-deletion" className={tier === 'lite' ? styles.duplicateDeletion : undefined}><DeleteAccountCard organizationName={org?.name || ''} /></div>
                </div>
            </details>
        </div>
    </div>
}
