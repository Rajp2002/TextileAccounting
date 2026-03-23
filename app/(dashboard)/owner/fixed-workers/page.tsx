'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatINR } from '@/lib/finance'
import { Plus, Pencil, Trash2, Users, Briefcase, KeyRound, AlertCircle, Loader2 } from 'lucide-react'
import { getWorkerDebt } from '@/app/(dashboard)/supervisor/actions'
import { validateAndRotateAccessCode } from '@/app/(dashboard)/owner/actions'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n/context'

const ROLES = [
    { value: 'master', label: 'Master', defaultSalary: 30000 },
    { value: 'supervisor', label: 'Supervisor', defaultSalary: 30000 },
    { value: 'helper', label: 'Helper', defaultSalary: 15000 },
    { value: 'mender', label: 'Mender', defaultSalary: 15000 },
    { value: 'sanitation', label: 'Sanitation Worker', defaultSalary: 7000 },
    { value: 'daily', label: 'Day-to-Day', defaultSalary: 15000 },
]

interface FixedWorker {
    id: number
    name: string
    role: string
    monthly_salary: number
    is_active: boolean
}

function getRoleLabel(role: string) {
    return ROLES.find(r => r.value === role)?.label || role
}

function getRoleColor(role: string) {
    const colors: Record<string, string> = {
        master: 'bg-purple-100 text-purple-800',
        supervisor: 'bg-blue-100 text-blue-800',
        helper: 'bg-amber-100 text-amber-800',
        mender: 'bg-teal-100 text-teal-800',
        sanitation: 'bg-green-100 text-green-800',
        daily: 'bg-orange-100 text-orange-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
}

export default function FixedWorkersPage() {
    const { t } = useTranslation()
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingWorker, setEditingWorker] = useState<FixedWorker | null>(null)
    const [formName, setFormName] = useState('')
    const [formRole, setFormRole] = useState('')
    const [formSalary, setFormSalary] = useState('')
    const [saving, setSaving] = useState(false)

    // Deletion State
    const [workerToDelete, setWorkerToDelete] = useState<FixedWorker | null>(null)
    const [workerDebt, setWorkerDebt] = useState<number>(0)
    const [accessCode, setAccessCode] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [fetchingDebt, setFetchingDebt] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)

    const { data: userProfile } = useUserProfile()

    const { data: fixedWorkers, isLoading } = useQuery({
        queryKey: ['fixed_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fixed_workers')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('role')
                .order('name')
            if (error) throw error
            return data as FixedWorker[]
        }
    })

    const openAddDialog = () => {
        setEditingWorker(null)
        setFormName('')
        setFormRole('')
        setFormSalary('')
        setDialogOpen(true)
    }

    const openEditDialog = (worker: FixedWorker) => {
        setEditingWorker(worker)
        setFormName(worker.name)
        setFormRole(worker.role)
        setFormSalary(worker.monthly_salary.toString())
        setDialogOpen(true)
    }

    const handleRoleChange = (role: string) => {
        setFormRole(role)
        // Auto-fill default salary if adding new worker
        if (!editingWorker) {
            const defaultSalary = ROLES.find(r => r.value === role)?.defaultSalary
            if (defaultSalary) setFormSalary(defaultSalary.toString())
        }
    }

    const handleSave = async () => {
        if (!formName.trim() || !formRole || !formSalary) {
            toast.error('Please fill all fields')
            return
        }

        setSaving(true)
        try {
            if (editingWorker) {
                const { error } = await supabase
                    .from('fixed_workers')
                    .update({
                        name: formName.trim(),
                        role: formRole,
                        monthly_salary: parseFloat(formSalary),
                    })
                    .eq('id', editingWorker.id)
                if (error) throw error
                toast.success('Worker updated')
            } else {
                const { error } = await supabase
                    .from('fixed_workers')
                    .insert({
                        name: formName.trim(),
                        role: formRole,
                        monthly_salary: parseFloat(formSalary),
                        org_id: userProfile!.org_id,
                    })
                if (error) throw error
                toast.success('Worker added')
            }

            setDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (worker: FixedWorker) => {
        if (!userProfile?.org_id) return
        setFetchingDebt(true)
        try {
            const res = await getWorkerDebt(userProfile.org_id, worker.id, 'fixed')
            setWorkerDebt(res.balance || 0)
            setWorkerToDelete(worker)
            setAccessCode('')
            setVerificationOpen(true)
        } finally {
            setFetchingDebt(false)
        }
    }

    const executeDelete = async () => {
        if (!workerToDelete || !userProfile?.org_id) return
        
        setDeleting(true)
        try {
            // Verify access code first (SEC-004)
            const isValid = await validateAndRotateAccessCode(userProfile.org_id, accessCode)
            if (!isValid) {
                toast.error('Invalid or expired access code')
                return
            }

            const { error } = await supabase
                .from('fixed_workers')
                .delete()
                .eq('id', workerToDelete.id)
            if (error) throw error

            toast.success('Worker removed')
            setVerificationOpen(false)
            setWorkerToDelete(null)
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setDeleting(false)
        }
    }

    // Group workers by role
    const grouped = (fixedWorkers || []).reduce((acc, w) => {
        if (!acc[w.role]) acc[w.role] = []
        acc[w.role].push(w)
        return acc
    }, {} as Record<string, FixedWorker[]>)

    const totalMonthly = (fixedWorkers || [])
        .filter(w => w.is_active)
        .reduce((sum, w) => sum + Number(w.monthly_salary), 0)

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('fixed_page.title')}</h1>
                    <p className="text-sm text-gray-500">{t('fixed_page.subtitle')}</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-1" />
                            {t('fixed_page.add_worker')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingWorker ? t('fixed_page.edit_worker') : t('fixed_page.add_title')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>{t('fixed_page.name')}</Label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder={t('fixed_page.name_ph')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('fixed_page.role')}</Label>
                                <Select value={formRole} onValueChange={handleRoleChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('fixed_page.select_role')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map(r => (
                                            <SelectItem key={r.value} value={r.value}>
                                                {t(`workers.roles.${r.value}`)} — {formatINR(r.defaultSalary)}/mo
                                            </SelectItem>
                                        ))}
                                        {editingWorker && !ROLES.find(r => r.value === editingWorker.role) && (
                                            <SelectItem value={editingWorker.role}>
                                                {editingWorker.role} ({t('fixed_page.custom')})
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('fixed_page.monthly_salary')}</Label>
                                <Input
                                    type="number"
                                    value={formSalary}
                                    onChange={(e) => setFormSalary(e.target.value)}
                                    placeholder="30000"
                                />
                            </div>
                            <Button onClick={handleSave} disabled={saving} className="w-full">
                                {saving ? t('fixed_page.saving') : editingWorker ? t('fixed_page.update') : t('fixed_page.add_worker')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary Card */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        {t('fixed_page.monthly_payroll')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-green-700">
                        {formatINR(totalMonthly)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {(fixedWorkers || []).filter(w => w.is_active).length} {t('fixed_page.active_count')}
                    </p>
                </CardContent>
            </Card>

            {/* Workers by Role */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-8 rounded-full" />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="divide-y">
                                    {[1, 2].map(j => (
                                        <div key={j} className="flex justify-between items-center py-3">
                                            <Skeleton className="h-5 w-24" />
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="h-5 w-20" />
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : Object.keys(grouped).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Users className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="font-medium text-gray-500">{t('fixed_page.no_workers')}</p>
                        <p className="text-sm text-gray-400 mt-1">{t('fixed_page.add_desc')}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {ROLES.map(roleInfo => {
                        const workers = grouped[roleInfo.value]
                        if (!workers || workers.length === 0) return null
                        return (
                            <Card key={roleInfo.value}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-gray-500" />
                                        <CardTitle className="text-base">{t(`workers.roles.${roleInfo.value}`)}</CardTitle>
                                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getRoleColor(roleInfo.value))}>
                                            {workers.length}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="divide-y">
                                        {workers.map(w => (
                                            <div key={w.id} className="flex justify-between items-center py-3">
                                                <div>
                                                    <span className={cn('font-medium', !w.is_active && 'text-gray-400 line-through')}>
                                                        {w.name}
                                                    </span>
                                                    {roleInfo.value === 'daily' && (
                                                        <span className="text-xs text-orange-600 ml-2">{t('fixed_page.attendance_based')}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        {formatINR(w.monthly_salary)}/mo
                                                    </span>
                                                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(w)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(w)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}

                    {/* Custom Roles */}
                    {Object.entries(grouped)
                        .filter(([roleName]) => !ROLES.find(r => r.value === roleName))
                        .map(([roleName, workers]) => {
                            if (!workers || workers.length === 0) return null
                            return (
                                <Card key={roleName}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-gray-500" />
                                            <CardTitle className="text-base capitalize">{roleName}</CardTitle>
                                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getRoleColor('other'))}>
                                                {workers.length}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="divide-y">
                                            {workers.map(w => (
                                                <div key={w.id} className="flex justify-between items-center py-3">
                                                    <div>
                                                        <span className={cn('font-medium', !w.is_active && 'text-gray-400 line-through')}>
                                                            {w.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-semibold text-gray-700">
                                                            {formatINR(w.monthly_salary)}/mo
                                                        </span>
                                                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(w)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(w)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                </div>
            )}

            {/* Deletion & Authorization Modal */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> {t('fixed_page.auth_title')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('fixed_page.auth_desc')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {workerDebt > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-900">{t('fixed_page.outstanding')}</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        {t('fixed_page.balance')} <strong className="text-amber-900">{formatINR(workerDebt)}</strong>{t('fixed_page.settle')}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>{t('fixed_page.access_code')}</Label>
                            <Input
                                placeholder={t('fixed_page.code_ph')}
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono uppercase tracking-widest text-lg"
                                maxLength={6}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>{t('fixed_page.cancel')}</Button>
                        <Button
                            variant="destructive"
                            disabled={accessCode.length < 6 || deleting}
                            onClick={executeDelete}
                        >
                            {deleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('fixed_page.verify_delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
