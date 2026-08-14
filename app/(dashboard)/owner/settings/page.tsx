'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
    AlertTriangle,
    CheckCircle2,
    Calculator,
    ChevronDown,
    Copy,
    CreditCard,
    Download,
    Factory,
    KeyRound,
    Loader2,
    MessageSquare,
    RefreshCw,
    ShieldCheck,
    SlidersHorizontal,
    Smartphone,
    User,
    Users,
    XCircle,
    type LucideIcon,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { toast, userFacingError } from '@/lib/app-notifications'
import { regenerateJoinCode } from '@/app/(auth)/actions/auth'
import { updateOrganizationName, updateOrganizationProductionMode, updateOrganizationProductExperience } from '@/app/(dashboard)/owner/actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRODUCTION_MODE_OPTIONS, getProductionModeOption, normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useOwnerPlanAccess } from '@/components/providers/owner-plan-provider'
import { useSettingsBootstrap } from '@/components/providers/settings-bootstrap-provider'
import { tierSatisfies } from '@/lib/subscription-access'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { PageHeader } from '@/components/ui/page-header'

const SettingsCardLoading = () => <div className="min-h-24 animate-pulse rounded-lg border border-hairline bg-surface-soft/55" />

// These named component paths remain explicit for the settings security
// guardrails while the below-fold controls themselves stay out of the initial
// JavaScript graph:
// import { OrganizationDataExportButton } from '@/components/settings/organization-data-export-button'
// import { DeleteAccountCard } from '@/components/settings/delete-account-card'

const AccessCodeGenerator = dynamic(
    () => import('@/components/AccessCodeGenerator').then(module => module.AccessCodeGenerator),
    { ssr: false, loading: SettingsCardLoading },
)
const WhatsAppOptIn = dynamic(
    () => import('@/components/settings/WhatsAppOptIn').then(module => module.WhatsAppOptIn),
    { ssr: false, loading: SettingsCardLoading },
)
const OrganizationDataExportButton = dynamic(
    () => import('@/components/settings/organization-data-export-button').then(module => module.OrganizationDataExportButton),
    { ssr: false, loading: SettingsCardLoading },
)
const DeleteAccountCard = dynamic(
    () => import('@/components/settings/delete-account-card').then(module => module.DeleteAccountCard),
    { ssr: false, loading: SettingsCardLoading },
)
const FactoryCostProfile = dynamic(
    () => import('@/components/settings/factory-cost-profile').then(module => module.FactoryCostProfile),
    { ssr: false, loading: SettingsCardLoading },
)
const TemplateManager = dynamic(
    () => import('@/components/settings/template-manager').then(module => module.TemplateManager),
    { ssr: false, loading: SettingsCardLoading },
)
const SupervisorAccessManager = dynamic(
    () => import('@/components/settings/supervisor-access-manager').then(module => module.SupervisorAccessManager),
    { ssr: false, loading: SettingsCardLoading },
)

// ─── Helper Components ────────────────────────────────────────────────────────

type OrganizationSettings = {
    name: string
    join_code: string | null
    join_code_expires_at: string | null
    production_mode: ProductionMode | null
}

function getErrorMessage(error: unknown, fallback: string) {
    return userFacingError(error, fallback)
}

function formatDate(date: string | null | undefined) {
    if (!date) return 'Not set'
    return `${new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })} IST`
}

function SettingsSection({
    id,
    title,
    icon: Icon,
    children,
    collapsible = false,
    summary,
    open,
    onToggle,
}: {
    id: string
    title: string
    icon: LucideIcon
    children: ReactNode
    collapsible?: boolean
    summary?: string
    open?: boolean
    onToggle?: (open: boolean) => void
}) {
    const heading = (
        <>
            <Icon className="h-4 w-4 text-subtle" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
        </>
    )

    if (collapsible) {
        return (
            <details
                id={id}
                open={open}
                onToggle={event => onToggle?.(event.currentTarget.open)}
                className="premium-disclosure-card group scroll-mt-6 space-y-3 rounded-lg"
            >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-hairline/80 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">{heading}</div>
                        {summary && <p className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">{summary}</p>}
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="premium-disclosure-content">{children}</div>
            </details>
        )
    }

    return (
        <section id={id} className="scroll-mt-6 space-y-3">
            <div className="flex items-center gap-2 border-b border-hairline/80 pb-2">
                {heading}
            </div>
            {children}
        </section>
    )
}

function SettingsCategory({
    title,
    description,
    icon: Icon,
    children,
}: {
    title: string
    description: string
    icon: LucideIcon
    children: ReactNode
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 border-b border-hairline/80 pb-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                    <Icon className="h-4 w-4" />
                </span>
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
                    <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
            </div>
            {children}
        </div>
    )
}

function SettingsPanel({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={cn(
                'premium-disclosure-card rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]',
                className
            )}
        >
            {children}
        </div>
    )
}

function PanelHeading({
    icon: Icon,
    title,
    description,
    className,
}: {
    icon: LucideIcon
    title: string
    description?: string
    className?: string
}) {
    return (
        <div className={cn('space-y-1', className)}>
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-saffron" />
                <h3 className="text-base font-semibold leading-tight text-ink">{title}</h3>
            </div>
            {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
    )
}

export default function SettingsPage() {
    const { t, tx } = useTranslation()
    const router = useRouter()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const settingsBootstrap = useSettingsBootstrap()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()
    const planAccess = useOwnerPlanAccess()
    const subscriptionTier = planAccess.effectiveTier
    const hasPremium = tierSatisfies(subscriptionTier, 'premium')
    const isBaseExperience = subscriptionTier === 'base'

    const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
    const [factoryName, setFactoryName] = useState('')
    const [isEditingName, setIsEditingName] = useState(false)
    const [workspaceOpen, setWorkspaceOpen] = useState(false)

    // Fetch organization details on the client
    const { data: org, isLoading: orgLoading } = useQuery({
        queryKey: ['organization', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('name, join_code, join_code_expires_at, production_mode')
                .eq('id', userProfile!.org_id)
                .single()
            if (error) throw error
            return data
        },
        // The settings layout already resolved these values on the server.
        // Keep the query for post-mutation refreshes, but avoid the cold-load
        // profile → organization waterfall.
        initialData: settingsBootstrap?.organization
            ? {
                name: settingsBootstrap.organization.name,
                join_code: settingsBootstrap.organization.join_code,
                join_code_expires_at: settingsBootstrap.organization.join_code_expires_at,
                production_mode: settingsBootstrap.organization.production_mode,
            }
            : undefined,
        staleTime: 1000 * 60 * 5,
    })

    // Update factory name mutation
    const updateNameMutation = useMutation({
        mutationFn: async (newName: string) => {
            const result = await updateOrganizationName(newName)
            if (result.error) throw new Error(result.error)
            return result
        },
        onSuccess: (_result, newName) => {
            queryClient.invalidateQueries({ queryKey: ['organization'] })
            setFactoryName(newName)
            setIsEditingName(false)
            toast.success(tx('Factory name updated successfully'))
        },
        onError: (err: unknown) => {
            toast.error(tx(getErrorMessage(err, 'Failed to update name')))
        }
    })

    // Regenerate join code mutation
    const regenerateMutation = useMutation({
        mutationFn: async () => {
            const result = await regenerateJoinCode()
            if ('error' in result) throw new Error(result.error)
            return result
        },
        onSuccess: (data) => {
            // Optimistic update — don't wait for refetch
            queryClient.setQueryData(['organization', userProfile?.org_id], (old: OrganizationSettings | undefined) => ({
                ...old,
                join_code: data.joinCode,
                join_code_expires_at: data.expiresAt,
            }))
            setRegenerateDialogOpen(false)
            toast.success(tx('Join code regenerated. The old code is now invalid.'))
        },
        onError: (err: unknown) => {
            toast.error(tx(getErrorMessage(err, 'Failed to regenerate code')))
        }
    })

    const updateProductionModeMutation = useMutation({
        mutationFn: async (productionMode: ProductionMode) => {
            const result = await updateOrganizationProductionMode(productionMode)
            if (result.error) throw new Error(result.error)
            return result
        },
        onSuccess: (_result, productionMode) => {
            queryClient.setQueryData(['organization', userProfile?.org_id], (old: OrganizationSettings | undefined) =>
                old ? { ...old, production_mode: productionMode } : old
            )
            queryClient.invalidateQueries({ queryKey: ['organization'] })
            toast.success(tx('Production mode updated'))
        },
        onError: (err: unknown) => {
            toast.error(tx(getErrorMessage(err, 'Failed to update production mode')))
        }
    })

    const updateProductExperienceMutation = useMutation({
        mutationFn: async (productExperience: 'base' | 'full_suite') => {
            const result = await updateOrganizationProductExperience(productExperience)
            if (result.error) throw new Error(result.error)
            return result
        },
        onSuccess: (_result, productExperience) => {
            toast.success(tx(productExperience === 'base'
                ? 'Base Plan workspace is now active'
                : 'Full Suite workspace is now active'))
            router.refresh()
        },
        onError: (err: unknown) => {
            toast.error(tx(getErrorMessage(err, 'Failed to switch workspace experience')))
        }
    })

    const isLoading = profileLoading || orgLoading
    const currentFactoryName = isEditingName ? factoryName : (factoryName || org?.name || '')

    useEffect(() => {
        if (!planAccess.canSwitchExperience || isLoading) return

        const openWorkspaceFromHash = () => {
            if (window.location.hash !== '#workspace-experience') return

            setWorkspaceOpen(true)
            window.setTimeout(() => {
                const section = document.getElementById('workspace-experience')
                if (!section) return
                section.scrollIntoView({ block: 'start', behavior: 'smooth' })
                const summary = section.querySelector('summary')
                if (summary instanceof HTMLElement) summary.focus({ preventScroll: true })
            }, 0)
        }

        openWorkspaceFromHash()
        window.addEventListener('hashchange', openWorkspaceFromHash)
        return () => window.removeEventListener('hashchange', openWorkspaceFromHash)
    }, [isLoading, planAccess.canSwitchExperience])

    if (isLoading) {
        return (
            <div className="settings-page-frame settings-readable space-y-5">
                <div className="flex items-end justify-between border-b border-hairline/80 pb-5">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="hidden h-9 w-24 sm:block" />
                </div>
                <div className="settings-layout-grid">
                    <div className="space-y-5">
                        {[1, 2, 3].map(section => (
                            <div key={section} className="space-y-3">
                                <Skeleton className="h-5 w-44" />
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <Skeleton className="h-56 rounded-lg" />
                                    <Skeleton className="h-56 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <Skeleton className="settings-right-rail h-96 rounded-lg" />
                </div>
            </div>
        )
    }

    if (!userProfile) return null

    const productionMode = normalizeProductionMode(org?.production_mode)
    const productionModeOption = getProductionModeOption(org?.production_mode)
    const isWhatsAppActive = userProfile.whatsapp_opted_in ?? false

    function copyJoinCode() {
        if (!org?.join_code) return
        navigator.clipboard.writeText(org.join_code)
        toast.success(tx('Join code copied!'))
    }

    function refreshSettings() {
        queryClient.invalidateQueries({ queryKey: ['organization'] })
        queryClient.invalidateQueries({ queryKey: ['user_profile_id'] })
        toast.success(tx('Settings refreshed'))
    }

    // Base is a costing desk, not a factory-operations console. Keep its
    // settings path focused on the inputs that change a new estimate, and put
    // infrequent account/data actions behind one low-frequency disclosure.
    if (isBaseExperience) {
        return (
            <div className="premium-route-enter settings-page-frame settings-readable">
                <RouteMilestones route="/owner/settings" shellVisible primaryUsable secondaryReady />
                <PageHeader
                    id="overview"
                    eyebrow="Estimator Plan"
                    icon={SlidersHorizontal}
                    title={t('settings.title')}
                    description="Set the defaults used when you create a new Cost Estimate. Saved Costings keep the values captured when they were saved."
                    actions={(
                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="saffron" className="w-fit gap-2">
                                <Link href="/owner/estimator">
                                    <Calculator className="h-4 w-4" />
                                    Open Cost Estimate
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-fit gap-2" onClick={refreshSettings}>
                                <RefreshCw className="h-4 w-4" />
                                {tx('Refresh')}
                            </Button>
                        </div>
                    )}
                />

                <div className="mt-6 max-w-5xl space-y-8">
                    <SettingsCategory
                        title="Cost Estimate Setup"
                        description="Set this up once, then return only when yarn rates, monthly expenses, or your pricing approach changes."
                        icon={Calculator}
                    >
                        <SettingsSection id="cost-profile" title="Default costing inputs" icon={Calculator}>
                            <FactoryCostProfile standaloneEstimator />
                        </SettingsSection>
                        <SettingsSection id="qualities" title="Saved fabric qualities" icon={ShieldCheck} collapsible>
                            <TemplateManager />
                        </SettingsSection>
                    </SettingsCategory>

                    <SettingsCategory
                        title="Business identity"
                        description="Used on documents generated after this change. Saved costing values, versions, and history are unchanged."
                        icon={Factory}
                    >
                        <SettingsSection id="factory-identity" title="Business name" icon={Factory}>
                            <SettingsPanel className="p-5 sm:p-6">
                                <PanelHeading
                                    icon={Factory}
                                    title="Business name"
                                    description="Used on documents generated after this change. Saved costing values, versions, and history are unchanged."
                                />
                                <div className="mt-5 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label>Business name</Label>
                                        {currentFactoryName !== org?.name && !isEditingName && (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 font-semibold"
                                                onClick={() => updateNameMutation.mutate(currentFactoryName)}
                                                disabled={updateNameMutation.isPending}
                                            >
                                                {updateNameMutation.isPending ? 'Saving...' : 'Save changes'}
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={currentFactoryName}
                                            onChange={(event) => {
                                                setIsEditingName(true)
                                                setFactoryName(event.target.value)
                                            }}
                                            className="flex-1 border-hairline bg-canvas/80"
                                            placeholder="Enter business name"
                                            disabled={updateNameMutation.isPending}
                                        />
                                        {currentFactoryName !== org?.name && (
                                            <Button
                                                variant="saffron"
                                                size="sm"
                                                onClick={() => updateNameMutation.mutate(currentFactoryName)}
                                                disabled={updateNameMutation.isPending}
                                            >
                                                {updateNameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </SettingsPanel>
                        </SettingsSection>
                    </SettingsCategory>

                    <details id="account-data" className="premium-disclosure-card group overflow-hidden rounded-xl border border-hairline bg-surface/80">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden sm:px-5">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-subtle" />
                                    <h2 className="text-base font-bold text-ink">Account & data</h2>
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Owner profile, password, organization export, export history, and account deletion.</p>
                            </div>
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>

                        <div className="premium-disclosure-content space-y-5 border-t border-hairline/70 px-4 pb-5 pt-5 sm:px-5">
                            <SettingsPanel className="p-5 sm:p-6">
                                <PanelHeading
                                    icon={User}
                                    title="Owner account"
                                    description="Your registered profile is read-only here and is used for account ownership and support context."
                                />
                                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Full name</Label>
                                        <Input value={userProfile.full_name || ''} readOnly className="border-hairline bg-surface-soft/55" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone number</Label>
                                        <Input value={userProfile.phone || ''} readOnly className="border-hairline bg-surface-soft/55" />
                                    </div>
                                    <div className="flex items-end">
                                        <div className="flex w-full items-center gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-success">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wide">Role: {userProfile.role}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button asChild variant="outline" size="sm" className="mt-4 gap-2">
                                    <Link href="/forgot-password">
                                        <KeyRound className="h-4 w-4" />
                                        Password & Security
                                    </Link>
                                </Button>
                            </SettingsPanel>

                            <SettingsSection id="privacy-data" title="Export & privacy" icon={Download}>
                                <SettingsPanel className="p-5 sm:p-6">
                                    <PanelHeading
                                        icon={Download}
                                        title="Download your organization data"
                                        description="Create a structured export of the factory records your account is allowed to access. Sensitive authentication fields are excluded or redacted."
                                    />
                                    <div className="mt-5">
                                        <OrganizationDataExportButton />
                                        <Link href="/owner/data-export" className="mt-3 inline-flex text-xs font-semibold text-saffron-deep hover:text-saffron">
                                            View export history
                                        </Link>
                                    </div>
                                </SettingsPanel>
                            </SettingsSection>

                            <SettingsSection id="account-deletion" title="Delete workspace" icon={AlertTriangle}>
                                <DeleteAccountCard organizationName={org?.name || ''} />
                            </SettingsSection>
                        </div>
                    </details>

                    {planAccess.canSwitchExperience && (
                        <SettingsSection
                            id="workspace-experience"
                            title="Advanced workspace"
                            icon={SlidersHorizontal}
                            collapsible
                            summary="Choose which workspace experience to use. This does not change your subscription."
                            open={workspaceOpen}
                            onToggle={setWorkspaceOpen}
                        >
                            <SettingsPanel className="p-5 sm:p-6">
                                <PanelHeading
                                    icon={SlidersHorizontal}
                                    title="Workspace experience"
                                    description="Choose which workspace experience to use. This changes the working experience, not billing or subscription entitlement."
                                />
                                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {([
                                        {
                                            value: 'base' as const,
                                            title: 'Base experience',
                                            description: 'Cost Estimates, Saved Costings, Yarn Rate Book, settings, and billing.',
                                        },
                                        {
                                            value: 'full_suite' as const,
                                            title: 'Full Suite experience',
                                            description: 'All factory, production, workforce, stock, dispatch, and costing workflows.',
                                        },
                                    ]).map((option) => {
                                        const selected = planAccess.productExperience === option.value
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={selected}
                                                disabled={updateProductExperienceMutation.isPending}
                                                onClick={() => {
                                                    if (!selected) updateProductExperienceMutation.mutate(option.value)
                                                }}
                                                className={cn(
                                                    'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 disabled:cursor-wait disabled:opacity-70',
                                                    selected
                                                        ? 'border-saffron bg-saffron-soft/60'
                                                        : 'border-hairline bg-canvas/70 hover:border-saffron/50 hover:bg-saffron-soft/25'
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="font-semibold text-ink">{tx(option.title)}</span>
                                                    {selected ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {tx('Active')}
                                                        </span>
                                                    ) : updateProductExperienceMutation.isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : null}
                                                </div>
                                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tx(option.description)}</p>
                                            </button>
                                        )
                                    })}
                                </div>
                                <p className="mt-4 rounded-lg border border-info/20 bg-info-soft/55 p-3 text-sm leading-relaxed text-info">
                                    {tx('Existing production and factory records are never deleted. Switch back to Full Suite at any time to use them again.')}
                                </p>
                            </SettingsPanel>
                        </SettingsSection>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="premium-route-enter settings-page-frame settings-readable">
            <RouteMilestones route="/owner/settings" shellVisible primaryUsable secondaryReady />
            <PageHeader
                id="overview"
                icon={SlidersHorizontal}
                title={t('settings.title')}
                description={hasPremium ? t('settings.subtitle') : 'Recommended defaults, business information, personal information, and advanced options.'}
                actions={(
                    <Button variant="outline" className="w-fit gap-2" onClick={refreshSettings}>
                        <RefreshCw className="h-4 w-4" />
                        {tx('Refresh')}
                    </Button>
                )}
            />

            <div className="settings-layout-grid">
                <div className="min-w-0 space-y-8">
                    <SettingsCategory
                        title="Recommended Defaults"
                        description="Start with the setup Weavly will use for new Cost Estimates. Existing saved costings keep their original numbers."
                        icon={Calculator}
                    >
                        <SettingsSection id="cost-profile" title={hasPremium ? 'Production Cost Estimates & Templates' : 'Estimator Defaults'} icon={Factory}>
                            <FactoryCostProfile standaloneEstimator={!hasPremium} />
                        </SettingsSection>
                        <SettingsSection id="qualities" title="Saved Fabric Qualities" icon={ShieldCheck} collapsible>
                            <TemplateManager />
                        </SettingsSection>
                    </SettingsCategory>

                    <SettingsCategory
                        title="Business Information"
                        description="Keep the name and factory access details used across your costing documents and team setup."
                        icon={Factory}
                    >
                        <SettingsSection id="factory-identity" title={hasPremium ? 'Factory & Identity' : 'Business & Profile'} icon={Factory}>
                            <SettingsPanel className="p-5 sm:p-6">
                                <PanelHeading
                                    icon={Factory}
                                    title={hasPremium ? t('settings.factory.title') : 'Business details'}
                                    description={hasPremium ? t('settings.factory.desc') : 'Used to identify and brand your saved costings.'}
                                />

                                <div className="mt-5 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label>{hasPremium ? t('settings.factory.name') : 'Business Name'}</Label>
                                        {currentFactoryName !== org?.name && !isEditingName && (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 font-semibold"
                                                onClick={() => updateNameMutation.mutate(currentFactoryName)}
                                                disabled={updateNameMutation.isPending}
                                            >
                                                {updateNameMutation.isPending ? 'Saving...' : 'Save Changes'}
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={currentFactoryName}
                                            onChange={(e) => {
                                                setIsEditingName(true)
                                                setFactoryName(e.target.value)
                                            }}
                                            className="flex-1 border-hairline bg-canvas/80"
                                            placeholder="Enter business name"
                                            disabled={updateNameMutation.isPending}
                                        />
                                        {currentFactoryName !== org?.name && (
                                            <Button
                                                variant="saffron"
                                                size="sm"
                                                onClick={() => updateNameMutation.mutate(currentFactoryName)}
                                                disabled={updateNameMutation.isPending}
                                            >
                                                {updateNameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {hasPremium && <div className="mt-5 space-y-3">
                                    <Label>Factory join code</Label>
                                    <div className="rounded-lg border border-info/20 bg-info-soft/55 p-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <p className="min-w-[150px] flex-1 truncate font-mono text-2xl font-bold tracking-[0.26em] text-info">
                                                {org?.join_code || '—'}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-info/25 bg-surface text-info hover:bg-info-soft"
                                                    onClick={copyJoinCode}
                                                    disabled={!org?.join_code}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                    Copy
                                                </Button>
                                                <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="border-saffron/30 bg-surface text-saffron-deep hover:bg-saffron-soft"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                            Regenerate
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-[420px]">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center gap-2 text-saffron-deep">
                                                                <AlertTriangle className="h-5 w-5" />
                                                                Regenerate join code?
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                This will invalidate the current code immediately. Any supervisor currently signing up with the old code will need the new one.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <DialogFooter>
                                                            <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                variant="saffron"
                                                                disabled={regenerateMutation.isPending}
                                                                onClick={() => regenerateMutation.mutate()}
                                                            >
                                                                {regenerateMutation.isPending ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<RefreshCw className="h-4 w-4" />)}
                                                                {regenerateMutation.isPending ? 'Regenerating...' : 'Yes, regenerate'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                        <p className="mt-3 text-xs font-medium text-info">
                                            Expires: {formatDate(org?.join_code_expires_at)}
                                        </p>
                                    </div>
                                </div>}
                            </SettingsPanel>
                        </SettingsSection>
                    </SettingsCategory>

                    <SettingsCategory
                        title="Personal Information"
                        description="Your registered profile is read-only here; it is used for account ownership and support context."
                        icon={User}
                    >
                        <SettingsSection id="personal-information" title="Personal Information" icon={User}>
                            <SettingsPanel className="p-5 sm:p-6">
                                <PanelHeading
                                    icon={User}
                                    title={t('settings.personal.title')}
                                    description="View your registered profile details"
                                />
                                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>{t('settings.personal.name')}</Label>
                                        <Input value={userProfile.full_name || ''} readOnly className="border-hairline bg-surface-soft/55" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('settings.personal.phone')}</Label>
                                        <Input value={userProfile.phone || ''} readOnly className="border-hairline bg-surface-soft/55" />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-success">
                                    <ShieldCheck className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wide">
                                        {t('settings.personal.role')} {userProfile.role}
                                    </span>
                                </div>
                            </SettingsPanel>
                        </SettingsSection>
                    </SettingsCategory>

                    <SettingsCategory
                        title="Advanced Options"
                        description="Controls for team access, workflow visibility, privacy, and account maintenance. Most Base users can leave these unchanged."
                        icon={KeyRound}
                    >
                        {planAccess.canSwitchExperience && (
                            <SettingsSection id="workspace-experience" title="Workspace Experience" icon={SlidersHorizontal}>
                                <SettingsPanel className="p-5 sm:p-6">
                                    <PanelHeading
                                        icon={SlidersHorizontal}
                                        title="Choose the workspace for this rollout"
                                        description="Your paid Full Suite plan stays active. This setting only changes which product experience the organization uses."
                                    />
                                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {([
                                            {
                                                value: 'base' as const,
                                                title: 'Base Plan',
                                                description: 'Cost Estimates, Saved Costings, Yarn Rate Book, settings, and billing.',
                                            },
                                            {
                                                value: 'full_suite' as const,
                                                title: 'Full Suite',
                                                description: 'All factory, production, workforce, stock, dispatch, and costing workflows.',
                                            },
                                        ]).map((option) => {
                                            const selected = planAccess.productExperience === option.value
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    aria-pressed={selected}
                                                    disabled={updateProductExperienceMutation.isPending}
                                                    onClick={() => {
                                                        if (!selected) updateProductExperienceMutation.mutate(option.value)
                                                    }}
                                                    className={cn(
                                                        'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 disabled:cursor-wait disabled:opacity-70',
                                                        selected
                                                            ? 'border-saffron bg-saffron-soft/60'
                                                            : 'border-hairline bg-canvas/70 hover:border-saffron/50 hover:bg-saffron-soft/25'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-semibold text-ink">{tx(option.title)}</span>
                                                        {selected ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                {tx('Active')}
                                                            </span>
                                                        ) : updateProductExperienceMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tx(option.description)}</p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <p className="mt-4 rounded-lg border border-info/20 bg-info-soft/55 p-3 text-sm leading-relaxed text-info">
                                        {tx('Existing production and factory records are never deleted. Switch back to Full Suite at any time to use them again.')}
                                    </p>
                                </SettingsPanel>
                            </SettingsSection>
                        )}

                        {hasPremium && (
                            <SettingsSection id="supervisors-access" title="Supervisors & Access" icon={Users}>
                                <SupervisorAccessManager factoryName={org?.name || 'This factory'} />
                            </SettingsSection>
                        )}

                        {hasPremium && <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <SettingsSection id="production-mode" title="Production Mode" icon={SlidersHorizontal}>
                                <SettingsPanel className="h-full p-5 sm:p-6">
                                    <PanelHeading
                                        icon={SlidersHorizontal}
                                        title="Production Mode"
                                        description="Choose which workflows Weavly shows first for this factory."
                                    />
                                    <div className="mt-5 space-y-4">
                                        <div className="space-y-2">
                                            <Label>Production workflow</Label>
                                            <Select
                                                value={productionMode}
                                                onValueChange={(value) => updateProductionModeMutation.mutate(value as ProductionMode)}
                                                disabled={updateProductionModeMutation.isPending}
                                            >
                                                <SelectTrigger className="w-full border-hairline bg-canvas/80">
                                                    <SelectValue placeholder="Select production mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PRODUCTION_MODE_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.settingsLabel}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {productionModeOption.description}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-warning/25 bg-warning-soft/80 p-3 text-sm leading-relaxed text-warning">
                                            Changing this only adjusts which workflows are shown. Existing quotes, orders, market runs, stock, and dispatches will not be deleted.
                                        </div>
                                    </div>
                                </SettingsPanel>
                            </SettingsSection>

                            <SettingsSection id="security-team" title="Account Security & Team" icon={ShieldCheck}>
                                <AccessCodeGenerator className="h-full" />
                            </SettingsSection>
                        </div>}

                        {hasPremium && <SettingsSection id="automations" title="Communications & Automation" icon={MessageSquare}>
                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                <WhatsAppOptIn className="h-full" />
                                <SettingsPanel className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-canvas text-muted-foreground">
                                        <Smartphone className="h-5 w-5" />
                                    </div>
                                    <p className="mt-4 text-sm font-semibold text-body">More automations coming soon</p>
                                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                                        Request features like weekly email summaries or worker SMS receipts.
                                    </p>
                                </SettingsPanel>
                            </div>
                        </SettingsSection>}

                        <SettingsSection id="privacy-data" title="Privacy & Data" icon={ShieldCheck}>
                            <SettingsPanel className="p-5 sm:p-6">
                                <PanelHeading
                                    icon={Download}
                                    title="Download your organization data"
                                    description="Create a structured export of the factory records your account is allowed to access. Sensitive authentication fields are excluded or redacted."
                                />
                                <div className="mt-5">
                                    <OrganizationDataExportButton />
                                    <Link href="/owner/data-export" className="mt-3 inline-flex text-xs font-semibold text-saffron-deep hover:text-saffron">
                                        View export history
                                    </Link>
                                </div>
                            </SettingsPanel>
                        </SettingsSection>

                        <SettingsSection id="account-deletion" title="Account" icon={User}>
                            <DeleteAccountCard organizationName={org?.name || ''} />
                        </SettingsSection>
                    </SettingsCategory>
                </div>

                {hasPremium ? <aside className="settings-right-rail sticky top-6 space-y-4">
                    <SettingsPanel className="p-5">
                        <div className="flex items-center gap-2">
                            <Factory className="h-4 w-4 text-info" />
                            <h3 className="text-base font-semibold text-ink">Factory Snapshot</h3>
                        </div>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Factory</dt>
                                <dd className="mt-1 font-medium text-ink">{org?.name || 'Weavly'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Join Code</dt>
                                <dd className="mt-1 flex items-center gap-2 font-mono font-semibold tracking-wider text-ink">
                                    {org?.join_code || '—'}
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Copy join code"
                                        onClick={copyJoinCode}
                                        disabled={!org?.join_code}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production Mode</dt>
                                <dd className="mt-1 font-medium text-ink">{productionModeOption.settingsLabel}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp Brief</dt>
                                <dd className="mt-1">
                                    {isWhatsAppActive ? (
                                        <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Active</Badge>
                                    ) : (
                                        <Badge variant="outline"><XCircle className="h-3 w-3" /> Not enrolled</Badge>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code Expires</dt>
                                <dd className="mt-1 font-medium text-ink">{formatDate(org?.join_code_expires_at)}</dd>
                            </div>
                        </dl>
                    </SettingsPanel>

                    <SettingsPanel className="p-5">
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-saffron" />
                            <h3 className="text-base font-semibold text-ink">Useful Actions</h3>
                        </div>
                        <div className="mt-4 space-y-2">
                            <Button variant="outline" className="w-full justify-start" onClick={copyJoinCode} disabled={!org?.join_code}>
                                <Copy className="h-4 w-4" />
                                Copy Join Code
                            </Button>
                            <a
                                href="#security-team"
                                className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft"
                            >
                                <KeyRound className="h-4 w-4" />
                                Generate Access Code
                            </a>
                            <a
                                href="#cost-profile"
                                className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft"
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                Review Cost Defaults
                            </a>
                        </div>
                    </SettingsPanel>
                </aside> : <aside className="sticky top-6 space-y-4">
                    <SettingsPanel className="p-5">
                        <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-saffron" />
                            <h3 className="text-base font-semibold text-ink">Weavly Estimator</h3>
                        </div>
                         <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your Estimator Plan includes reusable Fabric Qualities, saved Cost Estimates, and configurable Cost Estimate defaults.</p>
                        <div className="mt-4 space-y-2">
                            <Link href="/owner/billing" className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft">
                                <CreditCard className="h-4 w-4" />
                                Subscription & Billing
                            </Link>
                            <Link href="/owner/quotes" className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft">
                                <ShieldCheck className="h-4 w-4" />
                                 Saved Cost Estimates
                            </Link>
                            <Link href="/forgot-password" className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft">
                                <KeyRound className="h-4 w-4" />
                                Password & Security
                            </Link>
                        </div>
                    </SettingsPanel>
                </aside>}
            </div>
        </div>
    )
}
