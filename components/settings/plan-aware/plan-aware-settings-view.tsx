'use client'

import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { SubscriptionTier } from '@/lib/subscription-access'
import { PersonalInformationCard } from './personal-information-card'
import { FactoryDetailsCard } from './factory-details-card'
import { CostingDefaultsCard, type CostingDefaultsData } from './costing-defaults-card'
import { PayrollCycleSettingsCard } from '../payroll/PayrollCycleSettingsCard'
import { type PayrollCycleConfig } from '@/lib/payroll-cycle-engine'
import { SecurityCard } from './security-card'
import { DeletionReviewCard } from './deletion-review-card'
import { SupervisorAccessCard } from '../supervisors/SupervisorAccessCard'
import { CompanyProfileCard } from './company-profile-card'
import { brandingText } from '@/lib/i18n/document-branding'
import { useUnloadProtection } from './unsaved-changes-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { freeSupportingText } from '@/lib/i18n/free-supporting'
import styles from './free-settings.module.css'
import liteStyles from './lite-settings.module.css'
import { liteSupportingText } from '@/lib/i18n/lite-supporting'
import {
    DEFAULT_STARTUP_INTRO_PREFERENCE, readStartupIntroPreference, saveStartupIntroPreference, STARTUP_INTRO_CHANGE_EVENT,
    type StartupIntroPreference,
} from '@/lib/intro/startup-preference'

function subscribeStartupPreference(onChange: () => void) {
    window.addEventListener('storage', onChange)
    window.addEventListener(STARTUP_INTRO_CHANGE_EVENT, onChange)
    return () => {
        window.removeEventListener('storage', onChange)
        window.removeEventListener(STARTUP_INTRO_CHANGE_EVENT, onChange)
    }
}

function currentStartupPreference() {
    try { return readStartupIntroPreference(window.localStorage) } catch { return null }
}

const serverStartupPreference = (): StartupIntroPreference => DEFAULT_STARTUP_INTRO_PREFERENCE

/** The same editors remain mounted; only optional mobile presentation folds. */
function FreeSettingsGroup({ compact, title, summary, dirty = false, anchor, children }: { compact: boolean; title: string; summary: string; dirty?: boolean; anchor?: string; children: React.ReactNode }) {
    // A link to this group's anchor (from the export dialog) arrives with it unfolded.
    const [open, setOpen] = useState(false)
    const contentId = useId()
    const content = useRef<HTMLDivElement>(null)
    const { language } = useTranslation()
    useEffect(() => {
        if (!compact || !anchor || window.location.hash !== `#${anchor}`) return
        let scroll = 0
        const frame = window.requestAnimationFrame(() => {
            setOpen(true)
            scroll = window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }))
        })
        return () => { window.cancelAnimationFrame(frame); window.cancelAnimationFrame(scroll) }
    }, [compact, anchor])
    useEffect(() => {
        if (!compact || !content.current) return
        // An async save can finish after a disclosure closes. Keep its error visible.
        const node = content.current
        const revealErrors = () => { if (node.querySelector('[role="alert"], [aria-invalid="true"]')) setOpen(true) }
        const observer = new MutationObserver(revealErrors)
        observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid', 'role'] })
        return () => observer.disconnect()
    }, [compact])
    if (!compact) return children
    return <section className={styles.group}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(value => value && content.current?.querySelector('[role="alert"], [aria-invalid="true"]') ? true : !value)}>
            <span className="min-w-0"><span className="text-sm font-semibold text-ink">{title}</span><span className={styles.summary}>{summary}</span>{dirty && <span className={styles.dirty}>{freeSupportingText(language, 'unsaved')}</span>}</span>
            {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        <div ref={content} id={contentId} className={open ? undefined : styles.closed}>{children}</div>
    </section>
}

function StartupIntroSetting() {
    const { t } = useTranslation()
    const preference = useSyncExternalStore(subscribeStartupPreference, currentStartupPreference, serverStartupPreference)
    const [saveFailed, setSaveFailed] = useState(false)
    const changePreference = (value: string) => {
        if (value !== 'first-launch' && value !== 'always' && value !== 'never') return
        let saved = false
        try { saved = saveStartupIntroPreference(window.localStorage, value) } catch { /* Unavailable device storage. */ }
        setSaveFailed(!saved)
        if (saved) window.dispatchEvent(new Event(STARTUP_INTRO_CHANGE_EVENT))
    }
    return <section aria-labelledby="startup-intro-heading" className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
                <h2 id="startup-intro-heading" className="text-base font-semibold text-ink">{t('common.startup_intro_title')}</h2>
                <p id="startup-intro-description" className="text-sm leading-relaxed text-muted-foreground">{t('common.startup_intro_body')}</p>
            </div>
            <Select value={preference ?? DEFAULT_STARTUP_INTRO_PREFERENCE} onValueChange={changePreference} disabled={preference === null}>
                <SelectTrigger aria-labelledby="startup-intro-heading" aria-describedby="startup-intro-description" className="min-h-11 w-full whitespace-normal text-left sm:w-auto sm:min-w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="first-launch">{t('common.startup_intro_first')}</SelectItem>
                    <SelectItem value="always">{t('common.startup_intro_always')}</SelectItem>
                    <SelectItem value="never">{t('common.startup_intro_never')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
        {(saveFailed || preference === null) && <p role="status" className="mt-3 text-sm text-risk">{t('common.startup_intro_error')}</p>}
    </section>
}

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
        isAuthorizedEditor?: boolean
    }
    tier: SubscriptionTier
    canEditDefaults: boolean
    initialDefaults?: CostingDefaultsData | null
    payrollCycleConfig?: PayrollCycleConfig | null
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
    payrollCycleConfig,
    onProfileNameChange,
    onFactoryNameChange,
    onDefaultsChange,
}: PlanAwareSettingsViewProps) {
    const { t, language } = useTranslation()

    const [confirmedName, setConfirmedName] = useState(profile.fullName)
    const [confirmedDefaults, setConfirmedDefaults] = useState<CostingDefaultsData | null>(null)
    const [personalDirty, setPersonalDirty] = useState(false)
    const [factoryDirty, setFactoryDirty] = useState(false)
    const [defaultsDirty, setDefaultsDirty] = useState(false)
    const [payrollDirty, setPayrollDirty] = useState(false)
    const [brandingDirty, setBrandingDirty] = useState(false)

    const isAnyDirty = personalDirty || factoryDirty || defaultsDirty || payrollDirty || brandingDirty
    useUnloadProtection(isAnyDirty)

    // Fallback defaults object when entitled but no database row exists yet
    const resolvedDefaults: CostingDefaultsData = (tier === 'lite' ? confirmedDefaults : null) ?? initialDefaults ?? {
        yarnShortagePct: 0,
        defaultMarginPct: 10,
        overheadMode: 'monthly_expenses',
        warpingMode: 'in_house',
        sizingMode: 'in_house',
        updatedAt: null,
    }

    return (
        <div className={cn('ui-route-enter w-full space-y-6', (tier === 'free' || tier === 'lite') && styles.root)}>
            {/* The same title row as the other workspace pages; the forms keep a readable width below it. */}
            <PageHeader title={t('settings.title') || 'Settings'} />
            <div className="w-full max-w-[960px]">
                {/* Ordered Sections Stack */}
                <main className="space-y-6">
                    {/* Section 1: Personal Information (Universal) */}
                    <FreeSettingsGroup compact={tier === 'free' || tier === 'lite'} title={freeSupportingText(language, 'personal')} summary={tier === 'lite' ? confirmedName : profile.fullName} dirty={personalDirty}><PersonalInformationCard
                        initialName={profile.fullName}
                        email={profile.email}
                        emailVerified={profile.emailVerified}
                        phone={profile.phone}
                        onNameUpdated={tier === 'lite' ? name => { setConfirmedName(name); onProfileNameChange?.(name) } : onProfileNameChange}
                        onDirtyChange={setPersonalDirty}
                    /></FreeSettingsGroup>

                    {/* Section 2: Factory Details (Where factory exists) */}
                    <FreeSettingsGroup compact={tier === 'free' || tier === 'lite'} title={freeSupportingText(language, 'factory')} summary={factory.name} dirty={factoryDirty}><FactoryDetailsCard
                        initialFactoryName={factory.name}
                        isAuthorizedEditor={factory.isAuthorizedEditor ?? true}
                        onFactoryNameUpdated={onFactoryNameChange}
                        onDirtyChange={setFactoryDirty}
                    /></FreeSettingsGroup>

                    {/* Section 3: Costing Defaults (Lite/Base Entitled; Omitted for Free) */}
                    {canEditDefaults && (
                        <FreeSettingsGroup compact={tier === 'lite'} title={liteSupportingText(language, 'defaults')} summary={`${resolvedDefaults.yarnShortagePct}% ${liteSupportingText(language, 'wastage')} · ${resolvedDefaults.defaultMarginPct}% ${liteSupportingText(language, 'margin')}`} dirty={defaultsDirty}><CostingDefaultsCard
                            initialDefaults={resolvedDefaults}
                            mobileFeedback={tier === 'lite'}
                            onDefaultsUpdated={tier === 'lite' ? defaults => { setConfirmedDefaults(defaults); onDefaultsChange?.(defaults) } : onDefaultsChange}
                            onDirtyChange={setDefaultsDirty}
                        /></FreeSettingsGroup>
                    )}

                    {/* Company profile and document branding (Lite/Base; the card re-checks entitlement) */}
                    {(tier === 'lite' || tier === 'base') && (
                        <FreeSettingsGroup compact={tier === 'lite'} anchor="company-profile" title={brandingText(language, 'companyProfileTitle')} summary={brandingText(language, 'companyProfileSummary')} dirty={brandingDirty}><CompanyProfileCard
                            onDirtyChange={setBrandingDirty}
                        /></FreeSettingsGroup>
                    )}

                    {/* Section 4: Production & Payroll */}
                    {tier === 'base' && <PayrollCycleSettingsCard
                        initialConfig={payrollCycleConfig ?? undefined}
                        isAuthorizedEditor={factory.isAuthorizedEditor ?? true}
                        onDirtyChange={setPayrollDirty}
                    />}
                    {tier === 'base' && <SupervisorAccessCard orgId={factory.id} factoryName={factory.name} />}
                    <FreeSettingsGroup compact={tier === 'free' || tier === 'lite'} title={freeSupportingText(language, 'security')} summary={profile.emailVerified ? profile.email : `${profile.email} · ${freeSupportingText(language, 'emailUnverified')}`}><SecurityCard email={profile.email} /></FreeSettingsGroup>
                    <FreeSettingsGroup compact={tier === 'free' || tier === 'lite'} title={freeSupportingText(language, 'display')} summary={freeSupportingText(language, 'device')}><StartupIntroSetting /></FreeSettingsGroup>

                    {/* Section 6: Account & Factory Deletion (Universal) */}
                    <DeletionReviewCard
                        organizationName={factory.name}
                        accountEmail={profile.email}
                        restoreMobileFocus={tier === 'free' || tier === 'lite'}
                        mobileExportHref={tier === 'lite' ? '/owner/data-export' : undefined}
                        mobileContentClassName={tier === 'lite' ? liteStyles.dialog : undefined}
                    />
                </main>
            </div>
        </div>
    )
}
