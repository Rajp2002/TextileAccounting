'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ElementType } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Boxes,
    CalendarDays,
    IndianRupee,
    Loader2,
    PackagePlus,
    PencilLine,
    Plus,
    Search,
    Store,
    TrendingUp,
    Warehouse,
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
import { cn } from '@/lib/utils'
import {
    adjustTakaStockLot,
    createTakaStockLot,
    recordTakaStockSale,
    type StockSourceOption,
    type TakaStockBoardData,
    type TakaStockLotSummary,
} from './actions'

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

function taka(value: number) {
    return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} taka`
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
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
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

                    <div className="space-y-1.5">
                        <Label>Takas</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.taka_count}
                            onChange={(event) => setForm((prev) => ({ ...prev, taka_count: event.target.value }))}
                            placeholder="15"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Meters / Taka</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.meters_per_taka}
                            onChange={(event) => setForm((prev) => ({ ...prev, meters_per_taka: event.target.value }))}
                            placeholder="45"
                        />
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

function SaleDialog({
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
    const [form, setForm] = useState({
        taka_sold: '',
        price_per_meter: '',
        sale_date: today(),
        notes: '',
    })

    if (!lot) return null

    const takasSold = Number(form.taka_sold || 0)
    const price = Number(form.price_per_meter || 0)
    const metersSold = takasSold * lot.meters_per_taka
    const revenue = metersSold * price
    const profit = metersSold * (price - lot.cost_per_meter)

    const handleSubmit = () => {
        startTransition(async () => {
            const res = await recordTakaStockSale({
                stock_lot_id: lot.stock_lot_id,
                taka_sold: Number(form.taka_sold),
                price_per_meter: Number(form.price_per_meter),
                sale_date: form.sale_date,
                notes: form.notes,
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Sale recorded')
            setForm({ taka_sold: '', price_per_meter: '', sale_date: today(), notes: '' })
            onOpenChange(false)
            onSaved()
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Record Stock Sale</DialogTitle>
                    <DialogDescription>{lot.quality_label} · {lot.godown}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Takas Sold</Label>
                        <Input
                            type="number"
                            min="0.01"
                            max={lot.available_taka_count}
                            step="0.01"
                            value={form.taka_sold}
                            onChange={(event) => setForm((prev) => ({ ...prev, taka_sold: event.target.value }))}
                            placeholder={`Max ${lot.available_taka_count}`}
                        />
                        <p className="text-[10px] font-semibold text-muted-foreground">Available: {taka(lot.available_taka_count)}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Sale Price / m</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.price_per_meter}
                            onChange={(event) => setForm((prev) => ({ ...prev, price_per_meter: event.target.value }))}
                            placeholder={`Cost ${money(lot.cost_per_meter, 2)}`}
                        />
                        <p className={cn('text-[10px] font-semibold', price >= lot.cost_per_meter ? 'text-emerald-600' : 'text-rose-600')}>
                            {form.price_per_meter ? `${money(price - lot.cost_per_meter, 2)}/m margin` : ' '}
                        </p>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Sale Date</Label>
                        <Input
                            type="date"
                            value={form.sale_date}
                            onChange={(event) => setForm((prev) => ({ ...prev, sale_date: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder="Optional sale note"
                            className="min-h-16 resize-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meters</p>
                        <p className="font-black text-foreground">{meters(metersSold)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</p>
                        <p className="font-black text-foreground">{money(revenue)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profit</p>
                        <p className={cn('font-black', profit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{money(profit)}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
                        Record Sale
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
    const [notes, setNotes] = useState('')

    if (!lot) return null

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
            setMode('add')
            setTakaCount('')
            setNotes('')
            onOpenChange(false)
            onSaved()
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Adjust Stock</DialogTitle>
                    <DialogDescription>{lot.quality_label} · {taka(lot.available_taka_count)} available</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Adjustment</Label>
                        <Select value={mode} onValueChange={(value) => setMode(value as AdjustmentMode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="add">Add takas</SelectItem>
                                <SelectItem value="subtract">Subtract takas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Takas</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={takaCount}
                            onChange={(event) => setTakaCount(event.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Reason</Label>
                        <Textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Recount, damaged taka, correction..."
                            className="min-h-20 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
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
    const [addOpen, setAddOpen] = useState(false)
    const [saleLot, setSaleLot] = useState<TakaStockLotSummary | null>(null)
    const [adjustLot, setAdjustLot] = useState<TakaStockLotSummary | null>(null)

    const godowns = useMemo(() => {
        return Array.from(new Set(initialData.lots.map((lot) => lot.godown))).sort()
    }, [initialData.lots])

    const filteredLots = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return initialData.lots.filter((lot) => {
            const matchesGodown = godown === 'all' || lot.godown === godown
            const haystack = `${lot.quality_label} ${lot.godown} ${lot.notes || ''}`.toLowerCase()
            return matchesGodown && (!needle || haystack.includes(needle))
        })
    }, [initialData.lots, godown, query])

    const refresh = () => router.refresh()

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Godown Stock</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Taka stock, meter equivalent, and gross profit.</p>
                </div>
                <Button onClick={() => setAddOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Stock
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Available Takas"
                    value={taka(initialData.summary.available_taka)}
                    helper={meters(initialData.summary.available_meters)}
                    icon={Boxes}
                    tone="bg-blue-50 text-blue-600"
                />
                <MetricCard
                    label="Stock Cost"
                    value={money(initialData.summary.stock_value_at_cost)}
                    helper="available stock value"
                    icon={Warehouse}
                    tone="bg-amber-50 text-amber-700"
                />
                <MetricCard
                    label="Sales Revenue"
                    value={money(initialData.summary.realized_revenue)}
                    helper="from stock sales"
                    icon={IndianRupee}
                    tone="bg-violet-50 text-violet-700"
                />
                <MetricCard
                    label="Gross Profit"
                    value={money(initialData.summary.realized_profit)}
                    helper="from stock sales"
                    icon={TrendingUp}
                    tone="bg-emerald-50 text-emerald-700"
                />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search quality, godown, note..."
                        className="pl-10"
                    />
                </div>
                <Select value={godown} onValueChange={setGodown}>
                    <SelectTrigger className="w-full lg:w-56">
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
                        const saleMargin = lot.total_revenue > 0 ? (lot.total_gross_profit / lot.total_revenue) * 100 : null
                        return (
                            <Card key={lot.stock_lot_id} className="border-border/60 shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-xl font-black text-foreground">{lot.quality_label}</h2>
                                                <Badge variant="outline" className={cn('capitalize', sourceBadge(lot.source_type))}>
                                                    {lot.source_type.replace('_', ' ')}
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

                                        <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Available</p>
                                                <p className="font-black text-foreground">{taka(lot.available_taka_count)}</p>
                                                <p className="text-xs text-muted-foreground">{meters(lot.available_meters)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Taka Size</p>
                                                <p className="font-black text-foreground">{meters(lot.meters_per_taka)}</p>
                                                <p className="text-xs text-muted-foreground">per taka</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cost</p>
                                                <p className="font-black text-foreground">{money(lot.cost_per_meter, 2)}</p>
                                                <p className="text-xs text-muted-foreground">per meter</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Profit</p>
                                                <p className={cn('font-black', lot.total_gross_profit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                                    {money(lot.total_gross_profit)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {saleMargin === null ? 'No sale' : `${saleMargin.toFixed(1)}%`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                                        <Button
                                            onClick={() => setSaleLot(lot)}
                                            disabled={lot.available_taka_count <= 0}
                                            className="gap-2"
                                        >
                                            <Store className="h-4 w-4" />
                                            Record Sale
                                        </Button>
                                        <Button variant="outline" onClick={() => setAdjustLot(lot)} className="gap-2">
                                            <PencilLine className="h-4 w-4" />
                                            Adjust
                                        </Button>
                                        <div className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {new Date(lot.received_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Date</th>
                                        <th className="px-4 py-3 font-bold">Quality</th>
                                        <th className="px-4 py-3 text-right font-bold">Takas</th>
                                        <th className="px-4 py-3 text-right font-bold">Meters</th>
                                        <th className="px-4 py-3 text-right font-bold">Sale / m</th>
                                        <th className="px-4 py-3 text-right font-bold">Profit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {initialData.sales.slice(0, 8).map((sale) => (
                                        <tr key={sale.id}>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-foreground">
                                                {sale.fabric_stock_lots.quality_label}
                                                <span className="block text-[10px] font-semibold text-muted-foreground">{sale.fabric_stock_lots.godown}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold">{taka(Number(sale.taka_sold))}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{meters(Number(sale.meters_sold))}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{money(Number(sale.price_per_meter), 2)}</td>
                                            <td className={cn('px-4 py-3 text-right font-black', Number(sale.gross_profit_amount) >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                                {Number(sale.gross_profit_amount) >= 0 ? '+' : ''}{money(Number(sale.gross_profit_amount))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                        {positive ? '+' : ''}{taka(Number(movement.taka_delta))}
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
            <SaleDialog
                lot={saleLot}
                open={Boolean(saleLot)}
                onOpenChange={(open) => !open && setSaleLot(null)}
                onSaved={refresh}
            />
            <AdjustDialog
                lot={adjustLot}
                open={Boolean(adjustLot)}
                onOpenChange={(open) => !open && setAdjustLot(null)}
                onSaved={refresh}
            />
        </div>
    )
}
