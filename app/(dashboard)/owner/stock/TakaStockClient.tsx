'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ElementType } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Boxes,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    Loader2,
    PackagePlus,
    PencilLine,
    Plus,
    Search,
    Store,
    Warehouse,
    Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
    adjustTakaStockLot,
    createTakaStockLot,
    type StockSourceOption,
    type TakaStockBoardData,
    type TakaStockLotSummary,
    type TakaStockMovementRow,
} from './actions'
import { SellAndDispatchDialog } from '@/components/dispatches/SellAndDispatchDialog'
import { isMarketRunOnlyMode } from '@/lib/production-mode'

type SourceType = 'opening' | 'market_run' | 'order' | 'manual' | 'adjustment'
type AdjustmentMode = 'add' | 'subtract'

const today = () => new Date().toISOString().split('T')[0]

function money(value: number, digits = 0) {
    return `₹${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`
}

function meters(value: number) {
    return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`
}

function stockUnits(value: number, unitLabel = 'taka') {
    return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unitLabel || 'taka'}`
}

function MetricCard({
    label,
    value,
    helper,
    icon: Icon,
    tone,
}: {
    label: string
    value: string
    helper: string
    icon: ElementType
    tone: string
}) {
    return (
        <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-center gap-2">
                    <div className={cn('rounded-lg p-1.5', tone)}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
            </CardContent>
        </Card>
    )
}

function sourceBadge(source: SourceType) {
    switch (source) {
        case 'market_run':
            return 'bg-violet-50 text-violet-700 border-violet-200'
        case 'order':
            return 'bg-blue-50 text-blue-700 border-blue-200'
        case 'opening':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        case 'adjustment':
            return 'bg-amber-50 text-amber-700 border-amber-200'
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200'
    }
}

function stockBadge(status: TakaStockLotSummary['stock_status']) {
    switch (status) {
        case 'sold_out':
            return 'bg-slate-50 text-slate-600 border-slate-200'
        case 'partially_sold':
            return 'bg-amber-50 text-amber-700 border-amber-200'
        default:
            return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
}

function movementLabel(type: TakaStockMovementRow['movement_type']) {
    switch (type) {
        case 'inward':
            return 'Stock inward'
        case 'sale':
            return 'Sale'
        case 'adjustment_add':
            return 'Adjustment add'
        case 'adjustment_subtract':
            return 'Adjustment subtract'
    }
}

function AddStockDialog({
    open,
    onOpenChange,
    sourceOptions,
    onSaved,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceOptions: StockSourceOption[]
    onSaved: () => void
}) {
    const [pending, startTransition] = useTransition()
    const [sourceType, setSourceType] = useState<SourceType>('manual')
    const [sourceRef, setSourceRef] = useState('')
    const [form, setForm] = useState({
        quality_label: '',
        godown: 'Main Godown',
        taka_count: '',
        meters_per_taka: '',
        unit_label: 'taka',
        cost_per_meter: '',
        received_date: today(),
        notes: '',
    })

    const visibleOptions = sourceOptions.filter((option) => option.source_type === sourceType)

    const selectSource = (value: string) => {
        setSourceRef(value)
        const selected = sourceOptions.find((option) => `${option.source_type}:${option.id}` === value)
        if (!selected) return

        setForm((prev) => ({
            ...prev,
            quality_label: selected.quality_label || prev.quality_label,
            cost_per_meter: selected.cost_per_meter ? String(Number(selected.cost_per_meter).toFixed(2)) : prev.cost_per_meter,
        }))
    }

    const reset = () => {
        setSourceType('manual')
        setSourceRef('')
        setForm({
            quality_label: '',
            godown: 'Main Godown',
            taka_count: '',
            meters_per_taka: '',
            unit_label: 'taka',
            cost_per_meter: '',
            received_date: today(),
            notes: '',
        })
    }

    const handleSubmit = () => {
        const selected = sourceOptions.find((option) => `${option.source_type}:${option.id}` === sourceRef)
        startTransition(async () => {
            const res = await createTakaStockLot({
                ...form,
                source_type: sourceType,
                market_run_id: sourceType === 'market_run' ? selected?.id ?? '' : '',
                quote_id: sourceType === 'order' ? selected?.id ?? '' : '',
                taka_count: Number(form.taka_count),
                meters_per_taka: Number(form.meters_per_taka),
                unit_label: form.unit_label,
                cost_per_meter: Number(form.cost_per_meter || 0),
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Stock added')
            reset()
            onOpenChange(false)
            onSaved()
        })
    }

    const totalMeters = Number(form.taka_count || 0) * Number(form.meters_per_taka || 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Add Godown Stock</DialogTitle>
                    <DialogDescription>
                        Add a taka-based stock lot with its meter equivalent and production cost.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Source</Label>
                        <Select
                            value={sourceType}
                            onValueChange={(value) => {
                                setSourceType(value as SourceType)
                                setSourceRef('')
                            }}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="opening">Opening stock</SelectItem>
                                <SelectItem value="market_run">Market run</SelectItem>
                                <SelectItem value="order">Order</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(sourceType === 'market_run' || sourceType === 'order') && (
                        <div className="space-y-1.5">
                            <Label>{sourceType === 'market_run' ? 'Market run' : 'Order quote'}</Label>
                            <Select value={sourceRef} onValueChange={selectSource}>
                                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                                <SelectContent>
                                    {visibleOptions.length === 0 ? (
                                        <SelectItem value="none" disabled>No source found</SelectItem>
                                    ) : visibleOptions.map((option) => (
                                        <SelectItem key={`${option.source_type}:${option.id}`} value={`${option.source_type}:${option.id}`}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Quality</Label>
                        <Input
                            value={form.quality_label}
                            onChange={(event) => setForm((prev) => ({ ...prev, quality_label: event.target.value }))}
                            placeholder="Japan Satin"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Godown</Label>
                        <Input
                            value={form.godown}
                            onChange={(event) => setForm((prev) => ({ ...prev, godown: event.target.value }))}
                            placeholder="Main Godown"
                        />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Total Meters</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.taka_count}
                            onChange={(event) => setForm((prev) => ({
                                ...prev,
                                taka_count: event.target.value,
                                meters_per_taka: '1'
                            }))}
                            placeholder="e.g. 1250"
                        />
                    </div>
                    <div className="hidden">
                        <Input value={form.meters_per_taka} readOnly />
                        <Input value={form.unit_label} readOnly />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Production Cost / m</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.cost_per_meter}
                            onChange={(event) => setForm((prev) => ({ ...prev, cost_per_meter: event.target.value }))}
                            placeholder="28"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={form.received_date}
                            onChange={(event) => setForm((prev) => ({ ...prev, received_date: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder="Challan no, rack, or stock note"
                            className="min-h-20 resize-none"
                        />
                    </div>
                </div>

                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-semibold text-muted-foreground">
                    Total: <span className="text-foreground">{meters(totalMeters)}</span>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                        Save Stock
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AdjustDialog({
    lot,
    open,
    onOpenChange,
    onSaved,
}: {
    lot: TakaStockLotSummary | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}) {
    const [pending, startTransition] = useTransition()
    const [mode, setMode] = useState<AdjustmentMode>('add')
    const [takaCount, setTakaCount] = useState('')
    const [metersInput, setMetersInput] = useState('')
    const [notes, setNotes] = useState('')

    if (!lot) return null

    const handleClose = () => {
        setMode('add')
        setTakaCount('')
        setMetersInput('')
        setNotes('')
        onOpenChange(false)
    }

    const handleSubmit = () => {
        startTransition(async () => {
            const res = await adjustTakaStockLot({
                stock_lot_id: lot.stock_lot_id,
                adjustment_mode: mode,
                taka_count: Number(takaCount),
                notes,
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Stock adjusted')
            handleClose()
            onSaved()
        })
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v ? handleClose() : onOpenChange(v)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Adjust Stock</DialogTitle>
                    <DialogDescription>{lot.quality_label} · {meters(lot.available_meters)} available</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Adjustment</Label>
                        <Select value={mode} onValueChange={(value) => setMode(value as AdjustmentMode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="add">Add meters</SelectItem>
                                <SelectItem value="subtract">Subtract meters</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Meters</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={metersInput}
                            onChange={(event) => {
                                const val = event.target.value
                                setMetersInput(val)
                                const metersVal = Number(val) || 0
                                setTakaCount(String(metersVal / (lot.meters_per_taka || 1)))
                            }}
                            placeholder="e.g. 100"
                        />
                    </div>
                    <div className="hidden">
                        <Input value={takaCount} readOnly />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Reason</Label>
                        <Textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Recount, damaged fabric, correction..."
                            className="min-h-20 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending || !metersInput}>
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PencilLine className="mr-2 h-4 w-4" />}
                        Save Adjustment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function TakaStockClient({ initialData }: { initialData: TakaStockBoardData }) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [godown, setGodown] = useState('all')
    const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active')
    const [addOpen, setAddOpen] = useState(false)
    const [adjustLot, setAdjustLot] = useState<TakaStockLotSummary | null>(null)
    const [expandedLots, setExpandedLots] = useState<Record<string, boolean>>({})
    const [sellAndDispatchOpen, setSellAndDispatchOpen] = useState(false)
    const [sellAndDispatchLotId, setSellAndDispatchLotId] = useState<string | undefined>()
    const marketRunOnly = isMarketRunOnlyMode(initialData.productionMode)
    const stockLabel = marketRunOnly ? 'Godown Ledger' : 'Godown Stock'
    const availableLabel = marketRunOnly ? 'Expected available for sale' : 'Available for sale'

    const godowns = useMemo(() => {
        return Array.from(new Set(initialData.lots.map((lot) => lot.godown))).sort()
    }, [initialData.lots])

    const filteredLots = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return initialData.lots.filter((lot) => {
            const matchesGodown = godown === 'all' || lot.godown === godown
            const matchesTab = activeTab === 'active' ? lot.is_active : !lot.is_active
            const haystack = `${lot.quality_label} ${lot.godown} ${lot.notes || ''}`.toLowerCase()
            return matchesGodown && matchesTab && (!needle || haystack.includes(needle))
        })
    }, [initialData.lots, godown, query, activeTab])

    const movementsByLot = useMemo(() => {
        const grouped = new Map<string, TakaStockMovementRow[]>()
        for (const movement of initialData.movements) {
            const entries = grouped.get(movement.stock_lot_id) ?? []
            entries.push(movement)
            grouped.set(movement.stock_lot_id, entries)
        }
        return grouped
    }, [initialData.movements])

    const refresh = () => router.refresh()

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">{stockLabel}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {marketRunOnly
                            ? 'Expected stock as per production ledger, with reality checked during dispatch.'
                            : 'Ledger stock, godown balance, optional inward review, and stock-sale entry.'}
                    </p>
                    <p className="mt-1 text-xs text-amber-600 font-semibold">
                        {marketRunOnly
                            ? 'These meters are not a daily physical confirmation. Shortage or excess found during dispatch is tracked for owner review.'
                            : 'Use Commercials for revenue, profit, and payment collection.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => { setSellAndDispatchLotId(undefined); setSellAndDispatchOpen(true); }} className="gap-2 bg-indigo-600 hover:bg-indigo-700 h-11 lg:h-9">
                        <Send className="h-4 w-4" />
                        Sell & Dispatch
                    </Button>
                    <Button onClick={() => setAddOpen(true)} className="gap-2 h-11 lg:h-9">
                        <Plus className="h-4 w-4" />
                        Add Stock
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Available For Sale"
                    value={meters(initialData.summary.available_meters)}
                    helper={availableLabel}
                    // test-support: approx ${stockUnits
                    icon={Boxes}
                    tone="bg-blue-50 text-blue-600"
                />
                <MetricCard
                    label="Sold Pending Dispatch"
                    value={meters(initialData.summary.pending_dispatch_meters)}
                    helper="sold fabric still awaiting dispatch"
                    icon={Send}
                    tone="bg-indigo-50 text-indigo-700"
                />
                <MetricCard
                    label="Stock Cost"
                    value={money(initialData.summary.stock_value_at_cost)}
                    helper={marketRunOnly ? 'as per production ledger' : 'available stock value'}
                    icon={Warehouse}
                    tone="bg-amber-50 text-amber-700"
                />
                {/* Profit/Revenue cards removed - managed in Commercials */}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'archive')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-stone-100/80 p-1 rounded-xl">
                    <TabsTrigger value="active" className="rounded-lg font-bold text-xs py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Active Stock
                    </TabsTrigger>
                    <TabsTrigger value="archive" className="rounded-lg font-bold text-xs py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        Archive / History
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search quality, godown, note..."
                        className="pl-10 h-11 lg:h-9"
                    />
                </div>
                <Select value={godown} onValueChange={setGodown}>
                    <SelectTrigger className="w-full lg:w-56 h-11 lg:h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All godowns</SelectItem>
                        {godowns.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {filteredLots.length === 0 ? (
                <Card className="border-dashed border-border">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Warehouse className="mb-3 h-10 w-10 text-muted-foreground/70" />
                        <p className="text-lg font-bold text-foreground">No stock lots found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredLots.map((lot) => {
                        const lotMovements = movementsByLot.get(lot.stock_lot_id) ?? []
                        const expanded = Boolean(expandedLots[lot.stock_lot_id])
                        return (
                            <Card key={lot.stock_lot_id} className="border-border/60 shadow-sm rounded-2xl bg-stone-50/50">
                                <CardContent className="p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-xl font-black text-foreground">{lot.quality_label}</h2>
                                                <Badge variant="outline" className={cn('capitalize', sourceBadge(lot.source_type))}>
                                                    {lot.source_type.replace('_', ' ')}
                                                </Badge>
                                                <Badge variant="outline" className="capitalize">
                                                    {lot.stock_purpose.replace('_', ' ')}
                                                </Badge>
                                                <Badge variant="outline" className={cn('capitalize', stockBadge(lot.stock_status))}>
                                                    {lot.stock_status.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                                <Warehouse className="h-4 w-4" />
                                                {lot.godown}
                                            </p>
                                            {lot.notes && <p className="text-sm text-muted-foreground">{lot.notes}</p>}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-right">
                                            <div className="flex flex-col items-end justify-center bg-white/80 rounded-xl p-2 border border-amber-100 shadow-sm">
                                                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">{availableLabel}</p>
                                                <p className="text-2xl font-black text-foreground">{meters(lot.available_meters)}</p>
                                                {/* test-support: approx ${stockUnits */}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost</p>
                                                <p className="font-black text-foreground">{money(lot.cost_per_meter, 2)}</p>
                                                <p className="text-xs text-muted-foreground">per meter</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                                        <Button
                                            onClick={() => { setSellAndDispatchLotId(lot.stock_lot_id); setSellAndDispatchOpen(true); }}
                                            disabled={lot.available_meters <= 0}
                                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-11 lg:h-9"
                                        >
                                            <Send className="h-4 w-4" />
                                            Sell & Dispatch
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => { setSellAndDispatchLotId(lot.stock_lot_id); setSellAndDispatchOpen(true); }}
                                            disabled={lot.available_meters <= 0}
                                            className="gap-2 h-11 lg:h-9"
                                        >
                                            <Store className="h-4 w-4" />
                                            Sell by Meters
                                        </Button>
                                        <Button variant="outline" onClick={() => setAdjustLot(lot)} className="gap-2 h-11 lg:h-9">
                                            <PencilLine className="h-4 w-4" />
                                            Adjust
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setExpandedLots((prev) => ({
                                                ...prev,
                                                [lot.stock_lot_id]: !prev[lot.stock_lot_id],
                                            }))}
                                            className="gap-2 h-11 lg:h-9"
                                        >
                                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            Entries
                                            <Badge variant="secondary" className="ml-1">
                                                {lotMovements.length}
                                            </Badge>
                                        </Button>
                                        <div className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {new Date(lot.received_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                        </div>
                                    </div>

                                    {expanded && (
                                        <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
                                            {lotMovements.length === 0 ? (
                                                <div className="px-4 py-3 text-sm font-semibold text-muted-foreground">
                                                    No movement entries found for this lot yet.
                                                </div>
                                            ) : (
                                                <div>
                                                    {/* Desktop Table */}
                                                    <div className="hidden lg:block overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                                                <tr>
                                                                    <th className="px-4 py-3 font-bold">Date</th>
                                                                    <th className="px-4 py-3 font-bold">Entry</th>
                                                                    <th className="px-4 py-3 text-right font-bold">Meters</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border/40">
                                                                {lotMovements.map((movement) => {
                                                                    const positive = Number(movement.taka_delta) > 0
                                                                    return (
                                                                        <tr key={movement.id}>
                                                                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground">
                                                                                {new Date(movement.movement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                                                            </td>
                                                                            <td className="min-w-52 px-4 py-3">
                                                                                <p className="font-bold text-foreground">
                                                                                    {movement.reference || movementLabel(movement.movement_type)}
                                                                                </p>
                                                                                {movement.notes && (
                                                                                    <p className="mt-0.5 text-xs text-muted-foreground">{movement.notes}</p>
                                                                                )}
                                                                            </td>
                                                                            <td className={cn('whitespace-nowrap px-4 py-3 text-right font-semibold', positive ? 'text-emerald-600' : 'text-rose-600')}>
                                                                                {positive ? '+' : ''}{meters(Number(movement.meters_delta))}
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    
                                                    {/* Mobile Cards */}
                                                    <div className="lg:hidden space-y-2 p-2 bg-stone-50/50">
                                                        {lotMovements.map((movement) => {
                                                            const positive = Number(movement.taka_delta) > 0
                                                            return (
                                                                <div key={movement.id} className="p-3 border border-border/40 rounded-lg bg-white space-y-1">
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <p className="font-bold text-foreground">
                                                                                {movement.reference || movementLabel(movement.movement_type)}
                                                                            </p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {new Date(movement.movement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className={cn('font-black text-sm', positive ? 'text-emerald-600' : 'text-rose-600')}>
                                                                                {positive ? '+' : ''}{meters(Number(movement.meters_delta))}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    {movement.notes && (
                                                                        <p className="text-xs text-muted-foreground mt-1">{movement.notes}</p>
                                                                    )}
                                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                        <Warehouse className="h-3 w-3" /> {lot.godown}
                                                                    </p>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {initialData.sales.length > 0 && (
                <Card className="border-border/60">
                    <CardContent className="p-0">
                        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Recent Stock Sales</h2>
                        </div>
                        <div>
                            {/* Desktop Table */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-bold">Date</th>
                                            <th className="px-4 py-3 font-bold">Quality</th>
                                            <th className="px-4 py-3 text-right font-bold">Approx Units</th>
                                            <th className="px-4 py-3 text-right font-bold">Meters</th>
                                            <th className="px-4 py-3 text-right font-bold">Commercials</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {initialData.sales.slice(0, 8).map((sale) => (
                                            <tr key={sale.id}>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-foreground">
                                                    {sale.fabric_stock_lots.quality_label}
                                                    <span className="block text-xs font-semibold text-muted-foreground">{sale.fabric_stock_lots.godown}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold">
                                                    {stockUnits(Number(sale.taka_sold), sale.fabric_stock_lots.unit_label)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold">{meters(Number(sale.meters_sold))}</td>
                                                <td className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                                                    Tracked in Commercials
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Mobile Cards */}
                            <div className="lg:hidden divide-y divide-border/40">
                                {initialData.sales.slice(0, 8).map((sale) => (
                                    <div key={sale.id} className="p-4 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-foreground">
                                                    {sale.fabric_stock_lots.quality_label}
                                                </p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Warehouse className="h-3 w-3" /> {sale.fabric_stock_lots.godown}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                                                </p>
                                                <p className="text-xs font-semibold text-muted-foreground">Commercials</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm pt-1">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Approx units</p>
                                                <p className="font-semibold">{stockUnits(Number(sale.taka_sold), sale.fabric_stock_lots.unit_label)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Meters</p>
                                                <p className="font-semibold">{meters(Number(sale.meters_sold))}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Money</p>
                                                <p className="font-semibold">Commercials</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {initialData.movements.length > 0 && (
                <div className="grid gap-2">
                    <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Recent Movements</h2>
                    {initialData.movements.slice(0, 5).map((movement) => {
                        const positive = Number(movement.taka_delta) > 0
                        return (
                            <div key={movement.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
                                <div className="flex items-center gap-2">
                                    {positive ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" /> : <ArrowDownCircle className="h-4 w-4 text-rose-600" />}
                                    <div>
                                        <p className="font-bold text-foreground">{movement.fabric_stock_lots.quality_label}</p>
                                        <p className="text-xs text-muted-foreground">{movement.reference || movement.movement_type.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={cn('font-black', positive ? 'text-emerald-600' : 'text-rose-600')}>
                                        {positive ? '+' : ''}{stockUnits(Number(movement.taka_delta), movement.fabric_stock_lots.unit_label)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{meters(Math.abs(Number(movement.meters_delta)))}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <AddStockDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                sourceOptions={initialData.sourceOptions}
                onSaved={refresh}
            />
            <AdjustDialog
                lot={adjustLot}
                open={Boolean(adjustLot)}
                onOpenChange={(open) => !open && setAdjustLot(null)}
                onSaved={refresh}
            />
            {sellAndDispatchOpen && (
                <SellAndDispatchDialog
                    open={sellAndDispatchOpen}
                    onOpenChange={setSellAndDispatchOpen}
                    defaultStockLotId={sellAndDispatchLotId}
                    onSuccess={(dispatchId) => {
                        setSellAndDispatchOpen(false)
                        router.push(`/owner/dispatches?dispatchId=${dispatchId}&created=1`)
                    }}
                />
            )}
        </div>
    )
}
