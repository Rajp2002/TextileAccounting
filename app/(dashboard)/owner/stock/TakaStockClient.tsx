'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ElementType } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Boxes,
    CalendarDays,
    CheckCircle2,
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
    confirmStockInwardDraft,
    createTakaStockLot,
    dismissStockInwardDraft,
    recordTakaStockSale,
    type StockInwardDraftRow,
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

function stockUnits(value: number, unitLabel = 'taka') {
    return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unitLabel || 'taka'}`
}

function stockQuantity(unitCount: number, meterCount: number, unitLabel = 'taka') {
    return `${stockUnits(unitCount, unitLabel)} (${meters(meterCount)})`
}

function positiveWholeInput(value: string, max: number) {
    if (value === '') return ''
    if (!/^\d+$/.test(value)) return null

    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed < 1) return ''

    return String(Math.min(parsed, Math.floor(max)))
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

                    <div className="space-y-1.5">
                        <Label>Units</Label>
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
                        <Label>Meters / Unit</Label>
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
                        <Label>Unit Label</Label>
                        <Input
                            value={form.unit_label}
                            onChange={(event) => setForm((prev) => ({ ...prev, unit_label: event.target.value }))}
                            placeholder="taka"
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

function PendingInwardDialog({
    draft,
    open,
    onOpenChange,
    onSaved,
}: {
    draft: StockInwardDraftRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}) {
    const [pending, startTransition] = useTransition()
    const [form, setForm] = useState({
        actual_unit_count: '',
        meters_per_unit: '',
        unit_label: '',
        godown: '',
        notes: '',
    })

    if (!draft) return null

    const actualUnits = Number(form.actual_unit_count || draft.suggested_unit_count || 0)
    const metersPerUnit = Number(form.meters_per_unit || draft.meters_per_unit || 0)
    const totalMeters = actualUnits * metersPerUnit
    const unitLabel = form.unit_label || draft.unit_label || 'taka'

    const ensureDefaults = () => {
        if (form.actual_unit_count) return
        setForm({
            actual_unit_count: String(Number(draft.suggested_unit_count || 0)),
            meters_per_unit: String(Number(draft.meters_per_unit || 0)),
            unit_label: draft.unit_label || 'taka',
            godown: draft.suggested_godown || 'Main Godown',
            notes: draft.notes || '',
        })
    }

    const handleConfirm = () => {
        startTransition(async () => {
            const res = await confirmStockInwardDraft({
                draft_id: draft.id,
                actual_unit_count: Number(form.actual_unit_count || draft.suggested_unit_count),
                meters_per_unit: Number(form.meters_per_unit || draft.meters_per_unit),
                unit_label: unitLabel,
                godown: form.godown || draft.suggested_godown,
                notes: form.notes,
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Stock inward confirmed')
            setForm({ actual_unit_count: '', meters_per_unit: '', unit_label: '', godown: '', notes: '' })
            onOpenChange(false)
            onSaved()
        })
    }

    const handleDismiss = () => {
        startTransition(async () => {
            const res = await dismissStockInwardDraft({
                draft_id: draft.id,
                notes: form.notes,
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Pending inward dismissed')
            setForm({ actual_unit_count: '', meters_per_unit: '', unit_label: '', godown: '', notes: '' })
            onOpenChange(false)
            onSaved()
        })
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (nextOpen) ensureDefaults()
            onOpenChange(nextOpen)
        }}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Add Produced Fabric to Stock</DialogTitle>
                    <DialogDescription>
                        {draft.quality_label} · {draft.source_type === 'market_run' ? 'Market run' : 'Order'} · {draft.source_shift} shift
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-3 sm:col-span-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Produced this shift</p>
                        <p className="mt-1 text-lg font-black text-foreground">
                            {stockQuantity(draft.suggested_unit_count, draft.suggested_meters, draft.unit_label)}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">Cost locked at {money(draft.cost_per_meter, 2)}/m</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Actual Units</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.actual_unit_count || String(draft.suggested_unit_count)}
                            onChange={(event) => setForm((prev) => ({ ...prev, actual_unit_count: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Meters / Unit</Label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.meters_per_unit || String(draft.meters_per_unit)}
                            onChange={(event) => setForm((prev) => ({ ...prev, meters_per_unit: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Unit Label</Label>
                        <Input
                            value={form.unit_label || draft.unit_label}
                            onChange={(event) => setForm((prev) => ({ ...prev, unit_label: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Godown</Label>
                        <Input
                            value={form.godown || draft.suggested_godown}
                            onChange={(event) => setForm((prev) => ({ ...prev, godown: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder="Rack, holdback, shortage, or packing note"
                            className="min-h-16 resize-none"
                        />
                    </div>
                </div>

                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-semibold text-muted-foreground">
                    Confirming: <span className="text-foreground">{stockQuantity(actualUnits, totalMeters, unitLabel)}</span>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={handleDismiss} disabled={pending}>Dismiss</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={pending}>
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirm Stock
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
    const canSubmit = Number.isInteger(takasSold)
        && takasSold > 0
        && takasSold <= lot.available_taka_count
        && price >= 0
        && form.price_per_meter !== ''

    const handleSubmit = () => {
        if (!canSubmit) {
            toast.error(`${lot.unit_label} sold must be a positive whole number`)
            return
        }

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
                        <Label>{lot.unit_label} Sold</Label>
                        <Input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={lot.available_taka_count}
                            step="1"
                            value={form.taka_sold}
                            onKeyDown={(event) => {
                                if (['.', ',', '-', '+', 'e', 'E'].includes(event.key)) {
                                    event.preventDefault()
                                }
                            }}
                            onChange={(event) => {
                                const next = positiveWholeInput(event.target.value, lot.available_taka_count)
                                if (next !== null) {
                                    setForm((prev) => ({ ...prev, taka_sold: next }))
                                }
                            }}
                            placeholder={`Max ${lot.available_taka_count}`}
                        />
                        <p className="text-[10px] font-semibold text-muted-foreground">
                            Available: {stockQuantity(lot.available_taka_count, lot.available_meters, lot.unit_label)}
                        </p>
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
                    <Button onClick={handleSubmit} disabled={pending || !canSubmit}>
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
                    <DialogDescription>{lot.quality_label} · {stockQuantity(lot.available_taka_count, lot.available_meters, lot.unit_label)} available</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Adjustment</Label>
                        <Select value={mode} onValueChange={(value) => setMode(value as AdjustmentMode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="add">Add {lot.unit_label}</SelectItem>
                                <SelectItem value="subtract">Subtract {lot.unit_label}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>{lot.unit_label}</Label>
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
    const [pendingDraft, setPendingDraft] = useState<StockInwardDraftRow | null>(null)
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
                    label="Available Units"
                    value={stockUnits(initialData.summary.available_taka)}
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

            {initialData.pendingInwards.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/40">
                    <CardContent className="p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-wider text-amber-800">Pending Stock Inward</h2>
                                <p className="mt-1 text-sm text-amber-800/80">
                                    Confirm produced shift fabric before it becomes live godown stock.
                                </p>
                            </div>
                            <Badge variant="outline" className="w-fit border-amber-300 bg-background text-amber-800">
                                {initialData.pendingInwards.length} pending
                            </Badge>
                        </div>
                        <div className="mt-4 grid gap-3">
                            {initialData.pendingInwards.slice(0, 6).map((draft) => (
                                <div key={draft.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-background p-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-black text-foreground">{draft.quality_label}</p>
                                            <Badge variant="outline" className={cn('capitalize', sourceBadge(draft.source_type))}>
                                                {draft.source_type.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                            {stockQuantity(draft.suggested_unit_count, draft.suggested_meters, draft.unit_label)} · {money(draft.cost_per_meter, 2)}/m · {draft.suggested_godown}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(draft.source_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {draft.source_shift} shift
                                        </p>
                                    </div>
                                    <Button onClick={() => setPendingDraft(draft)} className="gap-2">
                                        <PackagePlus className="h-4 w-4" />
                                        Review & Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

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

                                        <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Available</p>
                                                <p className="font-black text-foreground">{stockUnits(lot.available_taka_count, lot.unit_label)}</p>
                                                <p className="text-xs text-muted-foreground">{meters(lot.available_meters)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Unit Size</p>
                                                <p className="font-black text-foreground">{meters(lot.meters_per_taka)}</p>
                                                <p className="text-xs text-muted-foreground">per {lot.unit_label}</p>
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
                                        <th className="px-4 py-3 text-right font-bold">Units</th>
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
                                            <td className="px-4 py-3 text-right font-semibold">
                                                {stockUnits(Number(sale.taka_sold), sale.fabric_stock_lots.unit_label)}
                                            </td>
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
            <PendingInwardDialog
                draft={pendingDraft}
                open={Boolean(pendingDraft)}
                onOpenChange={(open) => !open && setPendingDraft(null)}
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
