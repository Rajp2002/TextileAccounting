'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    AlertTriangle,
    CheckCircle2,
    Loader2,
    MapPin,
    Package,
    Plus,
    Search,
    ShieldCheck,
    Truck,
    Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getDispatchesForOrder,
    type DispatchSummary,
} from '../orders/actions'
import { CreateDispatchModal } from '@/components/dispatches/DispatchModals'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    createFabricPackage,
    updateFabricInspection,
    updateFabricPackageState,
    correctFabricPackageMetres,
    type FabricPackageRow,
    type FabricStockBoardData,
} from './actions'
import { cn } from '@/lib/utils'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'

type InspectionStatus = FabricPackageRow['inspection_status']
type PackageType = FabricPackageRow['package_type']

const stateOrder = ['all', 'ready', 'reserved', 'uninspected', 'dispatched', 'claimed', 'returned'] as const

function stateBadge(state: FabricPackageRow['stock_state']) {
    switch (state) {
        case 'ready':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        case 'reserved':
            return 'bg-amber-50 text-amber-700 border-amber-200'
        case 'dispatched':
            return 'bg-sky-50 text-sky-700 border-sky-200'
        case 'claimed':
            return 'bg-rose-50 text-rose-700 border-rose-200'
        case 'returned':
            return 'bg-violet-50 text-violet-700 border-violet-200'
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200'
    }
}

function inspectionBadge(status: FabricPackageRow['inspection_status']) {
    switch (status) {
        case 'pass':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        case 'minor_defect':
            return 'bg-amber-50 text-amber-700 border-amber-200'
        case 'reject':
            return 'bg-rose-50 text-rose-700 border-rose-200'
        default:
            return 'bg-slate-50 text-slate-600 border-slate-200'
    }
}

function PackageMetric({
    title,
    value,
    tone,
}: {
    title: string
    value: number
    tone: string
}) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{title}</p>
                <p className={cn('mt-2 text-2xl font-black tabular-nums', tone)}>
                    {value.toFixed(0)}
                    <span className="ml-1 text-xs font-bold opacity-60">m</span>
                </p>
            </CardContent>
        </Card>
    )
}

function NewPackageDialog({
    open,
    onClose,
    orders,
    onSaved,
}: {
    open: boolean
    onClose: () => void
    orders: FabricStockBoardData['orders']
    onSaved: () => void
}) {
    const [pending, startTransition] = useTransition()
    const [form, setForm] = useState<{
        order_id: string
        package_no: string
        package_type: PackageType
        units_count: string
        metres: string
        grade: string
        inspection_status: InspectionStatus
        location: string
        inspection_notes: string
        inspection_photo_url: string
    }>({
        order_id: orders[0]?.id ?? '',
        package_no: '',
        package_type: 'bulk',
        units_count: '1',
        metres: '',
        grade: 'A',
        inspection_status: 'pending',
        location: 'Grey Floor',
        inspection_notes: '',
        inspection_photo_url: '',
    })

    const handleSubmit = () => {
        startTransition(async () => {
            const res = await createFabricPackage({
                ...form,
                order_id: form.order_id || orders[0]?.id || '',
                units_count: Number(form.units_count),
                metres: Number(form.metres),
            })
            if ('error' in res) {
                toast.error(res.error)
                return
            }
            toast.success('Package created')
            onSaved()
            onClose()
            setForm({
                order_id: orders[0]?.id ?? '',
                package_no: '',
                package_type: 'bulk',
                units_count: '1',
                metres: '',
                grade: 'A',
                inspection_status: 'pending',
                location: 'Grey Floor',
                inspection_notes: '',
                inspection_photo_url: '',
            })
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create Grey Fabric Package</DialogTitle>
                    <DialogDescription>
                        Use a bulk package when exact roll-level entry is too slow, like 5 taka / 1,250m.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Order</Label>
                        <Select value={form.order_id} onValueChange={(value) => setForm((prev) => ({ ...prev, order_id: value }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select order" />
                            </SelectTrigger>
                            <SelectContent>
                                {orders.map((order) => (
                                    <SelectItem key={order.id} value={order.id}>
                                        {(order.quality_label || 'Unnamed')} - {order.party_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Package no. (optional)</Label>
                        <Input
                            value={form.package_no}
                            onChange={(event) => setForm((prev) => ({ ...prev, package_no: event.target.value }))}
                            placeholder="GF-000321"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={form.package_type} onValueChange={(value) => setForm((prev) => ({ ...prev, package_type: value as PackageType }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="roll">Roll</SelectItem>
                                <SelectItem value="bale">Bale</SelectItem>
                                <SelectItem value="package">Package</SelectItem>
                                <SelectItem value="bulk">Bulk package</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Units count</Label>
                        <Input
                            type="number"
                            min="1"
                            value={form.units_count}
                            onChange={(event) => setForm((prev) => ({ ...prev, units_count: event.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Metres</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.metres}
                            onChange={(event) => setForm((prev) => ({ ...prev, metres: event.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Grade</Label>
                        <Input
                            value={form.grade}
                            onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Inspection</Label>
                        <Select value={form.inspection_status} onValueChange={(value) => setForm((prev) => ({ ...prev, inspection_status: value as InspectionStatus }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Uninspected</SelectItem>
                                <SelectItem value="pass">Pass</SelectItem>
                                <SelectItem value="minor_defect">Minor defect</SelectItem>
                                <SelectItem value="reject">Reject</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Location</Label>
                        <Input
                            value={form.location}
                            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                            placeholder="Rack A2 / Godown / Grey floor"
                        />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.inspection_notes}
                            onChange={(event) => setForm((prev) => ({ ...prev, inspection_notes: event.target.value }))}
                            placeholder="Defects, bale details, floor notes..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={pending} onClick={handleSubmit}>
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Save package
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function InspectDialog({
    open,
    pkg,
    onClose,
    onSaved,
}: {
    open: boolean
    pkg: FabricPackageRow | null
    onClose: () => void
    onSaved: () => void
}) {
    const [pending, startTransition] = useTransition()
    const [form, setForm] = useState<{
        inspection_status: InspectionStatus
        grade: string
        location: string
        inspection_notes: string
        inspection_photo_url: string
    }>(() => ({
        inspection_status: pkg?.inspection_status || 'pending',
        grade: pkg?.grade || 'A',
        location: pkg?.location || 'Grey Floor',
        inspection_notes: pkg?.inspection_notes || '',
        inspection_photo_url: pkg?.inspection_photo_url || '',
    }))

    if (!pkg) return null

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Inspect {pkg.package_no}</DialogTitle>
                    <DialogDescription>
                        Update inspection, grade, and floor location in one pass.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Inspection</Label>
                        <Select value={form.inspection_status} onValueChange={(value) => setForm((prev) => ({ ...prev, inspection_status: value as InspectionStatus }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Uninspected</SelectItem>
                                <SelectItem value="pass">Pass</SelectItem>
                                <SelectItem value="minor_defect">Minor defect</SelectItem>
                                <SelectItem value="reject">Reject</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Grade</Label>
                        <Input value={form.grade} onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Location</Label>
                        <Input value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={form.inspection_notes} onChange={(event) => setForm((prev) => ({ ...prev, inspection_notes: event.target.value }))} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        disabled={pending}
                        onClick={() => {
                            startTransition(async () => {
                                const res = await updateFabricInspection({
                                    package_id: pkg.id,
                                    ...form,
                                })
                                if ('error' in res) {
                                    toast.error(res.error)
                                    return
                                }
                                toast.success('Inspection updated')
                                onSaved()
                                onClose()
                            })
                        }}
                    >
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Save inspection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function StockClient({
    initialData,
    hideHeader = false,
}: {
    initialData: FabricStockBoardData
    hideHeader?: boolean
}) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [stateFilter, setStateFilter] = useState<(typeof stateOrder)[number]>('all')
    const [createOpen, setCreateOpen] = useState(false)
    const [inspectPkg, setInspectPkg] = useState<FabricPackageRow | null>(null)
    const [correctPkg, setCorrectPkg] = useState<FabricPackageRow | null>(null)
    const [confirmCorrectionOpen, setConfirmCorrectionOpen] = useState(false)
    const [metresDraft, setMetresDraft] = useState('')
    const [correctionNote, setCorrectionNote] = useState('')
    const [statePending, startStateTransition] = useTransition()
    const [correctPending, startCorrectTransition] = useTransition()

    // Dispatch Flow State
    const [dispatchingOrder, setDispatchingOrder] = useState<{ id: string, party_name: string, quality_label: string | null, total_target_meters: number } | null>(null)
    const [dispatchSummary, setDispatchSummary] = useState<DispatchSummary | null>(null)
    const [fetchingSummary, setFetchingSummary] = useState(false)

    const handleStartDispatch = async (pkg: FabricPackageRow) => {
        setDispatchingOrder({
            id: pkg.orders.id,
            party_name: pkg.orders.party_name,
            quality_label: pkg.orders.quality_label,
            total_target_meters: Number(pkg.orders.total_target_meters || 0)
        })
        setFetchingSummary(true)
        const res = await getDispatchesForOrder(pkg.orders.id)
        setFetchingSummary(false)
        if ('error' in res) {
            toast.error(res.error)
            setDispatchingOrder(null)
        } else {
            setDispatchSummary(res)
        }
    }

    const filtered = useMemo(() => {
        return initialData.packages.filter((pkg) => {
            const matchesState = stateFilter === 'all' || pkg.stock_state === stateFilter
            const haystack = `${pkg.package_no} ${pkg.orders.party_name} ${pkg.orders.quality_label || ''} ${pkg.location}`.toLowerCase()
            const matchesQuery = haystack.includes(query.toLowerCase())
            return matchesState && matchesQuery
        })
    }, [initialData.packages, query, stateFilter])

    const totals = useMemo(() => {
        return initialData.packages.reduce((acc, pkg) => {
            acc[pkg.stock_state] += Number(pkg.metres)
            return acc
        }, {
            uninspected: 0,
            ready: 0,
            reserved: 0,
            dispatched: 0,
            claimed: 0,
            returned: 0,
        } as Record<FabricPackageRow['stock_state'], number>)
    }, [initialData.packages])

    const refresh = () => router.refresh()

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                {!hideHeader ? (
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Grey Fabric Stock</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            See what is ready, where it is sitting, and what has already gone out by package.
                        </p>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Grey Fabric Stock</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            See what is ready, where it is sitting, and what has already gone out by package.
                        </p>
                    </div>
                )}
                <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add package
                </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <PackageMetric title="Ready" value={totals.ready} tone="text-emerald-600" />
                <PackageMetric title="Reserved" value={totals.reserved} tone="text-amber-600" />
                <PackageMetric title="Uninspected" value={totals.uninspected} tone="text-slate-700" />
                <PackageMetric title="Dispatched" value={totals.dispatched} tone="text-sky-700" />
                <PackageMetric title="Claims / Returns" value={totals.claimed + totals.returned} tone="text-rose-600" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search package no, party, quality, location..."
                        className="pl-10"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    {stateOrder.map((state) => (
                        <Button
                            key={state}
                            variant={stateFilter === state ? 'default' : 'outline'}
                            className={cn(stateFilter === state ? 'bg-slate-900 text-white hover:bg-slate-800' : '')}
                            onClick={() => setStateFilter(state)}
                        >
                            {state === 'all' ? 'All' : state.replace('_', ' ')}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4">
                {filtered.length === 0 ? (
                    <Card className="border-dashed border-slate-300">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <Package className="mb-3 h-10 w-10 text-slate-400" />
                            <p className="text-lg font-bold text-slate-800">No packages found</p>
                            <p className="mt-1 text-sm text-slate-500">Try a different filter, or create a bulk package from today’s production.</p>
                        </CardContent>
                    </Card>
                ) : (
                    filtered.map((pkg) => (
                        <Card key={pkg.id} className="border-slate-200 shadow-sm">
                            <CardContent className="space-y-4 p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-lg font-black text-slate-900">{pkg.package_no}</p>
                                            <Badge className={cn('border font-bold capitalize', stateBadge(pkg.stock_state))}>{pkg.stock_state.replace('_', ' ')}</Badge>
                                            <Badge className={cn('border font-bold capitalize', inspectionBadge(pkg.inspection_status))}>{pkg.inspection_status.replace('_', ' ')}</Badge>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700">
                                            {pkg.orders.quality_label || 'Unnamed'} · {pkg.orders.party_name}
                                        </p>
                                        <p className="flex items-center gap-1 text-xs text-slate-500">
                                            <MapPin className="h-3.5 w-3.5" /> {pkg.location}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</p>
                                            <p className="font-bold capitalize text-slate-800">{pkg.package_type}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Units</p>
                                            <p className="font-bold text-slate-800">{pkg.units_count}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metres</p>
                                            <p className="font-bold tabular-nums text-slate-800">{Number(pkg.metres).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grade</p>
                                            <p className="font-bold text-slate-800">{pkg.grade}</p>
                                        </div>
                                    </div>
                                </div>

                                {pkg.inspection_notes && (
                                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                        {pkg.inspection_notes}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" onClick={() => setInspectPkg(pkg)}>
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        Inspect
                                    </Button>

                                    {pkg.stock_state === 'ready' && (
                                        <Button
                                            variant="outline"
                                            disabled={statePending}
                                            onClick={() => {
                                                startStateTransition(async () => {
                                                    const res = await updateFabricPackageState({ package_id: pkg.id, stock_state: 'reserved' })
                                                    if ('error' in res) {
                                                        toast.error(res.error)
                                                        return
                                                    }
                                                    toast.success('Package reserved')
                                                    refresh()
                                                })
                                            }}
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Reserve
                                        </Button>
                                    )}

                                    {pkg.stock_state === 'reserved' && (
                                        <Button
                                            variant="outline"
                                            disabled={statePending}
                                            onClick={() => {
                                                startStateTransition(async () => {
                                                    const res = await updateFabricPackageState({ package_id: pkg.id, stock_state: 'ready' })
                                                    if ('error' in res) {
                                                        toast.error(res.error)
                                                        return
                                                    }
                                                    toast.success('Package moved back to ready')
                                                    refresh()
                                                })
                                            }}
                                        >
                                            <Undo2 className="mr-2 h-4 w-4" />
                                            Unreserve
                                        </Button>
                                    )}

                                    {pkg.stock_state === 'claimed' && (
                                        <Button
                                            variant="outline"
                                            disabled={statePending}
                                            onClick={() => {
                                                startStateTransition(async () => {
                                                    const res = await updateFabricPackageState({ package_id: pkg.id, stock_state: 'returned' })
                                                    if ('error' in res) {
                                                        toast.error(res.error)
                                                        return
                                                    }
                                                    toast.success('Package marked returned')
                                                    refresh()
                                                })
                                            }}
                                        >
                                            <AlertTriangle className="mr-2 h-4 w-4" />
                                            Mark returned
                                        </Button>
                                    )}

                                    {['uninspected', 'ready', 'reserved', 'returned'].includes(pkg.stock_state) && (
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setCorrectPkg(pkg)
                                                setMetresDraft(String(Number(pkg.metres).toFixed(2)))
                                                setCorrectionNote('')
                                            }}
                                        >
                                            Correct metres
                                        </Button>
                                    )}

                                    {['ready', 'reserved'].includes(pkg.stock_state) && (
                                        <Button
                                            className="bg-indigo-600 text-white hover:bg-indigo-500 font-bold"
                                            onClick={() => handleStartDispatch(pkg)}
                                        >
                                            <Truck className="mr-2 h-4 w-4" />
                                            Dispatch
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <NewPackageDialog open={createOpen} onClose={() => setCreateOpen(false)} orders={initialData.orders} onSaved={refresh} />
            <InspectDialog key={inspectPkg?.id || 'inspect'} open={Boolean(inspectPkg)} pkg={inspectPkg} onClose={() => setInspectPkg(null)} onSaved={refresh} />

            <Dialog open={Boolean(correctPkg)} onOpenChange={(next) => !next && setCorrectPkg(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Correct package metres</DialogTitle>
                        <DialogDescription>
                            Review the corrected metres and note for {correctPkg?.package_no}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Metres</Label>
                            <Input type="number" min="0.01" step="0.01" value={metresDraft} onChange={(event) => setMetresDraft(event.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reason</Label>
                            <Textarea value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Actual checked metres / recount reason..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCorrectPkg(null)}>Cancel</Button>
                        <Button
                            disabled={!metresDraft || !correctionNote.trim()}
                            onClick={() => setConfirmCorrectionOpen(true)}
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={confirmCorrectionOpen}
                onOpenChange={setConfirmCorrectionOpen}
                title="Correct package metres"
                description={`Update ${correctPkg?.package_no ?? 'this package'} to ${metresDraft || '0'} metres? This will save the new measured quantity and correction note.`}
                confirmLabel="Save correction"
                onConfirm={() => {
                    if (!correctPkg) return
                    startCorrectTransition(async () => {
                        const res = await correctFabricPackageMetres({
                            package_id: correctPkg.id,
                            metres: Number(metresDraft),
                            correction_note: correctionNote,
                        })
                        if ('error' in res) {
                            toast.error(res.error)
                            return
                        }
                        toast.success('Package metres updated')
                        setConfirmCorrectionOpen(false)
                        setCorrectPkg(null)
                        refresh()
                    })
                }}
                isLoading={correctPending}
            />

            {correctPending && (
                <div className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Updating package…
                </div>
            )}

            {/* Quick Dispatch Modal Flow */}
            <Dialog open={fetchingSummary} onOpenChange={() => {}}>
                <DialogContent className="max-w-sm text-center py-10">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Preparing dispatch batch</DialogTitle>
                        <DialogDescription>Loading the package summary before creating a dispatch.</DialogDescription>
                    </DialogHeader>
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-600">Preparing dispatch batch...</p>
                </DialogContent>
            </Dialog>

            {dispatchingOrder && dispatchSummary && (
                <CreateDispatchModal 
                    orderId={dispatchingOrder.id}
                    availablePackages={dispatchSummary.available_packages}
                    onClose={() => {
                        setDispatchingOrder(null)
                        setDispatchSummary(null)
                    }}
                    onCreated={() => {
                        setDispatchingOrder(null)
                        setDispatchSummary(null)
                        refresh()
                    }}
                />
            )}
        </div>
    )
}
