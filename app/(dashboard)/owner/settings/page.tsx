'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Factory, User, ShieldCheck, Loader2, AlertTriangle, Copy, RefreshCw, MessageSquare, Smartphone, SlidersHorizontal } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRODUCTION_MODE_OPTIONS, getProductionModeOption, normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'

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

function SettingsCategory({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <Icon className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {children}
            </div>
        </div>
    )
}

export default function SettingsPage() {
    const { t } = useTranslation()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()

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

    const isLoading = profileLoading || orgLoading
    const currentFactoryName = isEditingName ? factoryName : (factoryName || org?.name || '')

    if (isLoading) {
        return (
            <div className="space-y-10 max-w-6xl pb-10 animate-pulse">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                
                {[1, 2].map(section => (
                    <div key={section} className="space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2].map(i => (
                                <Card key={i}>
                                    <CardHeader>
                                        <Skeleton className="h-6 w-32" />
                                        <Skeleton className="h-4 w-48 mt-2" />
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (!userProfile) return null

    return (
        <div className="space-y-12 max-w-6xl pb-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('settings.title')}</h1>
                <p className="text-gray-500">{t('settings.subtitle')}</p>
            </div>

            {/* Section 1: Identity & Profile */}
            <SettingsCategory title="Factory & Identity" icon={Factory}>
                <Card className="shadow-sm border-gray-200 h-full">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Factory className="h-5 w-5 text-blue-600" />
                            <CardTitle>{t('settings.factory.title')}</CardTitle>
                        </div>
                        <CardDescription>{t('settings.factory.desc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>{t('settings.factory.name')}</Label>
                                {currentFactoryName !== org?.name && !isEditingName && (
                                    <Button 
                                        variant="link" 
                                        size="sm" 
                                        className="h-auto p-0 text-blue-600 font-semibold"
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
                                    className="flex-1"
                                    placeholder="Enter factory name"
                                    disabled={updateNameMutation.isPending}
                                />
                                {currentFactoryName !== org?.name && (
                                    <Button 
                                        className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" 
                                        size="sm"
                                        onClick={() => updateNameMutation.mutate(currentFactoryName)}
                                        disabled={updateNameMutation.isPending}
                                    >
                                        {updateNameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Factory join code</Label>
                            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <p className="flex-1 min-w-[140px] font-mono font-bold tracking-[0.25em] text-2xl text-blue-900 truncate">
                                        {org?.join_code || '—'}
                                    </p>
                                    <div className="flex items-center gap-2 ml-auto shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 bg-white"
                                            onClick={() => {
                                                if (org?.join_code) {
                                                    navigator.clipboard.writeText(org.join_code)
                                                    toast.success('Join code copied!')
                                                }
                                            }}
                                        >
                                            <Copy className="h-3.5 w-3.5" /> Copy
                                        </Button>
                                        <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50 bg-white"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                                                </Button>
                                            </DialogTrigger>
                                        <DialogContent className="sm:max-w-[420px]">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2 text-orange-700">
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
                                                    className="bg-orange-600 hover:bg-orange-700 text-white"
                                                    disabled={regenerateMutation.isPending}
                                                    onClick={() => regenerateMutation.mutate()}
                                                >
                                                    {regenerateMutation.isPending ? (<Loader2 className="h-4 w-4 animate-spin mr-1.5" />) : (<RefreshCw className="h-4 w-4 mr-1.5" />)}
                                                    {regenerateMutation.isPending ? 'Regenerating...' : 'Yes, regenerate'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                                {org?.join_code_expires_at && (
                                    <p className="text-xs text-blue-600">
                                        Expires: <span className="font-medium">{new Date(org.join_code_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-gray-200 h-full">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-teal-600" />
                            <CardTitle>{t('settings.personal.title')}</CardTitle>
                        </div>
                        <CardDescription>View your registered profile details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('settings.personal.name')}</Label>
                                <Input value={userProfile.full_name || ''} readOnly className="bg-gray-50 border-gray-200" />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.personal.phone')}</Label>
                                <Input value={userProfile.phone || ''} readOnly className="bg-gray-50 border-gray-200" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-100 rounded-lg text-teal-800">
                            <ShieldCheck className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wider">{t('settings.personal.role')} {userProfile.role}</span>
                        </div>
                    </CardContent>
                </Card>
            </SettingsCategory>

            {/* Section 2: Security & Operations */}
            <SettingsCategory title="Business Preferences" icon={SlidersHorizontal}>
                <Card className="shadow-sm border-gray-200 h-full">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-5 w-5 text-amber-600" />
                            <CardTitle>Production Mode</CardTitle>
                        </div>
                        <CardDescription>Choose which workflows Weavly shows first for this factory.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Production workflow</Label>
                            <Select
                                value={normalizeProductionMode(org?.production_mode)}
                                onValueChange={(value) => updateProductionModeMutation.mutate(value as ProductionMode)}
                                disabled={updateProductionModeMutation.isPending}
                            >
                                <SelectTrigger className="w-full">
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
                            <p className="text-sm text-gray-500">
                                {getProductionModeOption(org?.production_mode).description}
                            </p>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            Changing this only adjusts which workflows are shown. Existing quotes, orders, market runs, stock, and dispatches will not be deleted.
                        </div>
                    </CardContent>
                </Card>

                <div className="hidden lg:block" />
            </SettingsCategory>

            {/* Section 3: Security & Operations */}
            <SettingsCategory title="Account Security & Team" icon={ShieldCheck}>
                <AccessCodeGenerator />
            </SettingsCategory>

            {/* Section 4: Communications */}
            <SettingsCategory title="Communications & Automation" icon={MessageSquare}>
                <WhatsAppOptIn />
                <div className="p-6 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center space-y-2 h-full">
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">More automations coming soon</p>
                    <p className="text-xs text-gray-400">Request features like weekly email summaries or worker SMS receipts.</p>
                </div>
            </SettingsCategory>

            {/* Section 5: Configuration (Full Width Categories) */}
            <SettingsCategory title="Production Costing & Templates" icon={Factory}>
                <div className="lg:col-span-2 space-y-6">
                    <FactoryCostProfile />
                    <TemplateManager />
                </div>
            </SettingsCategory>

        </div>
    )
}
