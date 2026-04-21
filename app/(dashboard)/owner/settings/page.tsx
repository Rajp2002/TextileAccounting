'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Factory, User, ShieldCheck, Download, Trash2, Loader2, AlertTriangle, Copy, RefreshCw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { updateOrganizationName } from '@/app/(dashboard)/owner/actions'
import { SupervisorFloatManager } from '@/components/settings/supervisor-float-manager'

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
                .select('name, join_code, join_code_expires_at')
                .eq('id', userProfile!.org_id)
                .single()
            if (error) throw error
            // Initialize local name state once data is loaded
            if (data?.name) setFactoryName(data.name)
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

    // Export data mutation
    const exportMutation = useMutation({
        mutationFn: async () => {
            const data = await exportOrganizationData()
            // Trigger browser download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `loomi-data-export-${new Date().toISOString().split('T')[0]}.json`
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

        return (
            <div className="space-y-6 max-w-6xl pb-10 animate-pulse">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
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
                    <div className="md:col-span-2">
                        <Skeleton className="h-[300px] w-full rounded-xl" />
                    </div>
                </div>
            </div>
        )

    if (!userProfile) return null

    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Column 1: Core Factory Info & Contact */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-gray-200">
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
                                            className="h-auto p-0 text-blue-600"
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
                                                id="copy-join-code-btn"
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100"
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
                                                        id="regenerate-join-code-btn"
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
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
                                                        {regenerateMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                                        ) : (
                                                            <RefreshCw className="h-4 w-4 mr-1.5" />
                                                        )}
                                                        {regenerateMutation.isPending ? 'Regenerating...' : 'Yes, regenerate'}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>

                                    {org?.join_code_expires_at && (
                                        <p className="text-xs text-blue-600">
                                            Expires:{' '}
                                            <span className="font-medium">
                                                {new Date(org.join_code_expires_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </span>
                                        </p>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Supervisors use this code to join your factory. Share it securely.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <WhatsAppOptIn />

                    <Card className="shadow-sm border-gray-200">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-teal-600" />
                                <CardTitle>{t('settings.personal.title')}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('settings.personal.name')}</Label>
                                    <Input value={userProfile.full_name || ''} readOnly className="bg-gray-50" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('settings.personal.phone')}</Label>
                                    <Input value={userProfile.phone || ''} readOnly className="bg-gray-50" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                                <ShieldCheck className="h-3 w-3" />
                                <span>{t('settings.personal.role')} {userProfile.role}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Column 2: Sensitive Actions & Data Control */}
                <div className="space-y-6">
                    <AccessCodeGenerator />
                    
                    <SupervisorFloatManager />

                    <Card className="shadow-sm border-gray-200">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-blue-600" />
                                <CardTitle>Data & Privacy</CardTitle>
                            </div>
                            <CardDescription>
                                Export or delete your data per DPDP Act 2023
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Export My Data</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Download all your organization data as a JSON file
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => exportMutation.mutate()}
                                    disabled={exportMutation.isPending}
                                >
                                    {exportMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    {exportMutation.isPending ? 'Exporting...' : 'Export'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/30 p-4">
                                <div>
                                    <p className="text-sm font-medium text-red-900">Delete My Account & Data</p>
                                    <p className="text-xs text-red-600 mt-0.5">
                                        Permanently delete all data. This action cannot be undone.
                                    </p>
                                </div>
                                <Dialog open={deleteDialogOpen} onOpenChange={(val) => { setDeleteDialogOpen(val); if (!val) setDeleteConfirmation('') }}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px]">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-red-700">
                                                <AlertTriangle className="h-5 w-5" />
                                                Delete All Data
                                            </DialogTitle>
                                            <DialogDescription>
                                                This will permanently delete your organization, all workers, production logs, payroll records, advances, orders, and inventory data. This cannot be undone.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-3 py-2">
                                            <p className="text-sm text-gray-700">
                                                Type <span className="font-mono font-bold text-red-700">{org?.name}</span> to confirm:
                                            </p>
                                            <Input
                                                value={deleteConfirmation}
                                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                                placeholder="Type your factory name"
                                                className="border-red-200 focus:border-red-400"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                variant="outline"
                                                onClick={() => setDeleteDialogOpen(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                disabled={deleteConfirmation !== org?.name || deleteMutation.isPending}
                                                onClick={() => deleteMutation.mutate()}
                                            >
                                                {deleteMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                                )}
                                                {deleteMutation.isPending ? 'Deleting...' : 'Delete Everything'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Full-width sections for high-density components */}
                <div className="lg:col-span-2 space-y-6">
                    <FactoryCostProfile />
                    <TemplateManager />

                    <Card className="shadow-sm border-gray-200">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                <CardTitle>Legal & Compliance</CardTitle>
                            </div>
                            <CardDescription>Grievance redressal per IT Intermediary Guidelines 2021</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-gray-900">Grievance Officer</p>
                                        <p className="text-sm text-gray-600">Loomi Support Team</p>
                                        <p className="text-sm text-gray-600">
                                            Email:{' '}
                                            <a href="mailto:privacy@loomi.app" className="text-emerald-700 hover:underline font-medium">
                                                privacy@loomi.app
                                            </a>
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Complaints will be acknowledged within 24 hours and resolved within 15 days.
                                    </p>
                                </div>
                                <div className="flex flex-col justify-center gap-3">
                                    <div className="flex gap-4 text-xs text-gray-400">
                                        <a href="/privacy" target="_blank" className="hover:text-gray-600 transition-colors hover:underline">Privacy Policy</a>
                                        <a href="/terms" target="_blank" className="hover:text-gray-600 transition-colors hover:underline">Terms of Service</a>
                                        <a href="/refund-policy" target="_blank" className="hover:text-gray-600 transition-colors hover:underline">Refund Policy</a>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

