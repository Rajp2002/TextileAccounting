'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    Download,
    Eye,
    EyeOff,
    HelpCircle,
    Info,
    Layers,
    Lock,
    Package,
    RefreshCw,
    Scale,
    Warehouse,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    generateMaterialPositionCsv,
    type FabricAuditItem,
    type InventoryAuditBoard,
    type MaterialPositionItem,
    type YarnAuditItem,
} from '@/lib/inventory-audit'
import {
    applyAuditAdjustmentAction,
    createInventoryAuditAction,
    finalizeInventoryAuditAction,
    getInventoryAuditDataAction,
    saveAuditPhysicalCountAction,
} from './actions'

interface Props {
    initialData: InventoryAuditBoard
}

export default function InventoryAuditClient({ initialData }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [data, setData] = useState<InventoryAuditBoard>(initialData)
    const [auditDate, setAuditDate] = useState<string>(initialData.audit_date)
    const [activeTab, setActiveTab] = useState<string>('material-position')
    const [expandedYarns, setExpandedYarns] = useState<Set<string>>(new Set())

    // Physical reconciliation dialog
    const [countDialog, setCountDialog] = useState<{
        type: 'fabric' | 'yarn'
        item: FabricAuditItem | YarnAuditItem
        currentSystem: number
        physicalCount: string
        notes: string
    } | null>(null)

    // Apply adjustment confirmation dialog
    const [adjustDialog, setAdjustDialog] = useState<{
        type: 'fabric' | 'yarn'
        itemId: string
        itemLabel: string
        systemQty: number
        physicalCount: number
        variance: number
        reason: string
    } | null>(null)

    // Finalize confirmation dialog
    const [finalizeModal, setFinalizeModal] = useState<boolean>(false)

    const isFinalized = data.audit?.status === 'finalized'

    function toggleExpand(yarnKey: string) {
        setExpandedYarns(prev => {
            const next = new Set(prev)
            if (next.has(yarnKey)) next.delete(yarnKey)
            else next.add(yarnKey)
            return next
        })
    }

    async function handleDateChange(newDate: string) {
        setAuditDate(newDate)
        startTransition(async () => {
            const res = await getInventoryAuditDataAction({ auditDate: newDate, auditId: data.audit?.id })
            if ('error' in res) {
                toast.error(res.error)
                return
            }
            setData(res.data)
        })
    }

    function handleExportCsv() {
        try {
            const csv = generateMaterialPositionCsv(data)
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `inventory-audit-${data.audit_date}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Audit CSV downloaded successfully.')
        } catch {
            toast.error('Failed to export CSV.')
        }
    }

    async function handleSavePhysicalCount() {
        if (!countDialog) return
        const count = Number(countDialog.physicalCount)
        if (isNaN(count) || count < 0) {
            toast.error('Enter a valid non-negative physical count.')
            return
        }

        startTransition(async () => {
            // The first count for a date opens (or reuses) that date's draft audit.
            let auditId = data.audit?.id
            if (!auditId) {
                const draft = await createInventoryAuditAction({ auditDate, title: 'Stock Audit' })
                if ('error' in draft) {
                    toast.error(draft.error)
                    return
                }
                auditId = draft.auditId
            }

            const res = await saveAuditPhysicalCountAction({
                auditId,
                itemType: countDialog.type,
                itemId: countDialog.item.id,
                itemLabel: 'quality_label' in countDialog.item ? countDialog.item.quality_label : countDialog.item.yarn_name,
                systemQuantity: countDialog.currentSystem,
                physicalCount: count,
                notes: countDialog.notes.trim() || undefined,
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Physical count recorded.')
            setCountDialog(null)

            // Refresh board
            const updated = await getInventoryAuditDataAction({ auditDate, auditId })
            if ('data' in updated) setData(updated.data)
        })
    }

    async function handleApplyAdjustment() {
        if (!adjustDialog || !data.audit?.id) return

        startTransition(async () => {
            const res = await applyAuditAdjustmentAction({
                auditId: data.audit!.id,
                itemType: adjustDialog.type,
                itemId: adjustDialog.itemId,
                physicalCount: adjustDialog.physicalCount,
                reason: adjustDialog.reason.trim() || 'Physical audit reconciliation',
            })

            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success(`Operational stock updated by ${res.variance > 0 ? '+' : ''}${res.variance} via audit adjustment.`)
            setAdjustDialog(null)

            // Refresh board
            const updated = await getInventoryAuditDataAction({ auditDate, auditId: data.audit!.id })
            if ('data' in updated) setData(updated.data)
            router.refresh()
        })
    }

    async function handleFinalizeAudit() {
        if (!data.audit?.id) return

        startTransition(async () => {
            const res = await finalizeInventoryAuditAction({ auditId: data.audit!.id })
            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success('Inventory Audit finalized and frozen.')
            setFinalizeModal(false)

            const updated = await getInventoryAuditDataAction({ auditDate, auditId: data.audit!.id })
            if ('data' in updated) setData(updated.data)
            router.refresh()
        })
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <header className="grid gap-4 border-b border-hairline/80 pb-4 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <Button variant="ghost" size="icon" asChild className="justify-self-start rounded-xl" aria-label="Back to stock">
                    <Link href="/owner/stock">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:col-start-2 sm:row-start-1">
                    <h1 className="text-[1.4rem] font-bold tracking-tight text-ink sm:text-2xl">Inventory Audit & Material Position</h1>
                    {isFinalized ? (
                        <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                            <Lock className="mr-1 h-3 w-3" /> Finalized
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                            Draft / Working
                        </Badge>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
                    {/* Date picker */}
                    <div className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 bg-surface text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Audit Date:</span>
                        <input
                            type="date"
                            value={auditDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            disabled={isPending || isFinalized}
                            className="bg-transparent font-bold text-ink focus:outline-none cursor-pointer"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        className="rounded-xl gap-1.5 text-xs font-semibold"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>

                    {!isFinalized && data.audit?.id && (
                        <Button
                            size="sm"
                            onClick={() => setFinalizeModal(true)}
                            className="rounded-xl bg-loom text-white hover:bg-loom-elevated font-bold gap-1.5 text-xs"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Finalize Audit
                        </Button>
                    )}
                </div>
            </header>

            {/* Summary KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Finished Fabric */}
                <Card className="rounded-2xl border border-hairline shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Fabric on Hand</CardTitle>
                        <Warehouse className="h-4 w-4 text-loom" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-ink">
                            {data.summary.total_fabric_meters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            <span className="text-sm font-normal text-muted-foreground ml-1">metres</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Finished fabric held in Fabric Stock</p>
                    </CardContent>
                </Card>

                {/* Loose Usable Yarn */}
                <Card className="rounded-2xl border border-hairline shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Loose Usable Yarn</CardTitle>
                        <Package className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-emerald-700">
                            {data.summary.total_loose_yarn_kg.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Raw yarn physically in Yarn Stock</p>
                    </CardContent>
                </Card>

                {/* Yarn Embodied in Fabric */}
                <Card className="rounded-2xl border border-hairline shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Yarn Embodied in Fabric</CardTitle>
                        <Layers className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-indigo-700">
                            {data.summary.total_embodied_yarn_kg.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Derived from unsold production lots</p>
                    </CardContent>
                </Card>

                {/* Total Yarn Represented */}
                <Card className="rounded-2xl border-2 border-loom/40 bg-loom/5 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold text-loom">Total Represented</CardTitle>
                        <Scale className="h-4 w-4 text-loom" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-ink">
                            {data.summary.total_yarn_represented_kg.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                            Loose usable + embodied in finished fabric
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Legacy Fabric Unresolved Notice (Rule 44) */}
            {data.summary.unresolved_fabric_meters > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Notice regarding legacy fabric stock</p>
                        <p className="mt-0.5 text-amber-800">
                            {data.summary.unresolved_fabric_meters.toLocaleString()} metres of fabric stock predate production lot tracking. In accordance with system audit integrity, yarn composition is not guessed or fabricated for historical inventory.
                        </p>
                    </div>
                </div>
            )}

            {/* Audit Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="rounded-xl bg-surface-soft p-1 border border-hairline">
                    <TabsTrigger value="material-position" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <Scale className="h-3.5 w-3.5 text-loom" />
                        Material Position (Audit)
                    </TabsTrigger>
                    <TabsTrigger value="fabric" className="rounded-lg text-xs font-medium gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <Warehouse className="h-3.5 w-3.5" />
                        Fabric Stock ({data.fabric.length})
                    </TabsTrigger>
                    <TabsTrigger value="yarn" className="rounded-lg text-xs font-medium gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <Package className="h-3.5 w-3.5" />
                        Yarn Stock ({data.yarns.length})
                    </TabsTrigger>
                    <TabsTrigger value="reconciliation" className="rounded-lg text-xs font-medium gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Reconciliation
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Material Position (Core Feature) */}
                <TabsContent value="material-position" className="space-y-4">
                    <Card className="rounded-2xl border border-hairline overflow-hidden">
                        <CardHeader className="border-b border-hairline bg-surface-soft/40 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base font-bold text-ink">
                                        Material Position / Yarn Equivalent
                                    </CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Loose yarn currently in stock plus yarn currently embodied in unsold finished fabric inventory.
                                    </CardDescription>
                                </div>
                                <span className="text-[11px] text-muted-foreground bg-surface px-2.5 py-1 rounded-lg border">
                                    Formula: Loose Yarn + Embodied in Fabric = Total Represented
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                        <tr>
                                            <th className="p-3">Yarn Specification</th>
                                            <th className="p-3 text-right">Loose Usable Yarn</th>
                                            <th className="p-3 text-right">In Fabric Stock</th>
                                            <th className="p-3 text-right bg-loom/5 font-bold text-loom">Total Represented</th>
                                            <th className="p-3 text-center">Drill-Down</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-hairline">
                                        {data.material_position.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    No yarn positions recorded as of {data.audit_date}.
                                                </td>
                                            </tr>
                                        ) : (
                                            data.material_position.map((row) => {
                                                const isExpanded = expandedYarns.has(row.yarn_key)
                                                return (
                                                    <tr key={row.yarn_key} className="hover:bg-surface-soft/20 transition-colors">
                                                        <td className="p-3 font-bold text-ink">{row.yarn_name}</td>
                                                        <td className="p-3 text-right tabular-nums font-semibold text-emerald-700">
                                                            {row.loose_kg.toFixed(3)} kg
                                                        </td>
                                                        <td className="p-3 text-right tabular-nums">
                                                            {row.embodied_kg > 0 ? (
                                                                <button
                                                                    onClick={() => toggleExpand(row.yarn_key)}
                                                                    className="font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                                                                >
                                                                    {row.embodied_kg.toFixed(3)} kg
                                                                </button>
                                                            ) : (
                                                                <span className="text-muted-foreground">0.000 kg</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right tabular-nums font-bold text-ink bg-loom/5">
                                                            {row.total_represented_kg.toFixed(3)} kg
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {row.drilldown.length > 0 ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleExpand(row.yarn_key)}
                                                                    className="h-7 px-2 text-[11px] gap-1 rounded-lg text-muted-foreground hover:text-ink"
                                                                >
                                                                    {isExpanded ? (
                                                                        <>
                                                                            <EyeOff className="h-3 w-3" /> Hide
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Eye className="h-3 w-3" /> Breakdown ({row.drilldown.length})
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            ) : (
                                                                <span className="text-muted-foreground text-[10px]">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Drilldown panels */}
                            {data.material_position.some(row => expandedYarns.has(row.yarn_key)) && (
                                <div className="border-t border-hairline bg-surface-soft/30 p-4 space-y-4">
                                    <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                                        Embodied Yarn Provenance & Breakdown
                                    </h4>
                                    {data.material_position
                                        .filter(row => expandedYarns.has(row.yarn_key))
                                        .map(row => (
                                            <div key={`drilldown-${row.yarn_key}`} className="rounded-xl border bg-surface p-3 space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-ink">
                                                        {row.yarn_name} — {row.embodied_kg.toFixed(3)} kg in Fabric
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleExpand(row.yarn_key)}
                                                        className="h-6 text-[10px]"
                                                    >
                                                        Close
                                                    </Button>
                                                </div>

                                                <div className="rounded-lg border border-hairline overflow-hidden">
                                                    <table className="w-full text-left text-[11px]">
                                                        <thead className="bg-surface-soft text-muted-foreground font-semibold">
                                                            <tr>
                                                                <th className="p-2">Quality</th>
                                                                <th className="p-2">Production Date</th>
                                                                <th className="p-2 text-right">Produced</th>
                                                                <th className="p-2 text-right">Remaining in Stock</th>
                                                                <th className="p-2 text-right text-indigo-700">Embodied Yarn</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-hairline">
                                                            {row.drilldown.map(item => (
                                                                <tr key={item.lot_id} className="hover:bg-surface-soft/20">
                                                                    <td className="p-2 font-medium text-ink">
                                                                        {item.quality_label} (v{item.costing_version})
                                                                    </td>
                                                                    <td className="p-2 text-muted-foreground">
                                                                        {item.production_date}
                                                                    </td>
                                                                    <td className="p-2 text-right tabular-nums">
                                                                        {item.produced_meters.toFixed(2)} m
                                                                    </td>
                                                                    <td className="p-2 text-right tabular-nums font-semibold text-ink">
                                                                        {item.remaining_meters.toFixed(2)} m
                                                                    </td>
                                                                    <td className="p-2 text-right tabular-nums font-bold text-indigo-700">
                                                                        {item.embodied_kg.toFixed(3)} kg
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Fabric Inventory */}
                <TabsContent value="fabric" className="space-y-4">
                    <Card className="rounded-2xl border border-hairline overflow-hidden">
                        <CardHeader className="border-b border-hairline bg-surface-soft/40 p-4 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-bold text-ink">Fabric Physical Audit</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Finished fabric physically held in stock. Compare system metres with physical inventory counts.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                    <tr>
                                        <th className="p-3">Quality</th>
                                        <th className="p-3 text-right">System Stock</th>
                                        <th className="p-3 text-right">Physical Count</th>
                                        <th className="p-3 text-right">Variance</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {data.fabric.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                No fabric qualities in stock.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.fabric.map(item => {
                                            const line = data.lines.find(l => l.item_type === 'fabric' && l.item_id === item.id)
                                            const physical = line?.physical_count ?? null
                                            const variance = line?.variance ?? null

                                            return (
                                                <tr key={item.id} className="hover:bg-surface-soft/20">
                                                    <td className="p-3 font-bold text-ink">{item.quality_label}</td>
                                                    <td className="p-3 text-right tabular-nums font-semibold text-ink">
                                                        {item.system_meters.toFixed(2)} m
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums">
                                                        {physical !== null ? `${physical.toFixed(2)} m` : '—'}
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums font-bold">
                                                        {variance !== null && variance !== 0 ? (
                                                            <span className={variance < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                                {variance > 0 ? '+' : ''}{variance.toFixed(2)} m
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {!isFinalized && (
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setCountDialog({
                                                                        type: 'fabric',
                                                                        item,
                                                                        currentSystem: item.system_meters,
                                                                        physicalCount: physical !== null ? String(physical) : '',
                                                                        notes: line?.notes ?? '',
                                                                    })}
                                                                    className="h-7 text-[11px] rounded-lg"
                                                                >
                                                                    {physical !== null ? 'Edit Count' : 'Record Count'}
                                                                </Button>
                                                                {physical !== null && variance !== 0 && !line?.adjustment_applied && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setAdjustDialog({
                                                                            type: 'fabric',
                                                                            itemId: item.id,
                                                                            itemLabel: item.quality_label,
                                                                            systemQty: item.system_meters,
                                                                            physicalCount: physical,
                                                                            variance: variance!,
                                                                            reason: 'Physical count reconciliation adjustment',
                                                                        })}
                                                                        className="h-7 text-[11px] font-bold text-loom border-loom/40 hover:bg-loom/10 rounded-lg"
                                                                    >
                                                                        Adjust
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Loose Yarn Inventory */}
                <TabsContent value="yarn" className="space-y-4">
                    <Card className="rounded-2xl border border-hairline overflow-hidden">
                        <CardHeader className="border-b border-hairline bg-surface-soft/40 p-4">
                            <CardTitle className="text-base font-bold text-ink">Loose Yarn Physical Audit</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Raw/loose yarn physically stored in factory. Does not include yarn already woven into fabric.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                    <tr>
                                        <th className="p-3">Yarn Name</th>
                                        <th className="p-3 text-right">System Loose Stock</th>
                                        <th className="p-3 text-right">Physical Count</th>
                                        <th className="p-3 text-right">Variance</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {data.yarns.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                No yarn stock recorded.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.yarns.map(item => {
                                            const line = data.lines.find(l => l.item_type === 'yarn' && l.item_id === item.id)
                                            const physical = line?.physical_count ?? null
                                            const variance = line?.variance ?? null

                                            return (
                                                <tr key={item.id} className="hover:bg-surface-soft/20">
                                                    <td className="p-3 font-bold text-ink">{item.yarn_name}</td>
                                                    <td className="p-3 text-right tabular-nums font-semibold text-ink">
                                                        {item.system_loose_kg.toFixed(3)} kg
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums">
                                                        {physical !== null ? `${physical.toFixed(3)} kg` : '—'}
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums font-bold">
                                                        {variance !== null && variance !== 0 ? (
                                                            <span className={variance < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                                {variance > 0 ? '+' : ''}{variance.toFixed(3)} kg
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {!isFinalized && (
                                                            <div className="flex justify-end gap-1.5">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setCountDialog({
                                                                        type: 'yarn',
                                                                        item,
                                                                        currentSystem: item.system_loose_kg,
                                                                        physicalCount: physical !== null ? String(physical) : '',
                                                                        notes: line?.notes ?? '',
                                                                    })}
                                                                    className="h-7 text-[11px] rounded-lg"
                                                                >
                                                                    {physical !== null ? 'Edit Count' : 'Record Count'}
                                                                </Button>
                                                                {physical !== null && variance !== 0 && !line?.adjustment_applied && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setAdjustDialog({
                                                                            type: 'yarn',
                                                                            itemId: item.id,
                                                                            itemLabel: item.yarn_name,
                                                                            systemQty: item.system_loose_kg,
                                                                            physicalCount: physical,
                                                                            variance: variance!,
                                                                            reason: 'Physical stock reconciliation adjustment',
                                                                        })}
                                                                        className="h-7 text-[11px] font-bold text-loom border-loom/40 hover:bg-loom/10 rounded-lg"
                                                                    >
                                                                        Adjust
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Reconciliation Summary */}
                <TabsContent value="reconciliation" className="space-y-4">
                    <Card className="rounded-2xl border border-hairline">
                        <CardHeader className="p-5">
                            <CardTitle className="text-base font-bold text-ink">Reconciliation Status</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Overview of recorded physical count differences and reconciliation adjustments.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 pt-0 space-y-4">
                            {data.lines.filter(l => l.variance !== null && l.variance !== 0).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                    No variances recorded. All verified physical counts match system stock.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {data.lines
                                        .filter(l => l.variance !== null && l.variance !== 0)
                                        .map(line => (
                                            <div
                                                key={line.id}
                                                className="flex items-center justify-between p-3 rounded-xl border border-hairline text-xs"
                                            >
                                                <div>
                                                    <p className="font-bold text-ink">
                                                        {line.item_label}{' '}
                                                        <span className="text-[10px] text-muted-foreground uppercase">
                                                            ({line.item_type})
                                                        </span>
                                                    </p>
                                                    <p className="text-muted-foreground">
                                                        System: {line.system_quantity} | Physical: {line.physical_count} |{' '}
                                                        <span className={line.variance! < 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                                                            Variance: {line.variance! > 0 ? '+' : ''}{line.variance}
                                                        </span>
                                                    </p>
                                                </div>

                                                <div>
                                                    {line.adjustment_applied ? (
                                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 font-semibold">
                                                            ✓ Adjustment Applied
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300">
                                                            Pending Adjustment
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog: Record Physical Count */}
            <Dialog open={countDialog !== null} onOpenChange={(open) => !open && setCountDialog(null)}>
                <DialogContent className="max-w-sm rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Record Physical Count: {countDialog ? ('quality_label' in countDialog.item ? countDialog.item.quality_label : countDialog.item.yarn_name) : ''}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Enter the verified physical quantity found during inventory count.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="rounded-lg bg-surface-soft/60 p-2.5 text-xs text-muted-foreground">
                            System Quantity:{' '}
                            <strong className="text-ink">
                                {countDialog?.currentSystem}{' '}
                                {countDialog?.type === 'fabric' ? 'metres' : 'kg'}
                            </strong>
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-ink">Physical Count *</Label>
                            <Input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder="e.g. 246.5"
                                value={countDialog?.physicalCount ?? ''}
                                onChange={(e) => setCountDialog(prev => prev ? { ...prev, physicalCount: e.target.value } : null)}
                                className="mt-1 h-9 rounded-lg"
                                autoFocus
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-ink">Notes (optional)</Label>
                            <Input
                                placeholder="e.g. Verified by Floor Supervisor"
                                value={countDialog?.notes ?? ''}
                                onChange={(e) => setCountDialog(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                className="mt-1 h-9 rounded-lg text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setCountDialog(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!countDialog?.physicalCount}
                            onClick={handleSavePhysicalCount}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            Save Count
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirm Stock Adjustment */}
            <Dialog open={adjustDialog !== null} onOpenChange={(open) => !open && setAdjustDialog(null)}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Apply Audit Adjustment: {adjustDialog?.itemLabel}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            This will create an official <strong>AUDIT_ADJUSTMENT</strong> ledger movement and update current operational stock.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1">
                        <p>Previous System Balance: <strong>{adjustDialog?.systemQty}</strong></p>
                        <p>Physical Count Verified: <strong>{adjustDialog?.physicalCount}</strong></p>
                        <p className="font-bold text-rose-800">
                            Adjustment Delta: {adjustDialog && adjustDialog.variance > 0 ? '+' : ''}{adjustDialog?.variance}
                        </p>
                    </div>

                    <div className="py-2">
                        <Label className="text-xs font-semibold text-ink">Adjustment Reason</Label>
                        <Input
                            value={adjustDialog?.reason ?? ''}
                            onChange={(e) => setAdjustDialog(prev => prev ? { ...prev, reason: e.target.value } : null)}
                            className="mt-1 h-9 rounded-lg text-xs"
                        />
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAdjustDialog(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApplyAdjustment}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            Confirm Adjustment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirm Finalize Audit */}
            <Dialog open={finalizeModal} onOpenChange={setFinalizeModal}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            Finalize Inventory Audit ({data.audit_date})?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Finalizing creates an immutable, permanent snapshot of all fabric, loose yarn, embodied yarn, and material position calculations. Once finalized, historical calculations will remain permanently frozen.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl bg-surface-soft/60 p-3 text-xs space-y-1">
                        <p>✓ Fabric On Hand: <strong>{data.summary.total_fabric_meters} m</strong></p>
                        <p>✓ Loose Usable Yarn: <strong>{data.summary.total_loose_yarn_kg} kg</strong></p>
                        <p>✓ Embodied Yarn: <strong>{data.summary.total_embodied_yarn_kg} kg</strong></p>
                        <p className="font-bold text-loom">✓ Total Represented: {data.summary.total_yarn_represented_kg} kg</p>
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setFinalizeModal(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleFinalizeAudit}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            Yes, Finalize & Freeze Audit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
