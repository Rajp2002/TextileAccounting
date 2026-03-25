'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Factory, User, ShieldCheck, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AccessCodeGenerator } from '@/components/AccessCodeGenerator'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'
import { exportOrganizationData, deleteOrganizationData } from './data-export'
import { toast } from 'sonner'

export default function SettingsPage() {
    const { t } = useTranslation()
    const supabase = createClient()
    const router = useRouter()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')

    // Fetch organization details on the client
    const { data: org, isLoading: orgLoading } = useQuery({
        queryKey: ['organization', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('name, join_code')
                .eq('id', userProfile!.org_id)
                .single()
            if (error) throw error
            return data
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
            a.download = `vastra-data-export-${new Date().toISOString().split('T')[0]}.json`
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
            <div className="space-y-6 max-w-2xl animate-pulse">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-48 mt-2" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                </Card>
            </div>
        )
    }

    if (!userProfile) return null

    return (
        <div className="space-y-6 max-w-2xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
            </div>

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
                        <Label>{t('settings.factory.name')}</Label>
                        <Input value={org?.name || ''} readOnly className="bg-gray-50" />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('settings.factory.id')}</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    value={org?.join_code || ''}
                                    readOnly
                                    className="bg-blue-50 border-blue-200 text-blue-800 font-mono font-bold tracking-widest text-center text-lg"
                                />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.factory.share')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <AccessCodeGenerator />

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

            {/* Data & Privacy — DPDP Act Rights */}
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
                    {/* Export */}
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

                    {/* Delete */}
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

            {/* Legal & Compliance — IT Intermediary Guidelines 2021 */}
            <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        <CardTitle>Legal & Compliance</CardTitle>
                    </div>
                    <CardDescription>Grievance redressal per IT Intermediary Guidelines 2021</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-900">Grievance Officer</p>
                            <p className="text-sm text-gray-600">Vastra Support Team</p>
                            <p className="text-sm text-gray-600">
                                Email:{' '}
                                <a href="mailto:privacy@vastra.app" className="text-emerald-700 hover:underline font-medium">
                                    privacy@vastra.app
                                </a>
                            </p>
                        </div>
                        <p className="text-xs text-gray-500">
                            Complaints will be acknowledged within 24 hours and resolved within 15 days.
                        </p>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400">
                        <a href="/privacy" target="_blank" className="hover:text-gray-600 transition-colors hover:underline">Privacy Policy</a>
                        <a href="/terms" target="_blank" className="hover:text-gray-600 transition-colors hover:underline">Terms of Service</a>
                        <a href="/refund-policy" target="_blank" className="hover:text-gray-600 transition-colors hover:underline">Refund Policy</a>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

