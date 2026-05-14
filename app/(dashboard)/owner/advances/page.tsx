'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatINR, sumAdvances } from '@/lib/finance'
import { createAdvance, deleteAdvance } from './actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { cn } from '@/lib/utils'
import { sendWhatsAppAdvanceReceipt } from '@/lib/whatsapp'
import {
    HandCoins, Plus, Trash2, Search,
    Clock, CheckCircle2, AlertTriangle, TrendingUp, Loader2,
    UserRound, WalletCards, ReceiptText, ShieldCheck, CircleDollarSign
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Worker {
    id: number
    name: string
    type: 'meter' | 'fixed'
    role?: string
    monthly_salary?: number
    whatsapp_number?: string
}

interface Advance {
    id: number
    amount: number
    description: string | null
    status: 'pending' | 'deducted'
    created_at: string
    deducted_at: string | null
    deducted_in_month: string | null
}

interface PendingAdvanceOverview extends Advance {
    workerName: string
    workerType: 'meter' | 'fixed'
}

interface MeterWorkerRow {
    id: number
    name: string
}

interface FixedWorkerRow {
    id: number
    name: string
    role: string | null
    monthly_salary: number | null
}

interface ProductionLogRow {
    meters: string | number | null
    worker_rate_snapshot: number | null
}

interface PendingAdvanceRow extends Advance {
    meter_worker_id: number | null
    fixed_worker_id: number | null
    workers: { name: string } | null
    fixed_workers: { name: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDebtLevel(totalPending: number, typicalMonthly: number): 'safe' | 'amber' | 'red' {
    if (typicalMonthly <= 0) return 'safe'
    const ratio = totalPending / typicalMonthly
    if (ratio >= 1.0) return 'red'
    if (ratio >= 0.5) return 'amber'
    return 'safe'
}

function DebtBadge({ level, ratio }: { level: 'safe' | 'amber' | 'red'; ratio: number }) {
    if (level === 'safe') return null
    return (
        <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            level === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        )}>
            <AlertTriangle className="h-3 w-3" />
            {Math.round(ratio * 100)}% of monthly pay
        </span>
    )
}

function formatAdvanceDate(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
    return new Date(date).toLocaleDateString('en-IN', options)
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdvancesPage() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { data: userProfile } = useUserProfile()

    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
    const [search, setSearch] = useState('')
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [newAmount, setNewAmount] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const { t } = useTranslation()
    const tl = useTransliterate()

    // ── Fetch all workers (both types) ──────────────────────────────────────
    const { data: workers, isLoading: workersLoading } = useQuery({
        queryKey: ['all_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const [{ data: meterWorkers }, { data: fixedWorkers }] = await Promise.all([
                supabase
                    .from('workers')
                    .select('id, name, whatsapp_number')
                    .eq('org_id', userProfile!.org_id)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('fixed_workers')
                    .select('id, name, role, monthly_salary, whatsapp_number')
                    .eq('org_id', userProfile!.org_id)
                    .eq('is_active', true)
                    .order('name'),
            ])

            const typedMeterWorkers = (meterWorkers || []) as (MeterWorkerRow & { whatsapp_number?: string })[]
            const typedFixedWorkers = (fixedWorkers || []) as (FixedWorkerRow & { whatsapp_number?: string })[]
            const all: Worker[] = [
                ...typedMeterWorkers.map((w) => ({ id: w.id, name: w.name, type: 'meter' as const, whatsapp_number: w.whatsapp_number })),
                ...typedFixedWorkers.map((w) => ({
                    id: w.id, name: w.name, type: 'fixed' as const,
                    role: w.role || undefined, monthly_salary: w.monthly_salary || undefined,
                    whatsapp_number: w.whatsapp_number
                })),
            ]
            return all.sort((a, b) => a.name.localeCompare(b.name))
        }
    })

    // ── Fetch advances for selected worker ──────────────────────────────────
    const { data: advances, isLoading: advancesLoading } = useQuery({
        queryKey: ['worker_advances', userProfile?.org_id, selectedWorker?.type, selectedWorker?.id],
        enabled: !!userProfile?.org_id && !!selectedWorker,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('worker_advances')
                .select('id, amount, description, status, created_at, deducted_at, deducted_in_month')
                .eq('org_id', userProfile!.org_id)
                .eq(selectedWorker!.type === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', selectedWorker!.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            return (data || []) as Advance[]
        }
    })

    const { data: allPendingAdvances, isLoading: allPendingLoading } = useQuery({
        queryKey: ['all_pending_advances', userProfile?.org_id],
        enabled: !!userProfile?.org_id && !selectedWorker,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('worker_advances')
                .select('id, amount, description, status, created_at, deducted_at, deducted_in_month, meter_worker_id, fixed_worker_id, workers(name), fixed_workers(name)')
                .eq('org_id', userProfile!.org_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            return ((data || []) as PendingAdvanceRow[]).map((advance) => ({
                id: advance.id,
                amount: advance.amount,
                description: advance.description,
                status: advance.status,
                created_at: advance.created_at,
                deducted_at: advance.deducted_at,
                deducted_in_month: advance.deducted_in_month,
                workerName: advance.workers?.name || advance.fixed_workers?.name || 'Unknown worker',
                workerType: advance.meter_worker_id ? 'meter' : 'fixed',
            })) as PendingAdvanceOverview[]
        }
    })

    // ── Estimate typical monthly earnings (for debt-to-income) ──────────────
    const { data: typicalMonthly } = useQuery({
        queryKey: ['typical_monthly', userProfile?.org_id, selectedWorker?.type, selectedWorker?.id],
        enabled: !!userProfile?.org_id && !!selectedWorker,
        queryFn: async () => {
            if (selectedWorker!.type === 'fixed') {
                return selectedWorker!.monthly_salary || 0
            }
            // For piece-rate workers, estimate from last month's production logs.
            // Uses worker_rate_snapshot (the actual rate at time of logging) — same
            // source as the payroll page client query, so the figure is consistent.
            const now = new Date()
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const monthStr = lastMonth.toISOString().substring(0, 7)

            const { data: logs } = await supabase
                .from('production_logs')
                .select('meters, worker_rate_snapshot')
                .eq('org_id', userProfile!.org_id)
                .eq('worker_id', selectedWorker!.id)
                .gte('date', `${monthStr}-01`)
                .lte('date', `${monthStr}-${new Date(Number(monthStr.split('-')[0]), Number(monthStr.split('-')[1]), 0).getDate()}`)

            const typedLogs = (logs || []) as ProductionLogRow[]
            const total = typedLogs.reduce((sum, log) => {
                return sum + (Number(log.meters) || 0) * (log.worker_rate_snapshot || 0)
            }, 0)

            return total
        }
    })

    // ── Computed values ─────────────────────────────────────────────────────
    const pendingAdvances = useMemo(() => (advances || []).filter(a => a.status === 'pending'), [advances])
    const deductedAdvances = useMemo(() => (advances || []).filter(a => a.status === 'deducted'), [advances])
    const totalPending = useMemo(() => parseFloat(sumAdvances(pendingAdvances)), [pendingAdvances])
    const totalDeducted = useMemo(() => parseFloat(sumAdvances(deductedAdvances)), [deductedAdvances])
    const debtLevel = useMemo(() => getDebtLevel(totalPending, typicalMonthly || 0), [totalPending, typicalMonthly])
    const debtRatio = typicalMonthly ? totalPending / typicalMonthly : 0

    // ── Filter workers by search ────────────────────────────────────────────
    const filteredWorkers = useMemo(() => {
        if (!workers) return []
        if (!search.trim()) return workers
        const q = search.toLowerCase()
        return workers.filter(w => w.name.toLowerCase().includes(q))
    }, [workers, search])

    // ── Create advance mutation ─────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!selectedWorker) throw new Error('No worker selected')
            const amount = parseFloat(newAmount)
            if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount')
            return await createAdvance(selectedWorker.type, selectedWorker.id, amount, newDescription)
        },
        onSuccess: (data) => {
            if (data.success) {
                const notification = data.notification;
                if (notification?.sent) {
                    toast.success('Advance recorded and receipt sent via WhatsApp')
                } else if (notification?.reason === 'no_phone') {
                    toast.success('Advance recorded (Worker has no WhatsApp number)')
                } else {
                    // WhatsApp failed or timed out
                    toast.warning('Advance saved. WhatsApp receipt not sent.', {
                        action: {
                            label: 'Send Manually',
                            onClick: () => {
                                if (selectedWorker && selectedWorker.whatsapp_number) {
                                    sendWhatsAppAdvanceReceipt({
                                        phone: selectedWorker.whatsapp_number,
                                        workerName: selectedWorker.name,
                                        amount: parseFloat(newAmount),
                                        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                                        reason: newDescription,
                                        balance: notification?.balance,
                                        factoryName: 'Your Factory'
                                    })
                                } else {
                                    toast.error('Worker has no WhatsApp number for manual sending')
                                }
                            }
                        }
                    })
                }
            } else {
                toast.error('Failed to create advance')
            }
            setShowAddDialog(false)
            setNewAmount('')
            setNewDescription('')
            queryClient.invalidateQueries({ queryKey: ['worker_advances'] })
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'Failed to create advance'))
        }
    })

    // ── Delete advance mutation ─────────────────────────────────────────────
    const deleteMutation = useMutation({
        mutationFn: async (advanceId: number) => {
            return await deleteAdvance(advanceId)
        },
        onSuccess: () => {
            toast.success('Advance deleted')
            setDeletingId(null)
            queryClient.invalidateQueries({ queryKey: ['worker_advances'] })
        },
        onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'Failed to delete advance'))
            setDeletingId(null)
        }
    })

    const workerTypeLabel = selectedWorker
        ? selectedWorker.type === 'meter'
            ? t('payroll.advances.piece_rate')
            : (selectedWorker.role ? t(`workers.roles.${selectedWorker.role}`) : t('payroll.advances.fixed'))
        : null

    return (
        <div className="space-y-5 pb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl border border-saffron-soft bg-saffron-soft/70 text-saffron-deep shadow-xs">
                        <HandCoins className="size-5" />
                    </div>
                    <h1 className="text-[1.65rem] font-bold leading-tight text-ink md:text-3xl">
                        {t('payroll.advances.title')}
                    </h1>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        {t('payroll.advances.subtitle')}
                    </p>
                </div>

                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button
                            className="w-full md:w-auto"
                            disabled={!selectedWorker}
                        >
                            <Plus className="size-4" />
                            {t('payroll.advances.give_advance')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('payroll.advances.dialog.title')} {selectedWorker ? tl(selectedWorker.name) : ''}
                            </DialogTitle>
                            <DialogDescription>
                                {t('payroll.advances.dialog.desc')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border border-hairline bg-surface-soft/50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t('payroll.advances.select_worker')}
                                </p>
                                <div className="mt-2 flex items-center gap-3">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-saffron-soft text-sm font-bold text-saffron-deep">
                                        {selectedWorker ? tl(selectedWorker.name)[0] : '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-ink">
                                            {selectedWorker ? tl(selectedWorker.name) : t('payroll.advances.select_worker')}
                                        </p>
                                        {workerTypeLabel && (
                                            <p className="text-xs text-muted-foreground">{workerTypeLabel}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="advance-amount">{t('payroll.advances.dialog.amount')}</Label>
                                <Input
                                    id="advance-amount"
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="e.g. 500"
                                    value={newAmount}
                                    onChange={(e) => setNewAmount(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex flex-wrap gap-2">
                                    {[500, 1000, 2000].map(amount => (
                                        <Button
                                            key={amount}
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() => setNewAmount(String(amount))}
                                        >
                                            {formatINR(amount)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="advance-desc">{t('payroll.advances.dialog.reason')}</Label>
                                <Input
                                    id="advance-desc"
                                    placeholder={t('payroll.advances.dialog.reason_placeholder')}
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowAddDialog(false)}
                            >
                                {t('payroll.advances.dialog.cancel')}
                            </Button>
                            <Button
                                onClick={() => createMutation.mutate()}
                                disabled={createMutation.isPending || !newAmount || parseFloat(newAmount) <= 0}
                            >
                                {createMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <HandCoins className="size-4" />
                                )}
                                {t('payroll.advances.dialog.record')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="overflow-hidden py-0">
                    <CardHeader className="border-b border-hairline bg-surface/80 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-sm font-semibold text-ink">
                                {t('payroll.advances.select_worker')}
                            </CardTitle>
                            <Badge variant="secondary">{filteredWorkers.length}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={t('payroll.advances.search_placeholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-11 rounded-lg pl-9"
                            />
                        </div>

                        {workersLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="max-h-[470px] space-y-1 overflow-y-auto pr-1">
                                {filteredWorkers.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-hairline bg-surface-soft/35 py-8 text-center">
                                        <p className="text-sm text-muted-foreground">{t('payroll.advances.no_workers')}</p>
                                    </div>
                                ) : (
                                    filteredWorkers.map(w => {
                                        const isSelected = selectedWorker?.id === w.id && selectedWorker?.type === w.type
                                        const roleLabel = w.type === 'meter'
                                            ? t('payroll.advances.piece_rate')
                                            : (w.role ? t(`workers.roles.${w.role}`) : t('payroll.advances.fixed'))

                                        return (
                                            <button
                                                key={`${w.type}-${w.id}`}
                                                onClick={() => { setSelectedWorker(w); setSearch('') }}
                                                className={cn(
                                                    'group w-full rounded-xl border px-3 py-3 text-left transition-all',
                                                    isSelected
                                                        ? 'border-saffron bg-saffron-soft/50 shadow-xs'
                                                        : 'border-transparent hover:border-hairline hover:bg-surface-soft/45'
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        'flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                                                        isSelected
                                                            ? 'bg-saffron text-white'
                                                            : 'bg-surface-soft text-body group-hover:bg-saffron-soft group-hover:text-saffron-deep'
                                                    )}>
                                                        {tl(w.name)[0]}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-ink">{tl(w.name)}</p>
                                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{roleLabel}</p>
                                                    </div>
                                                    {isSelected && <CheckCircle2 className="size-4 shrink-0 text-saffron-deep" />}
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-h-[560px] overflow-hidden py-0">
                    {selectedWorker ? (
                        <>
                            <div className="border-b border-hairline bg-loom px-4 py-5 text-white sm:px-5">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-12 items-center justify-center rounded-xl bg-white/12 text-base font-bold ring-1 ring-white/15">
                                            {tl(selectedWorker.name)[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-xl font-semibold leading-tight text-white">
                                                    {tl(selectedWorker.name)}
                                                </h2>
                                                {workerTypeLabel && (
                                                    <Badge className="border-white/10 bg-white/12 text-white">
                                                        {workerTypeLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-white/62">
                                                {totalPending > 0
                                                    ? `${formatINR(totalPending)} ${t('payroll.status.pending').toLowerCase()}`
                                                    : t('payroll.advances.list.no_advances')}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="saffron"
                                        onClick={() => setShowAddDialog(true)}
                                        className="w-full md:w-auto"
                                    >
                                        <Plus className="size-4" />
                                        {t('payroll.advances.give_advance')}
                                    </Button>
                                </div>
                            </div>

                            <CardContent className="space-y-5 p-4 sm:p-5">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-warning-soft bg-warning-soft/45 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-warning">{t('payroll.status.pending')}</p>
                                            <WalletCards className="size-4 text-warning" />
                                        </div>
                                        <p className="mt-3 text-2xl font-bold text-ink">{formatINR(totalPending)}</p>
                                    </div>
                                    <div className="rounded-xl border border-success-soft bg-success-soft/60 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-success">{t('payroll.status.deducted')}</p>
                                            <ShieldCheck className="size-4 text-success" />
                                        </div>
                                        <p className="mt-3 text-2xl font-bold text-ink">{formatINR(totalDeducted)}</p>
                                    </div>
                                    <div className="rounded-xl border border-hairline bg-surface-soft/55 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('payroll.metrics.total_debt')}</p>
                                            <CircleDollarSign className="size-4 text-body" />
                                        </div>
                                        <p className="mt-3 text-2xl font-bold text-ink">{formatINR(totalPending + totalDeducted)}</p>
                                    </div>
                                </div>

                                <div className={cn(
                                    'rounded-xl border p-4',
                                    debtLevel === 'red'
                                        ? 'border-risk-soft bg-risk-soft/60'
                                        : debtLevel === 'amber'
                                            ? 'border-warning-soft bg-warning-soft/60'
                                            : 'border-success-soft bg-success-soft/50'
                                )}>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                                                debtLevel === 'red'
                                                    ? 'bg-risk text-white'
                                                    : debtLevel === 'amber'
                                                        ? 'bg-warning text-white'
                                                        : 'bg-success text-white'
                                            )}>
                                                {debtLevel === 'safe' ? <ShieldCheck className="size-4" /> : <TrendingUp className="size-4" />}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-ink">
                                                        {debtLevel === 'red'
                                                            ? t('payroll.advances.risk.high')
                                                            : debtLevel === 'amber'
                                                                ? t('payroll.advances.risk.moderate')
                                                                : t('payroll.advances.risk.safe')}
                                                    </p>
                                                    <DebtBadge level={debtLevel} ratio={debtRatio} />
                                                </div>
                                                <p className="mt-1 text-xs leading-5 text-body">
                                                    {tl(selectedWorker.name)} {t('payroll.advances.risk.owes')} {formatINR(totalPending)} {t('payroll.advances.risk.against')} ~{formatINR(typicalMonthly || 0)}/{t('payroll.advances.risk.typical_earnings')}
                                                    {debtLevel === 'red'
                                                        ? ` ${t('payroll.advances.risk.high_warning')}`
                                                        : debtLevel === 'amber'
                                                            ? ` ${t('payroll.advances.risk.moderate_warning')}`
                                                            : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-white/65 sm:w-40">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full',
                                                    debtLevel === 'red' ? 'bg-risk' : debtLevel === 'amber' ? 'bg-warning' : 'bg-success'
                                                )}
                                                style={{ width: `${Math.min(Math.max(debtRatio * 100, totalPending > 0 ? 8 : 0), 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <section className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-semibold text-ink">
                                                {t('payroll.advances.list.ledger')}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                {pendingAdvances.length} {t('payroll.status.pending').toLowerCase()} · {deductedAdvances.length} {t('payroll.status.deducted').toLowerCase()}
                                            </p>
                                        </div>
                                        <ReceiptText className="size-5 text-muted-foreground" />
                                    </div>

                                    {advancesLoading ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="rounded-xl border border-hairline bg-surface p-4">
                                                    <div className="flex justify-between gap-4">
                                                        <div className="space-y-2">
                                                            <div className="h-4 w-24 animate-pulse rounded bg-surface-soft" />
                                                            <div className="h-3 w-44 animate-pulse rounded bg-surface-soft/70" />
                                                        </div>
                                                        <div className="h-7 w-20 animate-pulse rounded bg-surface-soft" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : !advances || advances.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/35 px-5 py-12 text-center">
                                            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-surface text-muted-foreground shadow-xs">
                                                <HandCoins className="size-6" />
                                            </div>
                                            <p className="mt-4 font-semibold text-ink">{t('payroll.advances.list.no_advances')}</p>
                                            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                                                {t('payroll.advances.list.click_to_add')}
                                            </p>
                                            <Button className="mt-5" onClick={() => setShowAddDialog(true)}>
                                                <Plus className="size-4" />
                                                {t('payroll.advances.give_advance')}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
                                            {pendingAdvances.map(adv => (
                                                <div key={adv.id} className="grid gap-3 border-b border-hairline p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
                                                    <div className="flex min-w-0 gap-3">
                                                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
                                                            <Clock className="size-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-lg font-bold text-ink">{formatINR(adv.amount)}</p>
                                                                <Badge variant="warning">{t('payroll.status.pending')}</Badge>
                                                            </div>
                                                            <p className="mt-1 truncate text-sm text-body">
                                                                {adv.description || t('payroll.advances.list.no_reason')}
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {formatAdvanceDate(adv.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size={deletingId === adv.id ? 'sm' : 'icon-sm'}
                                                        variant={deletingId === adv.id ? 'destructive' : 'ghost'}
                                                        className={cn(
                                                            'justify-self-start sm:justify-self-end',
                                                            deletingId !== adv.id && 'text-risk hover:bg-risk-soft hover:text-risk'
                                                        )}
                                                        onClick={() => {
                                                            if (deletingId === adv.id) {
                                                                deleteMutation.mutate(adv.id)
                                                            } else {
                                                                setDeletingId(adv.id)
                                                                setTimeout(() => setDeletingId(null), 3000)
                                                            }
                                                        }}
                                                        disabled={deleteMutation.isPending}
                                                        aria-label={deletingId === adv.id ? t('payroll.advances.dialog.sure') : t('payroll.advances.list.delete_advance')}
                                                    >
                                                        {deletingId === adv.id ? (
                                                            deleteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : t('payroll.advances.dialog.sure')
                                                        ) : (
                                                            <Trash2 className="size-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}

                                            {deductedAdvances.map(adv => (
                                                <div key={adv.id} className="grid gap-3 border-b border-hairline p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
                                                    <div className="flex min-w-0 gap-3">
                                                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
                                                            <CheckCircle2 className="size-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-lg font-bold text-body line-through decoration-hairline-strong">{formatINR(adv.amount)}</p>
                                                                <Badge variant="success">{t('payroll.status.deducted')}</Badge>
                                                            </div>
                                                            <p className="mt-1 truncate text-sm text-muted-foreground">
                                                                {adv.description || t('payroll.advances.list.no_reason')}
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {t('payroll.advances.list.given')} {formatAdvanceDate(adv.created_at, { day: 'numeric', month: 'short' })}
                                                                {adv.deducted_in_month && (
                                                                    <> · {t('payroll.advances.list.settled_in')} {adv.deducted_in_month}</>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="flex min-h-[560px] items-center justify-center p-6">
                            <div className="w-full max-w-2xl">
                                {allPendingLoading ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : allPendingAdvances && allPendingAdvances.length > 0 ? (
                                    <div className="space-y-4">
                                        <div>
                                            <h2 className="text-xl font-semibold text-ink">Pending advances</h2>
                                            <p className="mt-1 text-sm text-muted-foreground">Select a worker on the left to manage recoveries or add another advance.</p>
                                        </div>
                                        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
                                            {allPendingAdvances.map((adv) => (
                                                <div key={adv.id} className="grid gap-3 border-b border-hairline p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-semibold text-ink">{tl(adv.workerName)}</p>
                                                            <Badge variant="warning">{t('payroll.status.pending')}</Badge>
                                                        </div>
                                                        <p className="mt-1 text-sm text-body">{formatINR(adv.amount)} · {adv.description || t('payroll.advances.list.no_reason')}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">{formatAdvanceDate(adv.created_at)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-saffron-soft text-saffron-deep shadow-xs">
                                            <UserRound className="size-8" />
                                        </div>
                                        <h2 className="mt-5 text-xl font-semibold text-ink">{t('emptyState.advances.title')}</h2>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('payroll.advances.list.select_above')}</p>
                                        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                                            <Button
                                                onClick={() => {
                                                    if (workers && workers.length > 0) {
                                                        setSelectedWorker(workers[0])
                                                        setShowAddDialog(true)
                                                    }
                                                }}
                                                disabled={!workers || workers.length === 0}
                                            >
                                                <Plus className="size-4" />
                                                {t('emptyState.advances.cta')}
                                            </Button>
                                            {(!workers || workers.length === 0) && (
                                                <Button variant="outline" asChild>
                                                    <Link href="/owner/fixed-workers">{t('workers.add_worker')}</Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    )
}
