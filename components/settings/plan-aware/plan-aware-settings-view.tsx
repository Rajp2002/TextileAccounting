'use client'

import React, { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { SubscriptionTier } from '@/lib/subscription-access'
import { PersonalInformationCard } from './personal-information-card'
import { FactoryDetailsCard } from './factory-details-card'
import { CostingDefaultsCard, type CostingDefaultsData } from './costing-defaults-card'
import { SecurityCard } from './security-card'
import { DeletionReviewCard } from './deletion-review-card'
import { useUnloadProtection } from './unsaved-changes-dialog'

export interface PlanAwareSettingsViewProps {
    profile: {
        userId: string
        fullName: string
        email: string
        emailVerified?: boolean
        phone?: string | null
        role: string
    }
    factory: {
        id: string
        name: string
        joinCode?: string | null
        isAuthorizedEditor?: boolean
    }
    tier: SubscriptionTier
    canEditDefaults: boolean
    initialDefaults?: CostingDefaultsData | null
    onProfileNameChange?: (name: string) => void
    onFactoryNameChange?: (name: string) => void
    onDefaultsChange?: (defaults: CostingDefaultsData) => void
}

export function PlanAwareSettingsView({
    profile,
    factory,
    tier,
    canEditDefaults,
    initialDefaults,
    onProfileNameChange,
    onFactoryNameChange,
    onDefaultsChange,
}: PlanAwareSettingsViewProps) {
    const { t, tx } = useTranslation()

    const [personalDirty, setPersonalDirty] = useState(false)
    const [factoryDirty, setFactoryDirty] = useState(false)
    const [defaultsDirty, setDefaultsDirty] = useState(false)

    const isAnyDirty = personalDirty || factoryDirty || defaultsDirty
    useUnloadProtection(isAnyDirty)

    // Fallback defaults object when entitled but no database row exists yet
    const resolvedDefaults: CostingDefaultsData = initialDefaults ?? {
        yarnShortagePct: 0,
        defaultMarginPct: 10,
        overheadMode: 'monthly_expenses',
        warpingMode: 'in_house',
        sizingMode: 'in_house',
        updatedAt: null,
    }

    return (
        <div className="min-h-screen py-6 sm:py-10">
            <div className="mx-auto w-full max-w-[960px] space-y-8 px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <header className="space-y-2 border-b border-hairline/80 pb-6">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep dark:bg-saffron/20">
                            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                            {t('settings.title') || 'Settings'}
                        </h1>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {tx('Manage your account and the way your factory works.')}
                    </p>
                </header>

                {/* Ordered Sections Stack */}
                <main className="space-y-6 sm:space-y-8">
                    {/* Section 1: Personal Information (Universal) */}
                    <PersonalInformationCard
                        initialName={profile.fullName}
                        email={profile.email}
                        emailVerified={profile.emailVerified}
                        phone={profile.phone}
                        onNameUpdated={onProfileNameChange}
                        onDirtyChange={setPersonalDirty}
                    />

                    {/* Section 2: Factory Details (Where factory exists) */}
                    <FactoryDetailsCard
                        initialFactoryName={factory.name}
                        joinCode={factory.joinCode}
                        isAuthorizedEditor={factory.isAuthorizedEditor ?? true}
                        onFactoryNameUpdated={onFactoryNameChange}
                        onDirtyChange={setFactoryDirty}
                    />

                    {/* Section 3: Costing Defaults (Lite/Base Entitled; Omitted for Free) */}
                    {canEditDefaults && (
                        <CostingDefaultsCard
                            initialDefaults={resolvedDefaults}
                            onDefaultsUpdated={onDefaultsChange}
                            onDirtyChange={setDefaultsDirty}
                        />
                    )}

                    {/* Section 4: Production & Payroll (Conditional scope: Deferred per Section 9) */}

                    {/* Section 5: Security (Universal) */}
                    <SecurityCard email={profile.email} />

                    {/* Section 6: Account & Factory Deletion (Universal) */}
                    <DeletionReviewCard
                        organizationName={factory.name}
                        accountEmail={profile.email}
                    />
                </main>
            </div>
        </div>
    )
}
