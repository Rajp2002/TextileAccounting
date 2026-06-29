'use client'

import type { ComponentType } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    CircleDollarSign,
    Factory,
    Loader2,
    Package,
    Plus,
    TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { formatDateOnly } from '@/lib/format'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
    createBeamCard,
    createYarnLot,
    recordYarnMovement,
    type BeamCardSummary,
    type InventoryModuleData,
} from './actions'
import { useTranslation } from '@/lib/i18n/context'

const movementOptions = [
    { value: 'issue_to_warping', label: 'Issue to warping' },
    { value: 'issue_to_sizing', label: 'Issue to sizing' },
    { value: 'issue_to_loom_weft', label: 'Issue to loom / weft' },
    { value: 'return_leftover', label: 'Return / leftover' },
    { value: 'adjustment', label: 'Adjustment' },
] as const

function formatKg(value: number) {
    return `${value.toFixed(2)} kg`
}

function formatInr(value: number) {
    return `Rs ${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function todayString() {
    return new Date().toISOString().split('T')[0]
}

function varianceTone(varianceKg: number) {
    if (varianceKg > 0.01) return 'bg-amber-50 text-amber-700 border-amber-200'
    if (varianceKg < -0.01) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    return 'bg-slate-50 text-slate-700 border-slate-200'
}

function StatBlock({
    label,
    value,
    hint,
    icon: Icon,
}: {
    label: string
    value: string
    hint: string
    icon: ComponentType<{ className?: string }>
}) {
    return (
        <div className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="text-2xl font-semibold text-slate-900">{value}</p>
                    <p className="text-sm text-slate-500">{hint}</p>
                </div>
                <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    )
}

export default function InventoryClient({
    initialData,
    activeView = 'yarn',
}: {
    initialData: InventoryModuleData
    activeView?: 'yarn' | 'beams'
}) {
    const { t } = useTranslation()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [isLotOpen, setIsLotOpen] = useState(false)
    const [isBeamOpen, setIsBeamOpen] = useState(false)
    const [isIssueOpen, setIsIssueOpen] = useState(false)

    const [lotForm, setLotForm] = useState({
        supplier: '',
        bill_no: '',
        bill_date: todayString(),
        yarn_type: '',
        denier_count: '',
        filament_material: '',
        received_kg: 0,
        received_cones: 0,
        rate_per_kg: 0,
        gst_percent: 0,
        notes: '',
    })

    const [beamForm, setBeamForm] = useState({
        beam_no: '',
        order_id: '',
        quality_label: '',
        beam_ends: 0,
        tape_length_m: 0,
        expected_metres: 0,
        actual_beam_weight_kg: 0,
        sizing_vendor: '',
        sizing_bill_no: '',
        notes: '',
    })

    const [issueForm, setIssueForm] = useState({
        beam_card_id: '',
        yarn_lot_id: '',
        movement_type: 'issue_to_warping' as (typeof movementOptions)[number]['value'],
        movement_date: todayString(),
        quantity_kg: 0,
        cones: 0,
        adjustment_mode: 'subtract' as 'add' | 'subtract',
        notes: '',
    })

    const orderMap = useMemo(
        () => new Map(initialData.activeOrders.map((order) => [order.id, order])),
        [initialData.activeOrders]
    )

    const varianceMap = useMemo(
        () => new Map(initialData.orderVariance.map((row) => [row.order_id, row])),
        [initialData.orderVariance]
    )

    const beamMap = useMemo(
        () => new Map(initialData.beamCards.map((beam) => [beam.id, beam])),
        [initialData.beamCards]
    )

    const selectedBeam = issueForm.beam_card_id ? beamMap.get(issueForm.beam_card_id) ?? null : null
    const selectedLot = issueForm.yarn_lot_id
        ? initialData.yarnLots.find((lot) => lot.id === issueForm.yarn_lot_id) ?? null
        : null

    const computedLotTotal = useMemo(() => {
        const base = lotForm.received_kg * lotForm.rate_per_kg
        return base + (base * lotForm.gst_percent) / 100
    }, [lotForm.gst_percent, lotForm.rate_per_kg, lotForm.received_kg])

    const handleRefresh = () => startTransition(() => router.refresh())

    const resetLotForm = () => {
        setLotForm({
            supplier: '',
            bill_no: '',
            bill_date: todayString(),
            yarn_type: '',
            denier_count: '',
            filament_material: '',
            received_kg: 0,
            received_cones: 0,
            rate_per_kg: 0,
            gst_percent: 0,
            notes: '',
        })
    }

    const resetBeamForm = () => {
        setBeamForm({
            beam_no: '',
            order_id: '',
            quality_label: '',
            beam_ends: 0,
            tape_length_m: 0,
            expected_metres: 0,
            actual_beam_weight_kg: 0,
            sizing_vendor: '',
            sizing_bill_no: '',
            notes: '',
        })
    }

    const resetIssueForm = () => {
        setIssueForm({
            beam_card_id: '',
            yarn_lot_id: '',
            movement_type: 'issue_to_warping',
            movement_date: todayString(),
            quantity_kg: 0,
            cones: 0,
            adjustment_mode: 'subtract',
            notes: '',
        })
    }

    const submitLot = () => {
        startTransition(async () => {
            const result = await createYarnLot({
                ...lotForm,
                total_cost: Number(computedLotTotal.toFixed(2)),
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Yarn lot added')
            setIsLotOpen(false)
            resetLotForm()
            router.refresh()
        })
    }

    const submitBeam = () => {
        if (!beamForm.order_id) {
            toast.error('Select an order for the beam card')
            return
        }

        startTransition(async () => {
            const result = await createBeamCard({
                ...beamForm,
                actual_beam_weight_kg: beamForm.actual_beam_weight_kg > 0 ? beamForm.actual_beam_weight_kg : null,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Beam card created')
            setIsBeamOpen(false)
            resetBeamForm()
            router.refresh()
        })
    }

    const submitIssue = () => {
        if (!issueForm.beam_card_id) {
            toast.error('Select a beam card')
            return
        }

        if (!issueForm.yarn_lot_id) {
            toast.error('Select a yarn lot')
            return
        }

        startTransition(async () => {
            const result = await recordYarnMovement({
                ...issueForm,
                adjustment_mode: issueForm.movement_type === 'adjustment' ? issueForm.adjustment_mode : undefined,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Yarn movement saved')
            setIsIssueOpen(false)
            resetIssueForm()
            router.refresh()
        })
    }

    const handleOrderSelect = (orderId: string) => {
        const order = orderMap.get(orderId)
        const variance = varianceMap.get(orderId)
        const expectedMetres = variance?.estimated_beams && variance.estimated_beams > 0
            ? order
                ? Number((order.total_target_meters / variance.estimated_beams).toFixed(0))
                : 0
            : order?.total_target_meters ?? 0

        setBeamForm((current) => ({
            ...current,
            order_id: orderId,
            quality_label: order?.quality_label ?? current.quality_label,
            expected_metres: expectedMetres,
        }))
    }

    const openIssueForBeam = (beam: BeamCardSummary) => {
        setIssueForm((current) => ({
            ...current,
            beam_card_id: beam.id,
        }))
        setIsIssueOpen(true)
    }

    const showYarnView = activeView === 'yarn'
    const showBeamView = activeView === 'beams'

    return (
        <div className="space-y-6">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">{showBeamView ? t('inventory.section.beamEyebrow') : t('inventory.section.yarnEyebrow')}</p>
                    <h2 className="text-2xl font-semibold text-slate-900">{showBeamView ? t('inventory.section.beamTitle') : t('inventory.section.yarnTitle')}</h2>
                    <p className="max-w-3xl text-sm text-slate-600">
                        {showBeamView
                            ? t('inventory.section.beamBody')
                            : t('inventory.section.yarnBody')}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleRefresh} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Refresh
                    </Button>
                    {showYarnView ? (
                        <Button variant="outline" onClick={() => setIsLotOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add yarn lot
                        </Button>
                    ) : null}
                    {showBeamView ? (
                        <>
                            <Button variant="outline" onClick={() => setIsBeamOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                New beam card
                            </Button>
                            <Button onClick={() => setIsIssueOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Issue yarn to beam
                            </Button>
                        </>
                    ) : null}
                </div>
            </section>

            <section className={cn('grid gap-4', showYarnView ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3')}>
                {showYarnView ? (
                    <>
                        <StatBlock
                            label="Available yarn"
                            value={formatKg(initialData.summary.total_available_kg)}
                            hint={`${initialData.summary.total_available_cones.toLocaleString('en-IN')} cones on hand`}
                            icon={Package}
                        />
                        <StatBlock
                            label="Working capital"
                            value={formatInr(initialData.summary.total_lot_value)}
                            hint="Total purchase value across yarn lots"
                            icon={CircleDollarSign}
                        />
                        <StatBlock
                            label="Open beam cards"
                            value={initialData.summary.open_beams.toString()}
                            hint="Beam cards already created from active orders"
                            icon={Factory}
                        />
                        <StatBlock
                            label="Orders with variance"
                            value={initialData.summary.active_variance_orders.toString()}
                            hint="Active orders carrying estimator-linked yarn targets"
                            icon={TrendingUp}
                        />
                    </>
                ) : (
                    <>
                        <StatBlock
                            label="Open beam cards"
                            value={initialData.summary.open_beams.toString()}
                            hint="Warp usage can be issued straight onto these beams"
                            icon={Factory}
                        />
                        <StatBlock
                            label={t('inventory.section.activeOrders')}
                            value={initialData.activeOrders.length.toString()}
                            hint={t('inventory.section.activeOrdersHint')}
                            icon={TrendingUp}
                        />
                        <StatBlock
                            label={t('inventory.section.recentMovements')}
                            value={initialData.recentMovements.length.toString()}
                            hint={t('inventory.section.recentMovementsHint')}
                            icon={Package}
                        />
                    </>
                )}
            </section>

            {showYarnView ? (
                <>
                    <div className="rounded-lg border bg-white">
                        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Lot-level stock</h2>
                                <p className="text-sm text-slate-500">Batch-first tracking for purchase value, available kg, and cones.</p>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lot</TableHead>
                                    <TableHead>Specification</TableHead>
                                    <TableHead>Available</TableHead>
                                    <TableHead>Purchase</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead>Total cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialData.yarnLots.map((lot) => (
                                    <TableRow key={lot.id}>
                                        <TableCell className="whitespace-normal">
                                            <div className="space-y-1">
                                                <p className="font-medium text-slate-900">{lot.supplier}</p>
                                                <p className="text-xs text-slate-500">Bill {lot.bill_no} · {formatDateOnly(lot.bill_date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-normal text-sm text-slate-600">
                                            <p>{lot.yarn_type}</p>
                                            <p>{lot.denier_count} · {lot.filament_material}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <p className="font-medium text-slate-900">{formatKg(lot.available_kg)}</p>
                                                <p className="text-xs text-slate-500">{lot.available_cones.toLocaleString('en-IN')} cones</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <p>{formatKg(lot.received_kg)}</p>
                                            <p>{lot.received_cones.toLocaleString('en-IN')} cones</p>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <p>{formatInr(lot.rate_per_kg)}/kg</p>
                                            <p>{lot.gst_percent.toFixed(2)}% GST</p>
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-900">{formatInr(lot.total_cost)}</TableCell>
                                    </TableRow>
                                ))}
                                {initialData.yarnLots.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                                            No yarn lots yet. Add the first supplier bill to start tracking yarn money.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="rounded-lg border bg-white">
                        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Estimator vs issue variance</h2>
                                <p className="text-sm text-slate-500">Required kg comes from the estimator snapshot taken when the quote became an order.</p>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Required</TableHead>
                                    <TableHead>Issued</TableHead>
                                    <TableHead>Leftover</TableHead>
                                    <TableHead>Net consumed</TableHead>
                                    <TableHead>Variance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialData.orderVariance.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="whitespace-normal">
                                            <div className="space-y-1">
                                                <p className="font-medium text-slate-900">{row.party_name}</p>
                                                <p className="text-sm text-slate-500">{row.quality_label}</p>
                                                {row.estimated_beams ? (
                                                    <p className="text-xs text-slate-400">{row.estimated_beams} suggested beams</p>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <p>Warp {formatKg(row.warp_required_kg)}</p>
                                            <p>Weft {formatKg(row.weft_required_kg)}</p>
                                            <p className="font-medium text-slate-900">Total {formatKg(row.total_required_kg)}</p>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <p>Warp {formatKg(row.warp_issued_kg)}</p>
                                            <p>Weft {formatKg(row.weft_issued_kg)}</p>
                                            <p className="font-medium text-slate-900">Total {formatKg(row.total_issued_kg)}</p>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">{formatKg(row.leftover_kg)}</TableCell>
                                        <TableCell className="text-sm font-medium text-slate-900">{formatKg(row.net_consumed_kg)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn('font-medium', varianceTone(row.variance_kg))}>
                                                {row.variance_kg > 0 ? '+' : ''}
                                                {row.variance_kg.toFixed(2)} kg
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {initialData.orderVariance.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                                            Estimator-linked variance will appear here as soon as an estimate is converted into an order.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="rounded-lg border bg-white">
                        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Recent yarn movements</h2>
                                <p className="text-sm text-slate-500">Purchase history is created from yarn lots. Floor movements stay lot-level for MVP.</p>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Lot</TableHead>
                                    <TableHead>Beam / order</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialData.recentMovements.map((movement) => (
                                    <TableRow key={movement.id}>
                                        <TableCell>{formatDateOnly(movement.movement_date, { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                                        <TableCell className="capitalize text-sm text-slate-600">
                                            {movement.movement_type.replaceAll('_', ' ')}
                                            {movement.adjustment_mode ? ` (${movement.adjustment_mode})` : ''}
                                        </TableCell>
                                        <TableCell className="whitespace-normal text-sm text-slate-600">{movement.lot_label}</TableCell>
                                        <TableCell className="whitespace-normal text-sm text-slate-600">
                                            <p>{movement.beam_no || 'No beam'}</p>
                                            <p>{movement.order_label || 'No order'}</p>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            <p>{formatKg(movement.quantity_kg)}</p>
                                            <p>{movement.cones.toLocaleString('en-IN')} cones</p>
                                        </TableCell>
                                        <TableCell className="whitespace-normal text-sm text-slate-500">{movement.notes || '—'}</TableCell>
                                    </TableRow>
                                ))}
                                {initialData.recentMovements.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                                            No yarn movements yet.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                </>
            ) : null}

            {showBeamView ? (
                    <div className="rounded-lg border bg-white">
                        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Beam cards</h2>
                                <p className="text-sm text-slate-500">Order-linked beam records with warp lots used, expected metres, and sizing references.</p>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Beam</TableHead>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Warp lots used</TableHead>
                                    <TableHead>Expected</TableHead>
                                    <TableHead>Actual weight</TableHead>
                                    <TableHead>Sizing</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialData.beamCards.map((beam) => (
                                    <TableRow key={beam.id}>
                                        <TableCell className="whitespace-normal">
                                            <div className="space-y-1">
                                                <p className="font-medium text-slate-900">{beam.beam_no}</p>
                                                <p className="text-xs text-slate-500">{beam.beam_ends.toLocaleString('en-IN')} ends · {beam.tape_length_m.toFixed(0)} m tape</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-normal">
                                            <p className="font-medium text-slate-900">{beam.order_party_name}</p>
                                            <p className="text-sm text-slate-500">{beam.quality_label}</p>
                                        </TableCell>
                                        <TableCell className="whitespace-normal text-sm text-slate-600">
                                            <div className="space-y-1">
                                                {beam.warp_lots.filter((lot) => lot.usage_type === 'warp').map((lot) => (
                                                    <p key={lot.id}>{lot.label} · {formatKg(lot.issued_kg)}</p>
                                                ))}
                                                {beam.warp_lots.filter((lot) => lot.usage_type === 'warp').length === 0 ? (
                                                    <span className="text-slate-400">No yarn issued yet</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">{beam.expected_metres.toFixed(0)} m</TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            {beam.actual_beam_weight_kg != null ? formatKg(beam.actual_beam_weight_kg) : 'Pending'}
                                        </TableCell>
                                        <TableCell className="whitespace-normal text-sm text-slate-600">
                                            <p>{beam.sizing_vendor || 'Not set'}</p>
                                            <p>{beam.sizing_bill_no || 'No bill ref'}</p>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => openIssueForBeam(beam)}>
                                                Issue yarn
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {initialData.beamCards.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                                            No beam cards yet. Create one from an active order, then issue yarn straight onto it.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}

            <Dialog open={isLotOpen} onOpenChange={setIsLotOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add yarn lot</DialogTitle>
                        <DialogDescription>Capture the purchase bill and create the opening stock for this lot.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Supplier</Label>
                            <Input value={lotForm.supplier} onChange={(e) => setLotForm((v) => ({ ...v, supplier: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Bill no</Label>
                            <Input value={lotForm.bill_no} onChange={(e) => setLotForm((v) => ({ ...v, bill_no: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={lotForm.bill_date} onChange={(e) => setLotForm((v) => ({ ...v, bill_date: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Yarn type</Label>
                            <Input value={lotForm.yarn_type} onChange={(e) => setLotForm((v) => ({ ...v, yarn_type: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Denier / count</Label>
                            <Input value={lotForm.denier_count} onChange={(e) => setLotForm((v) => ({ ...v, denier_count: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Filament / material</Label>
                            <Input value={lotForm.filament_material} onChange={(e) => setLotForm((v) => ({ ...v, filament_material: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Kg</Label>
                            <Input type="number" min="0" step="0.001" value={lotForm.received_kg} onChange={(e) => setLotForm((v) => ({ ...v, received_kg: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Cones</Label>
                            <Input type="number" min="0" step="1" value={lotForm.received_cones} onChange={(e) => setLotForm((v) => ({ ...v, received_cones: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Rate / kg</Label>
                            <Input type="number" min="0" step="0.01" value={lotForm.rate_per_kg} onChange={(e) => setLotForm((v) => ({ ...v, rate_per_kg: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>GST %</Label>
                            <Input type="number" min="0" step="0.01" value={lotForm.gst_percent} onChange={(e) => setLotForm((v) => ({ ...v, gst_percent: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Total cost</Label>
                            <Input value={formatInr(computedLotTotal)} readOnly />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Notes</Label>
                            <Textarea value={lotForm.notes} onChange={(e) => setLotForm((v) => ({ ...v, notes: e.target.value }))} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLotOpen(false)}>Cancel</Button>
                        <Button onClick={submitLot} disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save lot
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBeamOpen} onOpenChange={setIsBeamOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create beam card</DialogTitle>
                        <DialogDescription>Link a beam to an order and keep the warp issue trail clean from the start.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Beam no</Label>
                            <Input value={beamForm.beam_no} onChange={(e) => setBeamForm((v) => ({ ...v, beam_no: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Order</Label>
                            <Select value={beamForm.order_id} onValueChange={handleOrderSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select order" />
                                </SelectTrigger>
                                <SelectContent>
                                    {initialData.activeOrders.map((order) => (
                                        <SelectItem key={order.id} value={order.id}>
                                            {order.party_name} · {order.quality_label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Quality</Label>
                            <Input value={beamForm.quality_label} onChange={(e) => setBeamForm((v) => ({ ...v, quality_label: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Beam ends</Label>
                            <Input type="number" min="0" step="1" value={beamForm.beam_ends} onChange={(e) => setBeamForm((v) => ({ ...v, beam_ends: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Tape length (m)</Label>
                            <Input type="number" min="0" step="0.01" value={beamForm.tape_length_m} onChange={(e) => setBeamForm((v) => ({ ...v, tape_length_m: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Expected metres</Label>
                            <Input type="number" min="0" step="0.01" value={beamForm.expected_metres} onChange={(e) => setBeamForm((v) => ({ ...v, expected_metres: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Actual beam weight (kg)</Label>
                            <Input type="number" min="0" step="0.001" value={beamForm.actual_beam_weight_kg} onChange={(e) => setBeamForm((v) => ({ ...v, actual_beam_weight_kg: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Sizing vendor</Label>
                            <Input value={beamForm.sizing_vendor} onChange={(e) => setBeamForm((v) => ({ ...v, sizing_vendor: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Sizing bill</Label>
                            <Input value={beamForm.sizing_bill_no} onChange={(e) => setBeamForm((v) => ({ ...v, sizing_bill_no: e.target.value }))} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Notes</Label>
                            <Textarea value={beamForm.notes} onChange={(e) => setBeamForm((v) => ({ ...v, notes: e.target.value }))} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBeamOpen(false)}>Cancel</Button>
                        <Button onClick={submitBeam} disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save beam card
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Issue yarn to beam</DialogTitle>
                        <DialogDescription>This is the quick floor action: pick beam, pick lot, enter kg, save.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Beam card</Label>
                            <Select value={issueForm.beam_card_id} onValueChange={(value) => setIssueForm((v) => ({ ...v, beam_card_id: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select beam" />
                                </SelectTrigger>
                                <SelectContent>
                                    {initialData.beamCards.map((beam) => (
                                        <SelectItem key={beam.id} value={beam.id}>
                                            {beam.beam_no} · {beam.order_party_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedBeam ? (
                                <p className="text-xs text-slate-500">
                                    {selectedBeam.quality_label} · expected {selectedBeam.expected_metres.toFixed(0)} m
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <Label>Movement</Label>
                            <Select value={issueForm.movement_type} onValueChange={(value: (typeof movementOptions)[number]['value']) => setIssueForm((v) => ({ ...v, movement_type: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select movement" />
                                </SelectTrigger>
                                <SelectContent>
                                    {movementOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {issueForm.movement_type === 'adjustment' ? (
                            <div className="space-y-2">
                                <Label>Adjustment mode</Label>
                                <Select value={issueForm.adjustment_mode} onValueChange={(value: 'add' | 'subtract') => setIssueForm((v) => ({ ...v, adjustment_mode: value }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="subtract">Subtract stock</SelectItem>
                                        <SelectItem value="add">Add stock</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <Label>Yarn lot</Label>
                            <Select value={issueForm.yarn_lot_id} onValueChange={(value) => setIssueForm((v) => ({ ...v, yarn_lot_id: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select yarn lot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {initialData.yarnLots.map((lot) => (
                                        <SelectItem key={lot.id} value={lot.id}>
                                            {lot.supplier} · {lot.bill_no} · {lot.yarn_type} {lot.denier_count}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedLot ? (
                                <p className="text-xs text-slate-500">
                                    Available {formatKg(selectedLot.available_kg)} · {selectedLot.available_cones.toLocaleString('en-IN')} cones
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={issueForm.movement_date} onChange={(e) => setIssueForm((v) => ({ ...v, movement_date: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Kg</Label>
                                <Input type="number" min="0" step="0.001" value={issueForm.quantity_kg} onChange={(e) => setIssueForm((v) => ({ ...v, quantity_kg: Number(e.target.value) }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cones</Label>
                                <Input type="number" min="0" step="1" value={issueForm.cones} onChange={(e) => setIssueForm((v) => ({ ...v, cones: Number(e.target.value) }))} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea value={issueForm.notes} onChange={(e) => setIssueForm((v) => ({ ...v, notes: e.target.value }))} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsIssueOpen(false)}>Cancel</Button>
                        <Button onClick={submitIssue} disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save movement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
