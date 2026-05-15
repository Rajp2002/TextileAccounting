'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    Send,
    Loader2,
    Package,
    AlertTriangle,
    IndianRupee,
    ChevronRight,
    Building2,
    Truck,
    Info,
    ExternalLink
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getSellAndDispatchOptions, sellAndDispatchTakas } from '@/app/(dashboard)/owner/dispatches/actions'

export type SellAndDispatchDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultOrderId?: string
    defaultStockLotId?: string
    onSuccess?: (dispatchId: string, trackingUrl: string | null) => void
}

type OrderOption = { id: string; party_name: string; quality_label: string | null; status: string; total_target_meters: number }
type LotOption = { stock_lot_id: string; quality_label: string; godown: string; available_taka_count: number; available_meters: number; cost_per_meter: number; order_id: string | null; unit_label: string }

export function SellAndDispatchDialog({
    open,
    onOpenChange,
    defaultOrderId,
    defaultStockLotId,
    onSuccess
}: SellAndDispatchDialogProps) {
    const [step, setStep] = useState(1)
    const [loadingData, setLoadingData] = useState(true)
    const [pending, startTransition] = useTransition()
    
    const [orders, setOrders] = useState<OrderOption[]>([])
    const [lots, setLots] = useState<LotOption[]>([])

    // Form State
    const [selectedOrderId, setSelectedOrderId] = useState<string>(defaultOrderId || '')
    const [selectedLotIds, setSelectedLotIds] = useState<string[]>(defaultStockLotId ? [defaultStockLotId] : [])
    const [lotUnits, setLotUnits] = useState<Record<string, number>>({})
    const [saleRate, setSaleRate] = useState<string>('')
    const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0])
    
    const [ewayNumber, setEwayNumber] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [transporterName, setTransporterName] = useState('')
    const [distanceKm, setDistanceKm] = useState('')
    const [notes, setNotes] = useState('')
    const [actualDispatchedMeters, setActualDispatchedMeters] = useState('')

    const [confirmedSameQuality, setConfirmedSameQuality] = useState(false)

    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStep(1)
            setSelectedOrderId(defaultOrderId || '')
            setSelectedLotIds(defaultStockLotId ? [defaultStockLotId] : [])
            setConfirmedSameQuality(false)
            setActualDispatchedMeters('')
            setLoadingData(true)
            getSellAndDispatchOptions().then(data => {
                setOrders(data.orders as OrderOption[])
                setLots(data.lots as LotOption[])
                setLoadingData(false)
                
                // Pre-fill lot units to max available if a default lot is passed
                if (defaultStockLotId) {
                    const lot = data.lots.find((l: LotOption) => l.stock_lot_id === defaultStockLotId)
                    if (lot) {
                        setLotUnits({ [defaultStockLotId]: lot.available_taka_count })
                        // Auto-select order if lot has one
                        if (lot.order_id && !defaultOrderId) {
                            setSelectedOrderId(lot.order_id)
                        }
                    }
                }
            })
        }
    }, [open, defaultOrderId, defaultStockLotId])

    const selectedOrder = orders.find(o => o.id === selectedOrderId)
    
    // Filter lots based on selected order
    const compatibleLots = lots.filter(lot => {
        if (!selectedOrder) return true // Show all if no order selected
        if (lot.order_id === selectedOrder.id) return true
        if (!lot.order_id && lot.quality_label && selectedOrder.quality_label && 
            lot.quality_label.toLowerCase() === selectedOrder.quality_label.toLowerCase()) return true
        return false
    })

    const hasSameQualityUnlinkedLot = selectedLotIds.some(id => {
        const l = lots.find(x => x.stock_lot_id === id)
        return l && l.order_id !== selectedOrderId
    })

    const totalSelectedTakas = selectedLotIds.reduce((sum, id) => sum + (lotUnits[id] || 0), 0)
    const totalSelectedMeters = selectedLotIds.reduce((sum, id) => {
        const lot = lots.find(l => l.stock_lot_id === id)
        if (!lot || lot.available_taka_count === 0) return sum
        const mpt = lot.available_meters / lot.available_taka_count
        return sum + ((lotUnits[id] || 0) * mpt)
    }, 0)
    
    const parsedSaleRate = parseFloat(saleRate) || 0
    const totalRevenue = totalSelectedMeters * parsedSaleRate
    const totalCost = selectedLotIds.reduce((sum, id) => {
        const lot = lots.find(l => l.stock_lot_id === id)
        if (!lot || lot.available_taka_count === 0) return sum
        const mpt = lot.available_meters / lot.available_taka_count
        return sum + ((lotUnits[id] || 0) * mpt * lot.cost_per_meter)
    }, 0)
    const grossProfit = totalRevenue - totalCost
    const actualDispatchValue = actualDispatchedMeters.trim() === ''
        ? totalSelectedMeters
        : Number(actualDispatchedMeters)
    const dispatchDifference = Number.isFinite(actualDispatchValue)
        ? actualDispatchValue - totalSelectedMeters
        : 0

    const estimatedGst = totalRevenue * 0.05
    const estimatedConsignmentValue = totalRevenue + estimatedGst
    const ewayLikelyRequired = estimatedConsignmentValue > 50000

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await sellAndDispatchTakas({
                orderId: selectedOrderId,
                selectedLots: selectedLotIds.map(id => ({ stockLotId: id, unitsToSell: lotUnits[id] || 0 })),
                sale: {
                    saleRatePerMeter: parsedSaleRate,
                    saleDate,
                    notes: null
                },
                dispatch: {
                    actualDispatchedMeters: actualDispatchValue,
                    dispatchDate: new Date().toISOString(),
                    ewayBillNumber: ewayNumber,
                    vehicleNumber,
                    transporterName,
                    approximateDistanceKm: distanceKm.trim() ? Number(distanceKm) : null,
                    notes,
                    ewayBillDate: ewayNumber.trim() ? new Date().toISOString() : null
                }
            })

            if (result.success) {
                toast.success('Takas sold and dispatch created!')
                onOpenChange(false)
                onSuccess?.(result.dispatchId, result.trackingUrl)
            } else {
                if (result.recoverable) {
                    toast.warning(result.message, { duration: 8000 })
                    onOpenChange(false) // Close anyway since it's recoverable
                } else {
                    toast.error(result.message)
                }
            }
        })
    }

    const renderStep = () => {
        if (loadingData) {
            return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        }

        if (step === 1) {
            return (
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Who is this dispatch for?</Label>
                        <select
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm h-11 lg:h-9"
                            value={selectedOrderId}
                            onChange={(e) => setSelectedOrderId(e.target.value)}
                        >
                            <option value="">-- Select Party Order --</option>
                            {orders.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.party_name} · {o.quality_label || 'Unspecified'} · {o.total_target_meters}m
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-500">Phase 1: Dispatch tracking currently requires an active order.</p>
                    </div>
                </div>
            )
        }

        if (step === 2) {
            return (
                <div className="space-y-4 py-2">
                    <Label>Select takas to send</Label>
                    {compatibleLots.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No matching stock found for this order.</p>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                            {compatibleLots.map(lot => {
                                const isExactOrder = lot.order_id === selectedOrderId
                                const isSelected = selectedLotIds.includes(lot.stock_lot_id)
                                return (
                                    <div key={lot.stock_lot_id} className={cn("border rounded-xl p-4 flex flex-col gap-3 transition-all", isSelected ? "border-indigo-400 bg-indigo-50" : "bg-white")}>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm text-slate-900">{lot.quality_label}</p>
                                                    {isExactOrder ? (
                                                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">Order Stock</span>
                                                    ) : (
                                                        <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Same Quality</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{lot.godown} · Avg {(lot.available_meters / lot.available_taka_count).toFixed(1)}m / {lot.unit_label}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-900">{lot.available_taka_count} {lot.unit_label}s</p>
                                                <p className="text-xs text-slate-500">Available</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedLotIds(p => [...p, lot.stock_lot_id])
                                                            setLotUnits(p => ({ ...p, [lot.stock_lot_id]: lot.available_taka_count }))
                                                        } else {
                                                            setSelectedLotIds(p => p.filter(id => id !== lot.stock_lot_id))
                                                            setLotUnits(p => { const nv = {...p}; delete nv[lot.stock_lot_id]; return nv })
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                                />
                                                <span className="text-xs font-semibold">Select</span>
                                            </label>
                                            {isSelected && (
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs">Send:</Label>
                                                    <Input 
                                                        type="number" 
                                                        min="1" 
                                                        max={lot.available_taka_count}
                                                        value={lotUnits[lot.stock_lot_id] || ''}
                                                        onChange={(e) => setLotUnits(p => ({...p, [lot.stock_lot_id]: parseInt(e.target.value) || 0}))}
                                                        className="w-24 h-11 lg:h-8 text-sm" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    
                    {hasSameQualityUnlinkedLot && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={confirmedSameQuality}
                                    onChange={e => setConfirmedSameQuality(e.target.checked)}
                                    className="mt-1 rounded border-amber-300 text-amber-600 focus:ring-amber-600"
                                />
                                <span className="text-xs text-amber-800 font-medium">
                                    I confirm I want to dispatch &quot;Same Quality&quot; stock that is not explicitly reserved for this order.
                                </span>
                            </label>
                        </div>
                    )}
                </div>
            )
        }

        if (step === 3) {
            return (
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Sale Rate (per meter)</Label>
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={saleRate}
                                onChange={e => setSaleRate(e.target.value)}
                                placeholder="0.00"
                                className="pl-9 text-slate-900 border-slate-200 h-11 lg:h-9"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Sale Date</Label>
                        <Input
                            type="date"
                            value={saleDate}
                            onChange={e => setSaleDate(e.target.value)}
                            className="text-slate-900 border-slate-200 h-11 lg:h-9"
                        />
                    </div>
                    
                    {/* Financial Preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 mt-4">
                        <p className="text-xs font-bold text-slate-700 mb-2">Sale Preview</p>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Selected Takas</span>
                            <span className="font-semibold text-slate-900">{totalSelectedTakas}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Estimated Meters</span>
                            <span className="font-semibold text-slate-900">{totalSelectedMeters.toFixed(2)} m</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-slate-200 pt-2 mt-2">
                            <span className="text-slate-500">Revenue</span>
                            <span className="font-semibold text-slate-900">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Estimated Cost</span>
                            <span className="font-semibold text-slate-900">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-xs bg-indigo-50 p-1.5 rounded border border-indigo-100">
                            <span className="text-indigo-700 font-bold">Estimated Gross Profit</span>
                            <span className="font-bold text-indigo-700">₹{grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                </div>
            )
        }

        if (step === 4) {
            return (
                <div className="space-y-4 py-2">
                     <div className={cn(
                        'rounded-xl border px-3 py-2.5 text-[11px]',
                        ewayLikelyRequired
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-100 bg-emerald-50 text-emerald-800'
                    )}>
                        <div className="flex items-start gap-2">
                            <AlertTriangle className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', ewayLikelyRequired ? 'text-amber-600' : 'text-emerald-600')} />
                            <div className="space-y-1">
                                <p className="font-bold">
                                    {ewayLikelyRequired ? 'E-way bill may be required. Please confirm before dispatch.' : 'E-way bill likely not required by value'}
                                </p>
                                <p>
                                    Estimated consignment value is ₹{estimatedConsignmentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.
                                </p>
                                <a
                                    href="https://ewaybillgst.gov.in"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-bold underline underline-offset-2"
                                >
                                    Open E-Way Bill Portal <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Actual Dispatched Meters</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={actualDispatchedMeters}
                            onChange={e => setActualDispatchedMeters(e.target.value)}
                            placeholder={totalSelectedMeters.toFixed(2)}
                            className="h-11 lg:h-9"
                        />
                        <p className={cn(
                            'text-[11px] font-semibold',
                            Math.abs(dispatchDifference) > 0.01 ? 'text-amber-700' : 'text-slate-500'
                        )}>
                            Expected ledger dispatch: {totalSelectedMeters.toFixed(2)} m
                            {Math.abs(dispatchDifference) > 0.01
                                ? ` · Stock difference ${dispatchDifference > 0 ? '+' : ''}${dispatchDifference.toFixed(2)} m will need owner review`
                                : ''}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">E-way Bill No.</Label>
                            <Input
                                value={ewayNumber}
                                onChange={e => setEwayNumber(e.target.value)}
                                placeholder="Optional"
                                className="h-11 lg:h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Vehicle No.</Label>
                            <Input
                                value={vehicleNumber}
                                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                                placeholder="GJ01AB1234"
                                className="h-11 lg:h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Transporter</Label>
                            <Input
                                value={transporterName}
                                onChange={e => setTransporterName(e.target.value)}
                                placeholder="Transport name"
                                className="h-11 lg:h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Approx. Distance (km)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="1"
                                value={distanceKm}
                                onChange={e => setDistanceKm(e.target.value)}
                                placeholder="Used for EWB validity"
                                className="h-11 lg:h-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">
                            Notes / Reference
                            <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </Label>
                        <Input
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Invoice #, truck number, etc."
                            className="h-11 lg:h-9"
                        />
                    </div>
                </div>
            )
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-indigo-600" /> 
                        Sell & Dispatch
                    </DialogTitle>
                    <DialogDescription>
                        Sell selected takas and create a dispatch in one step.
                    </DialogDescription>
                </DialogHeader>
                
                {/* Progress Indicators */}
                <div className="flex items-center justify-between mt-2 mb-2">
                    {[
                        { num: 1, label: 'Order' },
                        { num: 2, label: 'Lots' },
                        { num: 3, label: 'Sale' },
                        { num: 4, label: 'Dispatch' },
                    ].map((s) => (
                        <div key={s.num} className={cn("flex flex-col items-center gap-1", step >= s.num ? "opacity-100" : "opacity-40")}>
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white", step >= s.num ? "bg-indigo-600" : "bg-slate-300")}>
                                {s.num}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                        </div>
                    ))}
                </div>

                {renderStep()}

                <DialogFooter className="gap-2 sm:justify-between items-center w-full">
                    <Button variant="ghost" className="text-sm h-11 lg:h-9" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} disabled={pending}>
                        {step === 1 ? 'Cancel' : 'Back'}
                    </Button>
                    {step < 4 ? (
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 lg:h-9"
                            onClick={() => setStep(step + 1)}
                            disabled={
                                (step === 1 && !selectedOrderId) || 
                                (step === 2 && (selectedLotIds.length === 0 || (hasSameQualityUnlinkedLot && !confirmedSameQuality) || selectedLotIds.some(id => (lotUnits[id] || 0) <= 0))) ||
                                (step === 3 && parsedSaleRate <= 0)
                            }
                        >
                            Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={pending || !Number.isFinite(actualDispatchValue) || actualDispatchValue < 0}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 h-11 lg:h-9"
                        >
                            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {pending ? 'Processing…' : 'Sell & Create Dispatch'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
