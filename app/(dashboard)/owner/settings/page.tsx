'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Factory, User, ShieldCheck, Download, Trash2, Loader2, AlertTriangle, Copy, RefreshCw, MessageSquare, Smartphone, Layers } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AccessCodeGenerator } from '@/components/AccessCodeGenerator'
import { WhatsAppOptIn } from '@/components/settings/WhatsAppOptIn'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { exportOrganizationData, deleteOrganizationData } from './data-export'
import { toast } from 'sonner'
import { FactoryCostProfile } from '@/components/settings/factory-cost-profile'
import { TemplateManager } from '@/components/settings/template-manager'
import { regenerateJoinCode } from '@/app/(auth)/actions/auth'
import { setBeamTrackingEnabled, updateOrganizationName } from '@/app/(dashboard)/owner/actions'
import { SupervisorFloatManager } from '@/components/settings/supervisor-float-manager'
import { EmergencyLockdown } from '@/components/settings/EmergencyLockdown'

// ─── Helper Components ────────────────────────────────────────────────────────

function SettingsCategory({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
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
    const router = useRouter()
    const queryClient = useQueryClient()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')
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
                .select('name, join_code, join_code_expires_at, beam_tracking_enabled')
                .eq('id', userProfile!.org_id)
                .single()
            if (error) throw error
            return data
        }
    })

    // Sync local state when organization data is loaded
    useEffect(() => {
        if (org?.name) {
            setFactoryName(org.name)
        }
    }, [org?.name])

    // Update factory name mutation
    const updateNameMutation = useMutation({
        mutationFn: async (newName: string) => {
            const result = await updateOrganizationName(newName)
            if (result.error) throw new Error(result.error)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organization'] })
            setIsEditingName(false)
            toast.success('Factory name updated successfully')
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to update name')
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
            queryClient.setQueryData(['organization', userProfile?.org_id], (old: any) => ({
                ...old,
                join_code: data.joinCode,
                join_code_expires_at: data.expiresAt,
            }))
            setRegenerateDialogOpen(false)
            toast.success('Join code regenerated. The old code is now invalid.')
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to regenerate code')
        }
    })

    const beamTrackingMutation = useMutation({
        mutationFn: async (enabled: boolean) => {
            const result = await setBeamTrackingEnabled(enabled)
            if (result.error) throw new Error(result.error)
            return result
        },
        onSuccess: (_, enabled) => {
            queryClient.setQueryData(['organization', userProfile?.org_id], (old: any) => ({
                ...old,
                beam_tracking_enabled: enabled,
            }))
            toast.success(t('common.updated'))
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to update beam tracking')
        }
    })

    // Export data mutation
    const exportMutation = useMutation({
        mutationFn: async () => {
            const data = await exportOrganizationData()
            // Trigger browser download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `weavly-data-export-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        },
        onSuccess: () => {
            toast.success('Data exported successfully')
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to export data')
        }
    })

    // Delete account mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await deleteOrganizationData(deleteConfirmation)
        },
        onSuccess: () => {
            toast.success('Account and all data deleted')
            router.push('/')
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete account')
        }
    })

    const isLoading = profileLoading || orgLoading

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
                                {factoryName !== org?.name && !isEditingName && (
                                    <Button 
                                        variant="link" 
                                        size="sm" 
                                        className="h-auto p-0 text-blue-600 font-semibold"
                                        onClick={() => updateNameMutation.mutate(factoryName)}
                                        disabled={updateNameMutation.isPending}
                                    >
                                        {updateNameMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input 
                                    value={factoryName} 
                                    onChange={(e) => setFactoryName(e.target.value)}
                                    className="flex-1"
                                    placeholder="Enter factory name"
                                    disabled={updateNameMutation.isPending}
                                />
                                {factoryName !== org?.name && (
                                    <Button 
                                        className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" 
                                        size="sm"
                                        onClick={() => updateNameMutation.mutate(factoryName)}
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
                                        Expires: <span className="font-medium">{new Date(org.join_code_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
            <SettingsCategory title="Account Security & Team" icon={ShieldCheck}>
                <AccessCodeGenerator />
                <SupervisorFloatManager />
            </SettingsCategory>

            {/* Section 3: Communications */}
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

            {/* Section 4: Configuration (Full Width Categories) */}
            <SettingsCategory title="Production Costing & Templates" icon={Factory}>
                <div className="lg:col-span-2 space-y-6">
                    <FactoryCostProfile />
                    <TemplateManager />
                    <Card className="shadow-sm border-gray-200">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Layers className="h-5 w-5 text-indigo-600" />
                                <CardTitle>{t('inventory.beams.settingsTitle')}</CardTitle>
                            </div>
                            <CardDescription>{t('inventory.beams.settingsHelper')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-gray-900">{t('inventory.tabs.beams')}</p>
                                    <p className="text-xs text-gray-500">{t('inventory.beams.settingsHelper')}</p>
                                </div>
                                <Switch
                                    checked={!!org?.beam_tracking_enabled}
                                    disabled={beamTrackingMutation.isPending}
                                    onCheckedChange={(checked: boolean) => beamTrackingMutation.mutate(checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SettingsCategory>

            {/* Section 5: Admin & Legal */}
            <SettingsCategory title="Organization Administration" icon={Download}>
                <Card className="shadow-sm border-gray-200 lg:col-span-1">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-blue-600" />
                            <CardTitle>Data Management</CardTitle>
                        </div>
                        <CardDescription>Export or delete your data per DPDP Act 2023</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Export My Data</p>
                                <p className="text-xs text-gray-500 mt-0.5">Download JSON export of your organization</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                                {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                                Export
                            </Button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/30 p-4">
                            <div>
                                <p className="text-sm font-medium text-red-900">Delete Account</p>
                                <p className="text-xs text-red-600 mt-0.5">Permanently delete all data</p>
                            </div>
                            <Dialog open={deleteDialogOpen} onOpenChange={(val) => { setDeleteDialogOpen(val); if (!val) setDeleteConfirmation('') }}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100">
                                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[420px]">
                                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Delete All Data</DialogTitle><DialogDescription>This will permanently delete your organization and all records. This cannot be undone.</DialogDescription></DialogHeader>
                                    <div className="space-y-3 py-2"><p className="text-sm text-gray-700">Type <span className="font-mono font-bold text-red-700">{org?.name}</span> to confirm:</p><Input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="Type your factory name" className="border-red-200 focus:border-red-400" /></div>
                                    <DialogFooter><Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button variant="destructive" disabled={deleteConfirmation !== org?.name || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>{deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}Delete Everything</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                <EmergencyLockdown />
            </SettingsCategory>
        </div>
    )
}
