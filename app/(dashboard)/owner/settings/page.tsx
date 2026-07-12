'use client'

import { useState, type ReactNode } from 'react'
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
    XCircle,
    type LucideIcon,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AccessCodeGenerator } from '@/components/AccessCodeGenerator'
import { WhatsAppOptIn } from '@/components/settings/WhatsAppOptIn'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { FactoryCostProfile } from '@/components/settings/factory-cost-profile'
import { TemplateManager } from '@/components/settings/template-manager'
import { regenerateJoinCode } from '@/app/(auth)/actions/auth'
import { updateOrganizationName, updateOrganizationProductionMode } from '@/app/(dashboard)/owner/actions'
import { exportOrganizationData } from '@/app/(dashboard)/owner/settings/data-export'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRODUCTION_MODE_OPTIONS, getProductionModeOption, normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import { tierSatisfies } from '@/lib/subscription-access'

// ─── Helper Components ────────────────────────────────────────────────────────

type OrganizationSettings = {
    name: string
    join_code: string | null
    join_code_expires_at: string | null
    production_mode: ProductionMode | null
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

function formatDate(date: string | null | undefined) {
    if (!date) return 'Not set'
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })
}

function SettingsSection({
    id,
    title,
    icon: Icon,
    children,
}: {
    id: string
    title: string
    icon: LucideIcon
    children: ReactNode
}) {
    return (
        <section id={id} className="scroll-mt-6 space-y-3">
            <div className="flex items-center gap-2 border-b border-hairline/80 pb-2">
                <Icon className="h-4 w-4 text-subtle" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
            </div>
            {children}
        </section>
    )
}

function SettingsPanel({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={cn(
                'rounded-lg border border-hairline bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm',
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
    const { t } = useTranslation()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()
    const subscriptionTier = useOwnerPlan()
    const hasPremium = tierSatisfies(subscriptionTier, 'premium')

    const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
    const [factoryName, setFactoryName] = useState('')
    const [isEditingName, setIsEditingName] = useState(false)

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
        }
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
            toast.success('Factory name updated successfully')
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'Failed to update name'))
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
            toast.success('Join code regenerated. The old code is now invalid.')
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'Failed to regenerate code'))
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
            toast.success('Production mode updated')
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'Failed to update production mode'))
        }
    })

    const dataExportMutation = useMutation({
        mutationFn: exportOrganizationData,
        onSuccess: (payload) => {
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `weavly-org-export-${new Date().toISOString().slice(0, 10)}.json`
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(url)
            toast.success('Data export downloaded')
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'Failed to export organization data'))
        }
    })

    const isLoading = profileLoading || orgLoading
    const currentFactoryName = isEditingName ? factoryName : (factoryName || org?.name || '')

    if (isLoading) {
        return (
            <div className="settings-page-frame space-y-5">
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
        toast.success('Join code copied!')
    }

    function refreshSettings() {
        queryClient.invalidateQueries({ queryKey: ['organization'] })
        queryClient.invalidateQueries({ queryKey: ['user_profile_id'] })
        toast.success('Settings refreshed')
    }

    return (
        <div className="settings-page-frame">
            <div id="overview" className="mb-5 flex flex-col gap-4 border-b border-hairline/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight text-ink">{t('settings.title')}</h1>
                    <p className="mt-1 text-base text-muted-foreground">{hasPremium ? t('settings.subtitle') : 'Business profile, costing defaults, saved qualities, and account access.'}</p>
                </div>
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={refreshSettings}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </Button>
            </div>

            <div className="settings-layout-grid">
                <div className="min-w-0 space-y-5">
                    <SettingsSection id="factory-identity" title={hasPremium ? 'Factory & Identity' : 'Business & Profile'} icon={Factory}>
                        <SettingsPanel className="overflow-hidden">
                            <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
                                <div className="space-y-5 border-b border-hairline p-5 lg:border-b-0 lg:border-r sm:p-6">
                                    <PanelHeading
                                        icon={Factory}
                                        title={hasPremium ? t('settings.factory.title') : 'Business details'}
                                        description={hasPremium ? t('settings.factory.desc') : 'Used to identify and brand your saved costings.'}
                                    />

                                    <div className="space-y-2">
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

                                    {hasPremium && <div className="space-y-3">
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
                                                        className="border-info/25 bg-white text-info hover:bg-info-soft"
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
                                                                className="border-saffron/30 bg-white text-saffron-deep hover:bg-saffron-soft"
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
                                </div>

                                <div className="space-y-5 p-5 sm:p-6">
                                    <PanelHeading
                                        icon={User}
                                        title={t('settings.personal.title')}
                                        description="View your registered profile details"
                                    />
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 min-[1700px]:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>{t('settings.personal.name')}</Label>
                                            <Input value={userProfile.full_name || ''} readOnly className="border-hairline bg-surface-soft/55" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('settings.personal.phone')}</Label>
                                            <Input value={userProfile.phone || ''} readOnly className="border-hairline bg-surface-soft/55" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-success">
                                        <ShieldCheck className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wide">
                                            {t('settings.personal.role')} {userProfile.role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </SettingsPanel>
                    </SettingsSection>

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

                    <SettingsSection id="cost-profile" title={hasPremium ? 'Production Costing & Templates' : 'Estimator Defaults'} icon={Factory}>
                        <FactoryCostProfile standaloneEstimator={!hasPremium} />
                    </SettingsSection>

                    <SettingsSection id="qualities" title="Saved Fabric Qualities" icon={ShieldCheck}>
                        <TemplateManager />
                    </SettingsSection>
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
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => dataExportMutation.mutate()}
                                disabled={dataExportMutation.isPending}
                            >
                                {dataExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                {dataExportMutation.isPending ? 'Preparing Export' : 'Download Data Export'}
                            </Button>
                        </div>
                    </SettingsPanel>
                </aside> : <aside className="sticky top-6 space-y-4">
                    <SettingsPanel className="p-5">
                        <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-saffron" />
                            <h3 className="text-base font-semibold text-ink">Weavly Estimator</h3>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your Estimator Plan includes reusable qualities, saved costings, and configurable costing defaults.</p>
                        <div className="mt-4 space-y-2">
                            <Link href="/owner/billing" className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft">
                                <CreditCard className="h-4 w-4" />
                                Subscription & Billing
                            </Link>
                            <Link href="/owner/quotes" className="flex min-h-10 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-surface-soft">
                                <ShieldCheck className="h-4 w-4" />
                                Saved Costings
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
