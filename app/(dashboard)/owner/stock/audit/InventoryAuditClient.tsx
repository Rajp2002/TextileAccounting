'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Calendar,
    ClipboardCheck,
    Download,
    Eye,
    EyeOff,
    Info,
    Layers,
    Lock,
    Package,
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
    auditVariance,
    formatAuditQuantity,
    generateMaterialPositionCsv,
    type AuditLine,
    type FabricAuditItem,
    type InventoryAuditBoard,
    type YarnAuditItem,
} from '@/lib/inventory-audit'
import {
    applyAuditAdjustmentAction,
    createInventoryAuditAction,
    finalizeInventoryAuditAction,
    getInventoryAuditDataAction,
    saveAuditPhysicalCountAction,
} from './actions'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
    initialData: InventoryAuditBoard
    /** Which tab opens first. Defaults to the material position. */
    initialTab?: 'material-position' | 'fabric' | 'yarn' | 'reconciliation'
}

export default function InventoryAuditClient({ initialData, initialTab = 'material-position' }: Props) {
    const router = useRouter()
    const { t, language } = useTranslation()
    const fmt = (value: number, decimals: number, signed = false) => formatAuditQuantity(value, language, decimals, { signed })
    const [isPending, startTransition] = useTransition()
    const [data, setData] = useState<InventoryAuditBoard>(initialData)
    const [auditDate, setAuditDate] = useState<string>(initialData.audit_date)
    const [activeTab, setActiveTab] = useState<string>(initialTab)
    const dateRequest = useRef(0)
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
    const adjustDecimals = adjustDialog?.type === 'fabric' ? 2 : 3

    // What the owner sees for a counted line, and what the database applies (PI-06): the count against stock as of
    // the audit date. A finalized audit shows its frozen record instead.
    function figures(line: AuditLine) {
        const decimals = line.item_type === 'fabric' ? 2 : 3
        const live = line.item_type === 'fabric'
            ? data.fabric.find(item => item.id === line.item_id)?.system_meters
            : data.yarns.find(item => item.id === line.item_id)?.system_loose_kg
        const system = isFinalized || live === undefined ? line.system_quantity : live
        const variance = isFinalized ? line.variance : auditVariance(line.physical_count, system, decimals)
        return { decimals, system, variance }
    }
    const countedLines = data.lines.filter(line => line.physical_count !== null)
    const differingLines = countedLines
        .map(line => ({ line, ...figures(line) }))
        .filter((row): row is typeof row & { variance: number } => row.variance !== null && row.variance !== 0)

    function toggleExpand(yarnKey: string) {
        setExpandedYarns(prev => {
            const next = new Set(prev)
            if (next.has(yarnKey)) next.delete(yarnKey)
            else next.add(yarnKey)
            return next
        })
    }

    // An answer to an older date change is dropped, so the board on screen always belongs to the date in the picker.
    async function handleDateChange(newDate: string) {
        if (!newDate) return
        const request = ++dateRequest.current
        setAuditDate(newDate)
        startTransition(async () => {
            // Only the date is sent. Sending the previous audit's id with it used to show this date's stock beside
            // the old audit's lines and save counts against the old audit (PI-06).
            const res = await getInventoryAuditDataAction({ auditDate: newDate })
            if (request !== dateRequest.current) return
            if ('error' in res) {
                toast.error(res.error)
                setAuditDate(data.audit_date)
                return
            }
            setData(res.data)
            setAuditDate(res.data.audit_date)
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
            toast.success(t('stockAudit.toastCsvDone'))
        } catch {
            toast.error(t('stockAudit.toastCsvFailed'))
        }
    }

    async function handleSavePhysicalCount() {
        if (!countDialog) return
        const count = Number(countDialog.physicalCount)
        if (isNaN(count) || count < 0) {
            toast.error(t('stockAudit.toastInvalidCount'))
            return
        }

        startTransition(async () => {
            // The first count for a date opens (or reuses) that date's draft audit. It belongs to the board on screen,
            // so it uses that board's own date, not only the picker's value.
            let auditId = data.audit?.id
            if (!auditId) {
                const draft = await createInventoryAuditAction({ auditDate: data.audit_date, title: 'Stock Audit' })
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

            toast.success(t('stockAudit.toastCountSaved'))
            setCountDialog(null)

            // Refresh board
            const updated = await getInventoryAuditDataAction({ auditDate: data.audit_date, auditId })
            if ('data' in updated) setData(updated.data)
        })
    }

    async function handleApplyAdjustment() {
        if (!adjustDialog || !data.audit?.id) return
        const dialog = adjustDialog
        const auditId = data.audit.id

        startTransition(async () => {
            const res = await applyAuditAdjustmentAction({
                auditId,
                itemType: dialog.type,
                itemId: dialog.itemId,
                physicalCount: dialog.physicalCount,
                // The database refuses the adjustment if it would now be a different number from the one on screen.
                expectedVariance: dialog.variance,
                reason: dialog.reason.trim() || 'Physical audit reconciliation',
            })

            setAdjustDialog(null)
            if ('error' in res) toast.error(res.error)
            else toast.success(t('stockAudit.toastAdjusted', { variance: fmt(res.variance, dialog.type === 'fabric' ? 2 : 3, true) }))

            // Refresh board: after a refusal it shows the figures the adjustment was checked against.
            const updated = await getInventoryAuditDataAction({ auditDate: data.audit_date, auditId })
            if ('data' in updated) setData(updated.data)
            router.refresh()
        })
    }

    async function handleFinalizeAudit() {
        if (!data.audit?.id) return
        const auditId = data.audit.id

        startTransition(async () => {
            const res = await finalizeInventoryAuditAction({ auditId })
            if ('error' in res) {
                toast.error(res.error)
                return
            }

            toast.success(t('stockAudit.toastFinalized'))
            setFinalizeModal(false)

            const updated = await getInventoryAuditDataAction({ auditDate: data.audit_date, auditId })
            if ('data' in updated) setData(updated.data)
            router.refresh()
        })
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <header className="grid gap-4 border-b border-hairline/80 pb-4 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <Button variant="ghost" size="icon" asChild className="justify-self-start rounded-xl" aria-label={t('stockAudit.backToStock')}>
                    <Link href="/owner/stock">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:col-start-2 sm:row-start-1">
                    <h1 className="text-[1.4rem] font-bold tracking-tight text-ink sm:text-2xl">{t('stockAudit.title')}</h1>
                    {isFinalized ? (
                        <Badge variant="secondary" className="border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]">
                            <Lock className="mr-1 h-3 w-3" /> {t('stockAudit.statusFinalized')}
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]">
                            {t('stockAudit.statusDraft')}
                        </Badge>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
                    {/* Date picker */}
                    <div className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 bg-surface text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{t('stockAudit.auditDate')}</span>
                        <input
                            type="date"
                            value={auditDate}
                            max={initialData.audit_date}
                            onChange={(e) => handleDateChange(e.target.value)}
                            disabled={isPending}
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
                        {t('stockAudit.exportCsv')}
                    </Button>

                    {!isFinalized && data.audit?.id && (
                        <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => setFinalizeModal(true)}
                            className="rounded-xl bg-loom text-white hover:bg-loom-elevated font-bold gap-1.5 text-xs"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            {t('stockAudit.finalizeAudit')}
                        </Button>
                    )}
                </div>
            </header>

            {/* Summary KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Finished Fabric */}
                <Card className="rounded-2xl border border-hairline shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">{t('stockAudit.kpiFabricTitle')}</CardTitle>
                        <Warehouse className="h-4 w-4 text-loom" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-ink">
                            {fmt(data.summary.total_fabric_meters, 2)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{t('stockAudit.unitMetres')}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">{t('stockAudit.kpiFabricHelp')}</p>
                    </CardContent>
                </Card>

                {/* Loose Usable Yarn */}
                <Card className="rounded-2xl border border-hairline shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">{t('stockAudit.kpiLooseTitle')}</CardTitle>
                        <Package className="h-4 w-4 text-[var(--wv-moss-700)]" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-[var(--wv-moss-700)]">
                            {fmt(data.summary.total_loose_yarn_kg, 3)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{t('stockAudit.unitKg')}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">{t('stockAudit.kpiLooseHelp')}</p>
                    </CardContent>
                </Card>

                {/* Yarn Embodied in Fabric */}
                <Card className="rounded-2xl border border-hairline shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">{t('stockAudit.kpiEmbodiedTitle')}</CardTitle>
                        <Layers className="h-4 w-4 text-[var(--wv-neel-600)]" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-ink">
                            {fmt(data.summary.total_embodied_yarn_kg, 3)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{t('stockAudit.unitKg')}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">{t('stockAudit.kpiEmbodiedHelp')}</p>
                    </CardContent>
                </Card>

                {/* Total Yarn Represented */}
                <Card className="rounded-2xl border-2 border-loom/40 bg-loom/5 shadow-xs">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold text-loom">{t('stockAudit.kpiTotalTitle')}</CardTitle>
                        <Scale className="h-4 w-4 text-loom" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold tabular-nums text-ink">
                            {fmt(data.summary.total_yarn_represented_kg, 3)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{t('stockAudit.unitKg')}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                            {t('stockAudit.kpiTotalHelp')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Legacy Fabric Unresolved Notice (Rule 44) */}
            {data.summary.unresolved_fabric_meters > 0 && (
                <div className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-3.5 text-xs text-[var(--wv-ochre-800)] flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-[var(--wv-ochre-800)] shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">{t('stockAudit.legacyTitle')}</p>
                        <p className="mt-0.5 text-[var(--wv-ochre-800)]">
                            {t('stockAudit.legacyBody', { metres: fmt(data.summary.unresolved_fabric_meters, 2) })}
                        </p>
                    </div>
                </div>
            )}

            {/* Audit Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="rounded-xl bg-surface-soft p-1 border border-hairline">
                    <TabsTrigger value="material-position" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <Scale className="h-3.5 w-3.5 text-loom" />
                        {t('stockAudit.tabMaterial')}
                    </TabsTrigger>
                    <TabsTrigger value="fabric" className="rounded-lg text-xs font-medium gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <Warehouse className="h-3.5 w-3.5" />
                        {t('stockAudit.tabFabric', { count: data.fabric.length })}
                    </TabsTrigger>
                    <TabsTrigger value="yarn" className="rounded-lg text-xs font-medium gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <Package className="h-3.5 w-3.5" />
                        {t('stockAudit.tabYarn', { count: data.yarns.length })}
                    </TabsTrigger>
                    <TabsTrigger value="reconciliation" className="rounded-lg text-xs font-medium gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-xs">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {t('stockAudit.tabReconciliation')}
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Material Position (Core Feature) */}
                <TabsContent value="material-position" className="space-y-4">
                    <Card className="rounded-2xl border border-hairline overflow-hidden">
                        <CardHeader className="border-b border-hairline bg-surface-soft/40 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base font-bold text-ink">
                                        {t('stockAudit.mpTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        {t('stockAudit.mpHelp')}
                                    </CardDescription>
                                </div>
                                <span className="text-[11px] text-muted-foreground bg-surface px-2.5 py-1 rounded-lg border">
                                    {t('stockAudit.mpFormula')}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                        <tr>
                                            <th className="p-3">{t('stockAudit.colYarnSpec')}</th>
                                            <th className="p-3 text-right">{t('stockAudit.colLoose')}</th>
                                            <th className="p-3 text-right">{t('stockAudit.colInFabric')}</th>
                                            <th className="p-3 text-right bg-loom/5 font-bold text-loom">{t('stockAudit.colTotal')}</th>
                                            <th className="p-3 text-center">{t('stockAudit.colDrill')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-hairline">
                                        {data.material_position.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    {t('stockAudit.mpEmpty', { date: data.audit_date })}
                                                </td>
                                            </tr>
                                        ) : (
                                            data.material_position.map((row) => {
                                                const isExpanded = expandedYarns.has(row.yarn_key)
                                                return (
                                                    <tr key={row.yarn_key} className="hover:bg-surface-soft/20 transition-colors">
                                                        <td className="p-3 font-bold text-ink">{row.yarn_name}</td>
                                                        <td className="p-3 text-right tabular-nums font-semibold text-[var(--wv-moss-700)]">
                                                            {fmt(row.loose_kg, 3)} {t('stockAudit.unitKg')}
                                                        </td>
                                                        <td className="p-3 text-right tabular-nums">
                                                            {row.embodied_kg > 0 ? (
                                                                <button
                                                                    onClick={() => toggleExpand(row.yarn_key)}
                                                                    className="font-semibold text-loom hover:underline inline-flex items-center gap-1"
                                                                >
                                                                    {fmt(row.embodied_kg, 3)} {t('stockAudit.unitKg')}
                                                                </button>
                                                            ) : (
                                                                <span className="text-muted-foreground">{fmt(0, 3)} {t('stockAudit.unitKg')}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right tabular-nums font-bold text-ink bg-loom/5">
                                                            {fmt(row.total_represented_kg, 3)} {t('stockAudit.unitKg')}
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
                                                                            <EyeOff className="h-3 w-3" /> {t('stockAudit.hide')}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Eye className="h-3 w-3" /> {t('stockAudit.breakdown', { count: row.drilldown.length })}
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
                                        {t('stockAudit.provenanceTitle')}
                                    </h4>
                                    {data.material_position
                                        .filter(row => expandedYarns.has(row.yarn_key))
                                        .map(row => (
                                            <div key={`drilldown-${row.yarn_key}`} className="rounded-xl border bg-surface p-3 space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-ink">
                                                        {t('stockAudit.inFabricLine', { yarn: row.yarn_name, kg: fmt(row.embodied_kg, 3) })}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleExpand(row.yarn_key)}
                                                        className="h-6 text-[10px]"
                                                    >
                                                        {t('stockAudit.close')}
                                                    </Button>
                                                </div>

                                                <div className="rounded-lg border border-hairline overflow-hidden">
                                                    <table className="w-full text-left text-[11px]">
                                                        <thead className="bg-surface-soft text-muted-foreground font-semibold">
                                                            <tr>
                                                                <th className="p-2">{t('stockAudit.colQuality')}</th>
                                                                <th className="p-2">{t('stockAudit.colProdDate')}</th>
                                                                <th className="p-2 text-right">{t('stockAudit.colProduced')}</th>
                                                                <th className="p-2 text-right">{t('stockAudit.colRemaining')}</th>
                                                                <th className="p-2 text-right text-loom">{t('stockAudit.colEmbodied')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-hairline">
                                                            {row.drilldown.map(item => (
                                                                <tr key={item.lot_id} className="hover:bg-surface-soft/20">
                                                                    <td className="p-2 font-medium text-ink">
                                                                        {t('stockAudit.qualityVersion', { quality: item.quality_label, version: item.costing_version })}
                                                                    </td>
                                                                    <td className="p-2 text-muted-foreground">
                                                                        {item.production_date}
                                                                    </td>
                                                                    <td className="p-2 text-right tabular-nums">
                                                                        {fmt(item.produced_meters, 2)} {t('stockAudit.unitM')}
                                                                    </td>
                                                                    <td className="p-2 text-right tabular-nums font-semibold text-ink">
                                                                        {fmt(item.remaining_meters, 2)} {t('stockAudit.unitM')}
                                                                    </td>
                                                                    <td className="p-2 text-right tabular-nums font-bold text-loom">
                                                                        {fmt(item.embodied_kg, 3)} {t('stockAudit.unitKg')}
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
                                <CardTitle className="text-base font-bold text-ink">{t('stockAudit.fabricTitle')}</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    {t('stockAudit.fabricHelp')}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                    <tr>
                                        <th className="p-3">{t('stockAudit.colQuality')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colSystemStock')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colPhysical')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colVariance')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colAction')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {data.fabric.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                {t('stockAudit.fabricEmpty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        data.fabric.map(item => {
                                            const line = data.lines.find(l => l.item_type === 'fabric' && l.item_id === item.id)
                                            const physical = line?.physical_count ?? null
                                            const variance = isFinalized ? line?.variance ?? null : auditVariance(physical, item.system_meters, 2)

                                            return (
                                                <tr key={item.id} className="hover:bg-surface-soft/20">
                                                    <td className="p-3 font-bold text-ink">{item.quality_label}</td>
                                                    <td className="p-3 text-right tabular-nums font-semibold text-ink">
                                                        {fmt(item.system_meters, 2)} {t('stockAudit.unitM')}
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums">
                                                        {physical !== null ? `${fmt(physical, 2)} ${t('stockAudit.unitM')}` : '—'}
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums font-bold">
                                                        {variance !== null && variance !== 0 ? (
                                                            <span className={variance < 0 ? 'text-[var(--wv-madder-600)]' : 'text-[var(--wv-moss-700)]'}>
                                                                {fmt(variance, 2, true)} {t('stockAudit.unitM')}
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
                                                                    disabled={isPending}
                                                                    onClick={() => setCountDialog({
                                                                        type: 'fabric',
                                                                        item,
                                                                        currentSystem: item.system_meters,
                                                                        physicalCount: physical !== null ? String(physical) : '',
                                                                        notes: line?.notes ?? '',
                                                                    })}
                                                                    className="h-7 text-[11px] rounded-lg"
                                                                >
                                                                    {physical !== null ? t('stockAudit.editCount') : t('stockAudit.recordCount')}
                                                                </Button>
                                                                {physical !== null && variance !== 0 && !line?.adjustment_applied && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={isPending}
                                                                        onClick={() => setAdjustDialog({
                                                                            type: 'fabric',
                                                                            itemId: item.id,
                                                                            itemLabel: item.quality_label,
                                                                            systemQty: item.system_meters,
                                                                            physicalCount: physical,
                                                                            variance: variance!,
                                                                            reason: t('stockAudit.defaultReasonFabric'),
                                                                        })}
                                                                        className="h-7 text-[11px] font-bold text-loom border-loom/40 hover:bg-loom/10 rounded-lg"
                                                                    >
                                                                        {t('stockAudit.adjust')}
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
                            <CardTitle className="text-base font-bold text-ink">{t('stockAudit.yarnTitle')}</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                {t('stockAudit.yarnHelp')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-surface-soft/60 border-b border-hairline text-muted-foreground font-semibold">
                                    <tr>
                                        <th className="p-3">{t('stockAudit.colYarnName')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colSystemLoose')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colPhysical')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colVariance')}</th>
                                        <th className="p-3 text-right">{t('stockAudit.colAction')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {data.yarns.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                {t('stockAudit.yarnEmpty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        data.yarns.map(item => {
                                            const line = data.lines.find(l => l.item_type === 'yarn' && l.item_id === item.id)
                                            const physical = line?.physical_count ?? null
                                            const variance = isFinalized ? line?.variance ?? null : auditVariance(physical, item.system_loose_kg, 3)

                                            return (
                                                <tr key={item.id} className="hover:bg-surface-soft/20">
                                                    <td className="p-3 font-bold text-ink">{item.yarn_name}</td>
                                                    <td className="p-3 text-right tabular-nums font-semibold text-ink">
                                                        {fmt(item.system_loose_kg, 3)} {t('stockAudit.unitKg')}
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums">
                                                        {physical !== null ? `${fmt(physical, 3)} ${t('stockAudit.unitKg')}` : '—'}
                                                    </td>
                                                    <td className="p-3 text-right tabular-nums font-bold">
                                                        {variance !== null && variance !== 0 ? (
                                                            <span className={variance < 0 ? 'text-[var(--wv-madder-600)]' : 'text-[var(--wv-moss-700)]'}>
                                                                {fmt(variance, 3, true)} {t('stockAudit.unitKg')}
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
                                                                    disabled={isPending}
                                                                    onClick={() => setCountDialog({
                                                                        type: 'yarn',
                                                                        item,
                                                                        currentSystem: item.system_loose_kg,
                                                                        physicalCount: physical !== null ? String(physical) : '',
                                                                        notes: line?.notes ?? '',
                                                                    })}
                                                                    className="h-7 text-[11px] rounded-lg"
                                                                >
                                                                    {physical !== null ? t('stockAudit.editCount') : t('stockAudit.recordCount')}
                                                                </Button>
                                                                {physical !== null && variance !== 0 && !line?.adjustment_applied && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={isPending}
                                                                        onClick={() => setAdjustDialog({
                                                                            type: 'yarn',
                                                                            itemId: item.id,
                                                                            itemLabel: item.yarn_name,
                                                                            systemQty: item.system_loose_kg,
                                                                            physicalCount: physical,
                                                                            variance: variance!,
                                                                            reason: t('stockAudit.defaultReasonYarn'),
                                                                        })}
                                                                        className="h-7 text-[11px] font-bold text-loom border-loom/40 hover:bg-loom/10 rounded-lg"
                                                                    >
                                                                        {t('stockAudit.adjust')}
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
                            <CardTitle className="text-base font-bold text-ink">{t('stockAudit.recTitle')}</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                {t('stockAudit.recHelp')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 pt-0 space-y-4">
                            {countedLines.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                    {t('stockAudit.recNoCounts')}
                                </p>
                            ) : differingLines.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                    {t('stockAudit.recNoVariance')}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {differingLines.map(({ line, system, variance, decimals }) => (
                                            <div
                                                key={line.id}
                                                className="flex items-center justify-between p-3 rounded-xl border border-hairline text-xs"
                                            >
                                                <div>
                                                    <p className="font-bold text-ink">
                                                        {line.item_label}{' '}
                                                        <span className="text-[10px] text-muted-foreground uppercase">
                                                            ({line.item_type === 'fabric' ? t('stockAudit.typeFabric') : t('stockAudit.typeYarn')})
                                                        </span>
                                                    </p>
                                                    <p className="text-muted-foreground">
                                                        {t('stockAudit.recSystem', { value: fmt(system, decimals) })} | {t('stockAudit.recPhysical', { value: fmt(line.physical_count ?? 0, decimals) })} |{' '}
                                                        <span className={variance < 0 ? 'text-[var(--wv-madder-600)] font-bold' : 'text-[var(--wv-moss-700)] font-bold'}>
                                                            {t('stockAudit.recVariance', { value: fmt(variance, decimals, true) })}
                                                        </span>
                                                    </p>
                                                </div>

                                                <div>
                                                    {line.adjustment_applied ? (
                                                        <Badge variant="outline" className="text-[var(--wv-moss-700)] bg-[var(--wv-moss-50)] border-[var(--wv-moss-200)] font-semibold">
                                                            ✓ {t('stockAudit.adjustmentApplied')}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[var(--wv-ochre-800)] bg-[var(--wv-ochre-50)] border-[var(--wv-ochre-200)]">
                                                            {t('stockAudit.pendingAdjustment')}
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
                            {t('stockAudit.countTitle', { item: countDialog ? ('quality_label' in countDialog.item ? countDialog.item.quality_label : countDialog.item.yarn_name) : '' })}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {t('stockAudit.countHelp')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="rounded-lg bg-surface-soft/60 p-2.5 text-xs text-muted-foreground">
                            {t('stockAudit.systemQuantity')}{' '}
                            <strong className="text-ink">
                                {countDialog ? fmt(countDialog.currentSystem, countDialog.type === 'fabric' ? 2 : 3) : ''}{' '}
                                {countDialog?.type === 'fabric' ? t('stockAudit.unitMetres') : t('stockAudit.unitKg')}
                            </strong>
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-ink">{t('stockAudit.physicalLabel')}</Label>
                            <Input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder={t('stockAudit.physicalPlaceholder')}
                                value={countDialog?.physicalCount ?? ''}
                                onChange={(e) => setCountDialog(prev => prev ? { ...prev, physicalCount: e.target.value } : null)}
                                className="mt-1 h-9 rounded-lg"
                                autoFocus
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-ink">{t('stockAudit.notesLabel')}</Label>
                            <Input
                                placeholder={t('stockAudit.notesPlaceholder')}
                                value={countDialog?.notes ?? ''}
                                onChange={(e) => setCountDialog(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                className="mt-1 h-9 rounded-lg text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setCountDialog(null)} className="rounded-xl">
                            {t('stockAudit.cancel')}
                        </Button>
                        <Button
                            size="sm"
                            disabled={!countDialog?.physicalCount}
                            onClick={handleSavePhysicalCount}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            {t('stockAudit.saveCount')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirm Stock Adjustment */}
            <Dialog open={adjustDialog !== null} onOpenChange={(open) => !open && setAdjustDialog(null)}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            {t('stockAudit.adjustTitle', { item: adjustDialog?.itemLabel ?? '' })}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            {t('stockAudit.adjustHelp')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-3.5 text-xs text-[var(--wv-ochre-800)] space-y-1">
                        <p>{t('stockAudit.adjustSystemOn', { date: data.audit_date })} <strong>{adjustDialog ? fmt(adjustDialog.systemQty, adjustDecimals) : ''}</strong></p>
                        <p>{t('stockAudit.adjustPhysical')} <strong>{adjustDialog ? fmt(adjustDialog.physicalCount, adjustDecimals) : ''}</strong></p>
                        <p className="font-bold text-[var(--wv-madder-600)]">
                            {t('stockAudit.adjustDelta')} {adjustDialog ? fmt(adjustDialog.variance, adjustDecimals, true) : ''}
                        </p>
                    </div>

                    <div className="py-2">
                        <Label className="text-xs font-semibold text-ink">{t('stockAudit.adjustReasonLabel')}</Label>
                        <Input
                            value={adjustDialog?.reason ?? ''}
                            onChange={(e) => setAdjustDialog(prev => prev ? { ...prev, reason: e.target.value } : null)}
                            className="mt-1 h-9 rounded-lg text-xs"
                        />
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAdjustDialog(null)} className="rounded-xl">
                            {t('stockAudit.cancel')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApplyAdjustment}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            {t('stockAudit.confirmAdjustment')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirm Finalize Audit */}
            <Dialog open={finalizeModal} onOpenChange={setFinalizeModal}>
                <DialogContent className="max-w-md rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-ink">
                            {t('stockAudit.finalizeTitle', { date: data.audit_date })}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            {t('stockAudit.finalizeHelp')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl bg-surface-soft/60 p-3 text-xs space-y-1">
                        <p>✓ {t('stockAudit.finFabric')}: <strong>{fmt(data.summary.total_fabric_meters, 2)} {t('stockAudit.unitM')}</strong></p>
                        <p>✓ {t('stockAudit.finLoose')}: <strong>{fmt(data.summary.total_loose_yarn_kg, 3)} {t('stockAudit.unitKg')}</strong></p>
                        <p>✓ {t('stockAudit.finEmbodied')}: <strong>{fmt(data.summary.total_embodied_yarn_kg, 3)} {t('stockAudit.unitKg')}</strong></p>
                        <p className="font-bold text-loom">✓ {t('stockAudit.finTotal')}: {fmt(data.summary.total_yarn_represented_kg, 3)} {t('stockAudit.unitKg')}</p>
                    </div>

                    <DialogFooter className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setFinalizeModal(false)} className="rounded-xl">
                            {t('stockAudit.cancel')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleFinalizeAudit}
                            className="rounded-xl font-bold bg-loom text-white shadow-xs hover:bg-loom-elevated"
                        >
                            {t('stockAudit.confirmFinalize')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
