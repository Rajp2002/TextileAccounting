'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatINR, sumAdvances } from '@/lib/finance'
import { createAdvance, deleteAdvance } from './actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { cn } from '@/lib/utils'
import {
    HandCoins, Plus, Trash2, Search, AlertCircle,
    Clock, CheckCircle2, AlertTriangle, TrendingUp, Loader2
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Worker {
    id: number
    name: string
    type: 'meter' | 'fixed'
    role?: string
    monthly_salary?: number
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

    // ── Fetch all workers (both types) ──────────────────────────────────────
    const { data: workers, isLoading: workersLoading } = useQuery({
        queryKey: ['all_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const [{ data: meterWorkers }, { data: fixedWorkers }] = await Promise.all([
                supabase
                    .from('workers')
                    .select('id, name')
                    .eq('org_id', userProfile!.org_id)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('fixed_workers')
                    .select('id, name, role, monthly_salary')
                    .eq('org_id', userProfile!.org_id)
                    .eq('is_active', true)
                    .order('name'),
            ])

            const all: Worker[] = [
                ...(meterWorkers || []).map((w: any) => ({ id: w.id, name: w.name, type: 'meter' as const })),
                ...(fixedWorkers || []).map((w: any) => ({
                    id: w.id, name: w.name, type: 'fixed' as const,
                    role: w.role, monthly_salary: w.monthly_salary
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

    // ── Estimate typical monthly earnings (for debt-to-income) ──────────────
    const { data: typicalMonthly } = useQuery({
        queryKey: ['typical_monthly', userProfile?.org_id, selectedWorker?.type, selectedWorker?.id],
        enabled: !!userProfile?.org_id && !!selectedWorker,
        queryFn: async () => {
            if (selectedWorker!.type === 'fixed') {
                return selectedWorker!.monthly_salary || 0
            }
            // For piece-rate workers, estimate from last month's production
            const now = new Date()
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const monthStr = lastMonth.toISOString().substring(0, 7)

            const { data: logs } = await supabase
                .from('production_logs')
                .select('meters, machine_id')
                .eq('org_id', userProfile!.org_id)
                .eq('worker_id', selectedWorker!.id)
                .gte('date', `${monthStr}-01`)
                .lte('date', `${monthStr}-31`)

            const { data: machines } = await supabase
                .from('machines')
                .select('id, rate_per_meter')
                .eq('org_id', userProfile!.org_id)

            const machineMap = Object.fromEntries((machines || []).map((m: any) => [m.id, m.rate_per_meter || 0]))
            const total = (logs || []).reduce((sum: number, log: any) => {
                return sum + (parseFloat(log.meters) || 0) * (machineMap[log.machine_id] || 0)
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
        onSuccess: () => {
            toast.success('Advance recorded')
            setShowAddDialog(false)
            setNewAmount('')
            setNewDescription('')
            queryClient.invalidateQueries({ queryKey: ['worker_advances'] })
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to create advance')
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
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete advance')
            setDeletingId(null)
        }
    })

    return (
        <div className="p-4 md:p-6 space-y-6 pb-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <HandCoins className="h-6 w-6 text-amber-600" />
                    Advances (Upaad)
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Track and manage worker advances. Deducted automatically during payroll settlement.
                </p>
            </div>

            {/* Worker Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-700">Select Worker</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search workers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {workersLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border p-1">
                            {filteredWorkers.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No workers found</p>
                            ) : (
                                filteredWorkers.map(w => (
                                    <button
                                        key={`${w.type}-${w.id}`}
                                        onClick={() => { setSelectedWorker(w); setSearch('') }}
                                        className={cn(
                                            'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                                            selectedWorker?.id === w.id && selectedWorker?.type === w.type
                                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                                : 'hover:bg-gray-50 text-gray-700'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                                {w.name[0]}
                                            </div>
                                            <span>{w.name}</span>
                                        </div>
                                        <span className={cn(
                                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                            w.type === 'meter'
                                                ? 'bg-indigo-50 text-indigo-600'
                                                : 'bg-orange-50 text-orange-600'
                                        )}>
                                            {w.type === 'meter' ? 'Piece-Rate' : w.role || 'Fixed'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Worker Advance Details ── */}
            {selectedWorker && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <Card className="text-center">
                            <CardContent className="pt-4 pb-3">
                                <div className="text-xs text-gray-500 mb-1">Pending</div>
                                <div className="text-lg font-bold text-amber-700">{formatINR(totalPending)}</div>
                            </CardContent>
                        </Card>
                        <Card className="text-center border-green-200">
                            <CardContent className="pt-4 pb-3">
                                <div className="text-xs text-gray-500 mb-1">Deducted</div>
                                <div className="text-lg font-bold text-green-700">{formatINR(totalDeducted)}</div>
                            </CardContent>
                        </Card>
                        <Card className="text-center">
                            <CardContent className="pt-4 pb-3">
                                <div className="text-xs text-gray-500 mb-1">Total Debt</div>
                                <div className="text-lg font-bold text-gray-900">
                                    {formatINR(totalPending + totalDeducted)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Debt-to-Income Indicator */}
                    {debtLevel !== 'safe' && (
                        <div className={cn(
                            'rounded-xl px-4 py-3 flex items-start gap-3',
                            debtLevel === 'red'
                                ? 'bg-red-50 border border-red-200'
                                : 'bg-amber-50 border border-amber-200'
                        )}>
                            <TrendingUp className={cn(
                                'h-5 w-5 mt-0.5 flex-shrink-0',
                                debtLevel === 'red' ? 'text-red-600' : 'text-amber-600'
                            )} />
                            <div>
                                <p className={cn(
                                    'text-sm font-semibold',
                                    debtLevel === 'red' ? 'text-red-800' : 'text-amber-800'
                                )}>
                                    {debtLevel === 'red' ? 'High Debt Risk' : 'Moderate Debt'}
                                    <DebtBadge level={debtLevel} ratio={debtRatio} />
                                </p>
                                <p className={cn(
                                    'text-xs mt-0.5',
                                    debtLevel === 'red' ? 'text-red-600' : 'text-amber-600'
                                )}>
                                    {selectedWorker.name} owes {formatINR(totalPending)} against
                                    ~{formatINR(typicalMonthly || 0)}/month typical earnings.
                                    {debtLevel === 'red'
                                        ? ' Consider not giving more advances.'
                                        : ' Approaching the monthly earnings threshold.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Header + Add button */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {selectedWorker.name}&apos;s Advances
                        </h2>
                        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-1.5">
                                    <Plus className="h-4 w-4" />
                                    Give Advance
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader>
                                    <DialogTitle>Give Advance to {selectedWorker.name}</DialogTitle>
                                    <DialogDescription>
                                        This will be automatically deducted from their next payroll settlement.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="advance-amount">Amount (₹)</Label>
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
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="advance-desc">Reason (optional)</Label>
                                        <Input
                                            id="advance-desc"
                                            placeholder="e.g. Medicine, Rent, Home travel"
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
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => createMutation.mutate()}
                                        disabled={createMutation.isPending || !newAmount || parseFloat(newAmount) <= 0}
                                    >
                                        {createMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                        ) : (
                                            <HandCoins className="h-4 w-4 mr-1.5" />
                                        )}
                                        Record Advance
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Advance List */}
                    <div className="space-y-2">
                        {advancesLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="border rounded-xl p-4 bg-white">
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-2">
                                                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                                                <div className="h-3 w-32 bg-gray-50 rounded animate-pulse" />
                                            </div>
                                            <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : !advances || advances.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <HandCoins className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500 font-medium">No advances recorded</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Click &quot;Give Advance&quot; to record a new advance for this worker
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {/* Pending advances */}
                                {pendingAdvances.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                                            Pending ({pendingAdvances.length})
                                        </p>
                                        {pendingAdvances.map(adv => (
                                            <div
                                                key={adv.id}
                                                className="border border-amber-200 bg-amber-50/30 rounded-xl p-4 flex items-center justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-900">
                                                            {formatINR(adv.amount)}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                            <Clock className="h-3 w-3" />
                                                            Pending
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                                                        {adv.description || 'No reason specified'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {new Date(adv.created_at).toLocaleDateString('en-IN', {
                                                            day: 'numeric', month: 'short', year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:bg-red-50 hover:text-red-700 h-8 w-8 p-0 flex-shrink-0"
                                                    onClick={() => {
                                                        if (deletingId === adv.id) {
                                                            deleteMutation.mutate(adv.id)
                                                        } else {
                                                            setDeletingId(adv.id)
                                                            setTimeout(() => setDeletingId(null), 3000)
                                                        }
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    {deletingId === adv.id ? (
                                                        <span className="text-[10px] font-bold">Sure?</span>
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Deducted advances */}
                                {deductedAdvances.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                                            Deducted ({deductedAdvances.length})
                                        </p>
                                        {deductedAdvances.map(adv => (
                                            <div
                                                key={adv.id}
                                                className="border border-green-200 bg-green-50/20 rounded-xl p-4"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-600 line-through">
                                                                {formatINR(adv.amount)}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Deducted
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-400 mt-0.5 truncate">
                                                            {adv.description || 'No reason specified'}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            Given: {new Date(adv.created_at).toLocaleDateString('en-IN', {
                                                                day: 'numeric', month: 'short'
                                                            })}
                                                            {adv.deducted_in_month && (
                                                                <> · Settled in {adv.deducted_in_month}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* No worker selected state */}
            {!selectedWorker && !workersLoading && (
                <Card>
                    <CardContent className="py-16 text-center">
                        <HandCoins className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400 font-medium">Select a worker above to manage their advances</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
