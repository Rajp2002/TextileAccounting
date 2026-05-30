'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { CalendarDays, ChevronRight, IndianRupee, Loader2, Package, Send, Truck, UserRound } from 'lucide-react'
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
import { createPartyStockSaleAndOptionalDispatch, getSellAndDispatchOptions } from '@/app/(dashboard)/owner/dispatches/actions'

export type SellAndDispatchDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultOrderId?: string
    defaultStockLotId?: string
    onSuccess?: (dispatchId: string, trackingUrl: string | null) => void
}

type OrderOption = { id: string; party_name: string; quality_label: string | null; status: string; total_target_meters: number }
type LotOption = {
    stock_lot_id: string
    quality_label: string
    godown: string
    source_type?: string | null
    market_run_id?: string | null
    available_taka_count: number
    available_meters: number
    meters_per_taka: number
    cost_per_meter: number
    order_id: string | null
    unit_label: string
}

function todayDate() {
    return new Date().toISOString().slice(0, 10)
}

function addDays(dateString: string, days: number) {
    const date = new Date(`${dateString}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function money(value: number) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function SellAndDispatchDialog({
    open,
    onOpenChange,
    defaultOrderId,
    defaultStockLotId,
    onSuccess,
}: SellAndDispatchDialogProps) {
    const [step, setStep] = useState(1)
    const [loadingData, setLoadingData] = useState(true)
    const [pending, startTransition] = useTransition()

    const [orders, setOrders] = useState<OrderOption[]>([])
    const [lots, setLots] = useState<LotOption[]>([])

    const [sourceId, setSourceId] = useState(defaultStockLotId || '')
    const [partyName, setPartyName] = useState('')
    const [partyPhone, setPartyPhone] = useState('')
    const [partyCity, setPartyCity] = useState('')
    const [partyGstin, setPartyGstin] = useState('')
    const [soldMeters, setSoldMeters] = useState('')
    const [soldTakas, setSoldTakas] = useState('')
    const [saleRate, setSaleRate] = useState('')
    const [creditDays, setCreditDays] = useState('0')
    const [saleDate, setSaleDate] = useState(todayDate())
    const [dispatchNow, setDispatchNow] = useState(false)
    const [actualDispatchedMeters, setActualDispatchedMeters] = useState('')
    const [dispatchDate, setDispatchDate] = useState(todayDate())
    const [transportName, setTransportName] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [challanNumber, setChallanNumber] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (!open) return

        setStep(1)
        setLoadingData(true)
        setSourceId(defaultStockLotId || '')
        setPartyName('')
        setPartyPhone('')
        setPartyCity('')
        setPartyGstin('')
        setSoldMeters('')
        setSoldTakas('')
        setSaleRate('')
        setCreditDays('0')
        setSaleDate(todayDate())
        setDispatchNow(false)
        setActualDispatchedMeters('')
        setDispatchDate(todayDate())
        setTransportName('')
        setVehicleNumber('')
        setChallanNumber('')
        setNotes('')

        getSellAndDispatchOptions().then((data) => {
            const loadedOrders = data.orders as OrderOption[]
            const loadedLots = data.lots as LotOption[]
            setOrders(loadedOrders)
            setLots(loadedLots)

            const defaultLot = loadedLots.find((lot) => lot.stock_lot_id === defaultStockLotId)
            const defaultOrder = loadedOrders.find((order) => order.id === (defaultOrderId || defaultLot?.order_id || ''))
            if (defaultLot) {
                setSourceId(defaultLot.stock_lot_id)
                setSoldMeters(String(Number(defaultLot.available_meters || 0).toFixed(2)))
                setActualDispatchedMeters(String(Number(defaultLot.available_meters || 0).toFixed(2)))
            }
            if (defaultOrder) {
                setPartyName(defaultOrder.party_name)
            }
            setLoadingData(false)
        })
    }, [open, defaultOrderId, defaultStockLotId])

    const selectedLot = lots.find((lot) => lot.stock_lot_id === sourceId)
    const selectedOrder = selectedLot?.order_id ? orders.find((order) => order.id === selectedLot.order_id) : null

    useEffect(() => {
        const lot = lots.find((l) => l.stock_lot_id === sourceId)
        if (!lot) return
        const order = lot.order_id ? orders.find((o) => o.id === lot.order_id) : null

        setSoldMeters(String(Number(lot.available_meters || 0).toFixed(2)))
        setActualDispatchedMeters(String(Number(lot.available_meters || 0).toFixed(2)))
        setPartyName(order?.party_name || '')
    }, [sourceId, lots, orders])

    const soldMetersNum = Number(soldMeters) || 0
    const soldTakasNum = Number(soldTakas) || 0
    const hasSoldTakas = soldTakas.trim().length > 0
    const saleRateNum = Number(saleRate) || 0
    const creditDaysNum = Math.max(0, Math.trunc(Number(creditDays) || 0))
    const dispatchMetersNum = dispatchNow ? (Number(actualDispatchedMeters) || 0) : 0
    const totalSaleValue = soldMetersNum * saleRateNum
    const costPerMeter = Number(selectedLot?.cost_per_meter || 0)
    const grossCost = soldMetersNum * costPerMeter
    const grossProfit = totalSaleValue - grossCost
    const grossMargin = totalSaleValue > 0 ? (grossProfit / totalSaleValue) * 100 : 0
    const dueDate = useMemo(() => addDays(saleDate, creditDaysNum), [saleDate, creditDaysNum])
    const dispatchStatus = !dispatchNow
        ? 'Not dispatched'
        : dispatchMetersNum + 0.01 >= soldMetersNum
            ? 'Dispatched'
            : 'Partially dispatched'
    const pendingDispatch = Math.max(soldMetersNum - dispatchMetersNum, 0)

    const sourceType = selectedLot?.source_type === 'market_run'
        ? 'market_run'
        : selectedLot?.source_type === 'order'
            ? 'order'
            : 'stock_lot'

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await createPartyStockSaleAndOptionalDispatch({
                sourceType,
                sourceId,
                partyName,
                partyPhone,
                partyCity,
                partyGstin,
                soldMeters: soldMetersNum,
                soldTakas: soldTakasNum || null,
                saleRatePerMeter: saleRateNum,
                creditDays: creditDaysNum,
                saleDate,
                dispatchNow,
                actualDispatchedMeters: dispatchNow ? dispatchMetersNum : null,
                dispatchDate: dispatchNow ? dispatchDate : null,
                transportName,
                vehicleNumber,
                challanNumber,
                notes,
            })

            if (result.success) {
                toast.success(dispatchNow ? 'Stock sale and dispatch saved' : 'Stock sale saved')
                onOpenChange(false)
                if (result.dispatchId) onSuccess?.(result.dispatchId, result.trackingUrl)
            } else {
                const notify = result.recoverable ? toast.warning : toast.error
                notify(result.message, { duration: 7000 })
                if (result.recoverable) onOpenChange(false)
            }
        })
    }

    const renderMetric = (label: string, value: string, accent = false) => (
        <div className={cn('flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm', accent ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-50 text-slate-700')}>
            <span>{label}</span>
            <span className="font-bold text-slate-950">{value}</span>
        </div>
    )

    const renderStep = () => {
        if (loadingData) {
            return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
        }

        if (step === 1) {
            return (
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Source stock</Label>
                        <select
                            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm lg:h-9"
                            value={sourceId}
                            onChange={(event) => setSourceId(event.target.value)}
                        >
                            <option value="">Select godown or expected stock</option>
                            {lots.map((lot) => (
                                <option key={lot.stock_lot_id} value={lot.stock_lot_id}>
                                    {lot.quality_label} · {lot.godown} · {Number(lot.available_meters).toFixed(0)}m · approx {Number(lot.available_taka_count).toFixed(2)} {lot.unit_label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedLot && (
                        <div className="rounded-lg border border-slate-200 p-3 text-sm">
                            <div className="font-bold text-slate-950">{selectedLot.quality_label}</div>
                            <div className="mt-1 text-slate-500">
                                {selectedLot.godown} · available for sale {Number(selectedLot.available_meters).toFixed(2)}m · approx {Number(selectedLot.available_taka_count).toFixed(2)} {selectedLot.unit_label}
                            </div>
                            <div className="mt-2 text-xs font-semibold text-slate-600">
                                Cost snapshot: {money(costPerMeter)} per meter
                                {selectedOrder ? ` · linked order party: ${selectedOrder.party_name}` : ''}
                            </div>
                        </div>
                    )}
                </div>
            )
        }

        if (step === 2) {
            return (
                <div className="space-y-4 py-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Party name</Label>
                            <Input value={partyName} onChange={(event) => setPartyName(event.target.value)} className="h-11 lg:h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phone</Label>
                            <Input value={partyPhone} onChange={(event) => setPartyPhone(event.target.value)} className="h-11 lg:h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>City</Label>
                            <Input value={partyCity} onChange={(event) => setPartyCity(event.target.value)} className="h-11 lg:h-9" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>GSTIN</Label>
                            <Input value={partyGstin} onChange={(event) => setPartyGstin(event.target.value.toUpperCase())} className="h-11 lg:h-9" />
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Sold meters</Label>
                            <Input type="number" min="0" step="0.01" value={soldMeters} onChange={(event) => setSoldMeters(event.target.value)} className="h-11 lg:h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sold takas <span className="font-normal text-slate-400">(optional display count)</span></Label>
                            <Input type="number" min="0" step="0.01" value={soldTakas} onChange={(event) => setSoldTakas(event.target.value)} placeholder="Leave blank if unknown" className="h-11 lg:h-9" />
                            <p className="text-[11px] font-semibold text-slate-500">Meters reserve stock. Taka count is only adjusted when entered.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sale rate per meter</Label>
                            <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input type="number" min="0" step="0.01" value={saleRate} onChange={(event) => setSaleRate(event.target.value)} className="h-11 pl-9 lg:h-9" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Credit days</Label>
                            <Input type="number" min="0" step="1" value={creditDays} onChange={(event) => setCreditDays(event.target.value)} className="h-11 lg:h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sale date</Label>
                            <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="h-11 lg:h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Due date basis</Label>
                            <div className="flex h-11 items-center rounded-md border border-dashed border-indigo-200 bg-indigo-50/50 px-3 text-xs font-semibold text-indigo-700 lg:h-9">
                                Starts from dispatch date + credit days
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        if (step === 3) {
            return (
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Notes / References</Label>
                        <Input value={notes} onChange={(event) => setNotes(event.target.value)} className="h-11 lg:h-9" placeholder="Optional notes about this sale" />
                    </div>
                </div>
            )
        }

        return (
            <div className="space-y-4 py-2">
                <div className="grid gap-2">
                    {renderMetric('Party', partyName || 'Missing')}
                    {renderMetric('Sold meters', `${soldMetersNum.toFixed(2)} m`)}
                    {renderMetric('Sale rate', `${money(saleRateNum)} / m`)}
                    {renderMetric('Total sale value', money(totalSaleValue), true)}
                    {renderMetric('Cost per meter', `${money(costPerMeter)} / m`)}
                    {renderMetric('Gross cost', money(grossCost))}
                    {renderMetric('Booked gross profit', money(grossProfit), true)}
                    {renderMetric('Gross margin', `${grossMargin.toFixed(1)}%`)}
                    {renderMetric('Due date', 'Starts from dispatch date')}
                    {renderMetric('Dispatch status', 'Not dispatched')}
                    {renderMetric('Sold pending dispatch', `${soldMetersNum.toFixed(2)} m`)}
                </div>
            </div>
        )
    }

    const canContinue = step === 1
        ? Boolean(sourceId)
        : step === 2
            ? Boolean(partyName.trim()) && soldMetersNum > 0 && saleRateNum > 0 && creditDaysNum >= 0 && Boolean(selectedLot) && soldMetersNum <= Number(selectedLot?.available_meters || 0) + 0.01 && (!hasSoldTakas || (soldTakasNum > 0 && soldTakasNum <= Number(selectedLot?.available_taka_count || 0) + 0.01))
            : step === 3
                ? !dispatchNow || (dispatchMetersNum > 0 && dispatchMetersNum <= soldMetersNum)
                : true

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-indigo-600" />
                        Sell Stock
                    </DialogTitle>
                    <DialogDescription>
                        Sell stock to a named party. The sale will be saved and can be dispatched later from the Dispatches page.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 grid grid-cols-4 gap-2">
                    {[
                        { num: 1, label: 'Stock', icon: Package },
                        { num: 2, label: 'Party', icon: UserRound },
                        { num: 3, label: 'Notes', icon: Send },
                        { num: 4, label: 'Preview', icon: CalendarDays },
                    ].map((item) => {
                        const Icon = item.icon
                        return (
                            <div key={item.num} className={cn('flex flex-col items-center gap-1 rounded-md py-2 text-xs font-bold', step >= item.num ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-400')}>
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </div>
                        )
                    })}
                </div>

                {renderStep()}

                <DialogFooter className="gap-2 sm:justify-between">
                    <Button variant="ghost" className="h-11 text-sm lg:h-9" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} disabled={pending}>
                        {step === 1 ? 'Cancel' : 'Back'}
                    </Button>
                    {step < 4 ? (
                        <Button className="h-11 gap-2 bg-indigo-600 text-white hover:bg-indigo-700 lg:h-9" onClick={() => setStep(step + 1)} disabled={!canContinue}>
                            Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={pending || !canContinue} className="h-11 gap-2 bg-indigo-600 font-bold text-white hover:bg-indigo-500 lg:h-9">
                            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {pending ? 'Saving...' : dispatchNow ? 'Sell & Dispatch' : 'Save Sale Only'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
