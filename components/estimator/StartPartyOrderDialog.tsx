'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Play,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Package,
} from 'lucide-react'
import { type EstimateState, type EstimatorV3Totals } from '@/lib/estimator'
import { startPartyOrderFromEstimator } from '@/app/(dashboard)/owner/estimator/actions'

// ─── Props ────────────────────────────────────────────────────────────────────

export type StartPartyOrderDialogProps = {
    open:            boolean
    onOpenChange:    (open: boolean) => void
    /** Frozen snapshot captured the moment the dialog opens */
    estimatorState:  EstimateState
    estimatorTotals: EstimatorV3Totals
    /** Pre-fill values from the estimator header fields */
    defaultPartyName?:     string
    defaultQualityLabel?:  string
    defaultTargetMeters?:  number | null
    defaultWarpInstruction?: string
    defaultWeftInstruction?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StartPartyOrderDialog({
    open,
    onOpenChange,
    estimatorState,
    estimatorTotals,
    defaultPartyName     = '',
    defaultQualityLabel  = '',
    defaultTargetMeters  = null,
    defaultWarpInstruction = '',
    defaultWeftInstruction = '',
}: StartPartyOrderDialogProps) {
    const router = useRouter()

    // ── Form fields ───────────────────────────────────────────────────────────
    const [partyName,     setPartyName]     = useState(defaultPartyName)
    const [qualityLabel,  setQualityLabel]  = useState(defaultQualityLabel)
    const [targetMeters,  setTargetMeters]  = useState(
        defaultTargetMeters && defaultTargetMeters > 0 ? String(defaultTargetMeters) : ''
    )
    const [deadline,      setDeadline]      = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
    const [orderNotes,    setOrderNotes]    = useState('')

    // ── Loading / success state ───────────────────────────────────────────────
    const [submitting,  setSubmitting]  = useState(false)
    const [succeeded,   setSucceeded]   = useState(false)
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)

    // ── Derived validations ───────────────────────────────────────────────────
    const meters         = Number(targetMeters)
    const quotePricePerM = estimatorTotals.orderQuote?.quotePricePerM ?? 0
    const costPerM       = estimatorTotals.totalProductionCostPerM ?? 0

    const missingPartyName    = !partyName.trim()
    const missingQualityLabel = !qualityLabel.trim()
    const invalidMeters       = !Number.isFinite(meters) || meters <= 0
    const invalidEstimate     = costPerM <= 0 || quotePricePerM <= 0

    const canSubmit = !missingPartyName && !missingQualityLabel && !invalidMeters && !invalidEstimate

    // Soft warnings (don't block)
    const noDeadline     = !deadline
    const noWorkerRate   = (estimatorTotals.weaveCostPerM ?? 0) <= 0

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!canSubmit || submitting) return
        setSubmitting(true)

        const res = await startPartyOrderFromEstimator({
            estimatorState,
            partyName:        partyName.trim(),
            qualityLabel:     qualityLabel.trim(),
            warpInstruction:  defaultWarpInstruction || null,
            weftInstruction:  defaultWeftInstruction || null,
            targetMeters:     meters,
            deadline:         deadline || null,
            quotePricePerM,
            costPerM,
            orderNotes:       orderNotes.trim() || null,
        })

        setSubmitting(false)

        if ('error' in res && res.error) {
            toast.error(res.error)
            return
        }

        if ('success' in res && res.success && res.orderId) {
            setCreatedOrderId(res.orderId)
            setSucceeded(true)
        }
    }

    // ── Success view ──────────────────────────────────────────────────────────
    if (succeeded && createdOrderId) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <div className="flex flex-col items-center text-center gap-4 py-6">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-black text-slate-900">Party order started.</p>
                            <p className="text-sm text-slate-500">Cost snapshot saved. Order is ready for machine assignment.</p>
                        </div>
                        <div className="w-full flex flex-col gap-2 pt-2">
                            <Button
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
                                onClick={() => {
                                    onOpenChange(false)
                                    router.push(`/owner/orders?orderId=${createdOrderId}&created=1`)
                                }}
                            >
                                <Package className="h-4 w-4" />
                                View Order
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full border-slate-200 text-slate-600 font-bold"
                                onClick={() => {
                                    setSucceeded(false)
                                    setCreatedOrderId(null)
                                    setPartyName(defaultPartyName)
                                    setQualityLabel(defaultQualityLabel)
                                    setTargetMeters(
                                        defaultTargetMeters && defaultTargetMeters > 0
                                            ? String(defaultTargetMeters) : ''
                                    )
                                    setDeadline(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
                                    setOrderNotes('')
                                    onOpenChange(false)
                                }}
                            >
                                Start Another Estimate
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    // ── Main dialog ───────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v) }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                        <Play className="h-5 w-5 text-indigo-600" />
                        Start Party Order
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-sm leading-relaxed">
                        Use this when the party has confirmed the rate and you&apos;re ready to start production.
                        <br />
                        <span className="text-slate-400 text-xs mt-1 inline-block">
                            We&apos;ll save this estimate as an accepted quote and create an active order using the same cost snapshot.
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Cost snapshot preview */}
                    {quotePricePerM > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                                <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Cost/m</p>
                                <p className="text-sm font-black font-mono text-slate-700">₹{costPerM.toFixed(2)}</p>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 text-center">
                                <p className="text-[9px] uppercase tracking-widest text-indigo-600 font-bold">Quote/m</p>
                                <p className="text-sm font-black font-mono text-indigo-700">₹{quotePricePerM.toFixed(2)}</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                                <p className="text-[9px] uppercase tracking-widest text-emerald-600 font-bold">Margin</p>
                                <p className="text-sm font-black font-mono text-emerald-700">{estimatorState.profitPct.toFixed(1)}%</p>
                            </div>
                        </div>
                    )}

                    {/* Invalid estimate warning */}
                    {invalidEstimate && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <p className="text-xs font-bold text-amber-700">
                                Complete the estimate with yarn rates and quantity before starting an order.
                            </p>
                        </div>
                    )}

                    {/* Party & Quality */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black text-slate-500">
                                Party Name <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                value={partyName}
                                onChange={(e) => setPartyName(e.target.value)}
                                placeholder="e.g. Mehta Traders"
                                className={missingPartyName && partyName !== defaultPartyName ? 'border-rose-300' : ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black text-slate-500">
                                Quality Label <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                value={qualityLabel}
                                onChange={(e) => setQualityLabel(e.target.value)}
                                placeholder="e.g. Japan Satin 75D"
                            />
                        </div>
                    </div>

                    {/* Target Meters & Deadline */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black text-slate-500">
                                Target Metres <span className="text-rose-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={1}
                                    step={100}
                                    value={targetMeters}
                                    onChange={(e) => setTargetMeters(e.target.value)}
                                    placeholder="e.g. 1000"
                                    className="pr-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">m</span>
                            </div>
                            {invalidMeters && targetMeters !== '' && (
                                <p className="text-[10px] text-rose-600 font-bold">Must be greater than 0</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black text-slate-500">
                                Deadline
                                {noDeadline && (
                                    <span className="ml-1 text-amber-500 font-medium normal-case">(optional)</span>
                                )}
                            </Label>
                            <Input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Soft warnings */}
                    {(noDeadline || noWorkerRate) && (
                        <div className="space-y-1.5">
                            {noDeadline && (
                                <div className="flex items-center gap-2 text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                    No deadline set. This order may not appear in pace-risk warnings.
                                </div>
                            )}
                            {noWorkerRate && (
                                <div className="flex items-center gap-2 text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                    Weaver wage not set. Add picks × per-pick cost in the estimator.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Order notes */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-slate-500">
                            Order Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
                        </Label>
                        <Textarea
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            placeholder="Production instructions, colour notes, party requirements…"
                            className="resize-none h-20 text-xs"
                        />
                    </div>

                    {/* Machine assignment note */}
                    <p className="text-[10px] text-slate-400 font-medium text-center">
                        You can assign machines after creating the order from the order board.
                    </p>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                        className="sm:mr-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={!canSubmit || submitting}
                        onClick={handleSubmit}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 min-w-[160px]"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Starting order…
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" />
                                Create Active Order
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
