'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { CalendarDays, Check, ChevronRight, IndianRupee, Loader2, Package, Plus, Send, UserRound } from 'lucide-react'
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
import { getSuratTodayString } from '@/lib/time'
import Decimal from 'decimal.js'

export type SellAndDispatchDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultOrderId?: string
    defaultStockLotId?: string
    onSuccess?: (dispatchId: string | null, trackingUrl: string | null) => void
}

type OrderOption = { id: string; party_name: string; quality_label: string | null; status: string; total_target_meters: number }
type PartyOption = {
    id: string
    name: string
    phone: string | null
    gstin: string | null
    state: string | null
    default_credit_days: number | null
}
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

function estimateSoldTakas(meters: number, lot: LotOption) {
    if (lot.meters_per_taka <= 0) return ''

    const estimatedTakas = new Decimal(meters)
        .dividedBy(new Decimal(lot.meters_per_taka))
        .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
        .toNumber()
    return String(estimatedTakas)
}

function todayDate() {
    return getSuratTodayString()
}

function addDateOnlyDays(date: string, days: number) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!match) return ''
    const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
}

function money(value: number) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function normalizePartyName(name: string | null | undefined) {
    return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function exactPartyMatchesIn(name: string, candidates: PartyOption[]) {
    const normalized = normalizePartyName(name)
    if (!normalized) return []
    return candidates.filter((party) => normalizePartyName(party.name) === normalized)
}

function findUniquePartyByNameIn(name: string, candidates: PartyOption[]) {
    const matches = exactPartyMatchesIn(name, candidates)
    return matches.length === 1 ? matches[0] : null
}

function partyDetailLabel(party: PartyOption) {
    const parts = [
        party.phone,
        party.gstin,
        party.state,
        `${party.default_credit_days ?? 0}d credit`,
    ].filter(Boolean)
    return parts.join(' · ')
}

function createClientIdempotencyKey(prefix: string) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}:${crypto.randomUUID()}`
    }
    return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
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
    const [parties, setParties] = useState<PartyOption[]>([])

    const [sourceId, setSourceId] = useState(defaultStockLotId || '')
    const [partyId, setPartyId] = useState('')
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
    const dispatchDateRef = useRef<HTMLInputElement>(null)
    const [transportName, setTransportName] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [challanNumber, setChallanNumber] = useState('')
    const [notes, setNotes] = useState('')
    const [idempotencyKey, setIdempotencyKey] = useState(() => createClientIdempotencyKey('stock-sale'))

    const findUniquePartyByName = useCallback((name: string) => findUniquePartyByNameIn(name, parties), [parties])

    const applyPartyToForm = useCallback((party: PartyOption) => {
        setPartyId(party.id)
        setPartyName(party.name)
        setPartyPhone(party.phone ?? '')
        setPartyGstin(party.gstin ?? '')
        setCreditDays(String(party.default_credit_days ?? 0))
    }, [])

    useEffect(() => {
        if (!open) return

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep(1)
        setLoadingData(true)
        setSourceId(defaultStockLotId || '')
        setPartyId('')
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
        setIdempotencyKey(createClientIdempotencyKey('stock-sale'))

        getSellAndDispatchOptions().then((data) => {
            const loadedOrders = data.orders as OrderOption[]
            const loadedLots = data.lots as LotOption[]
            const loadedParties = data.parties as PartyOption[]
            setOrders(loadedOrders)
            setLots(loadedLots)
            setParties(loadedParties)

            const defaultLot = loadedLots.find((lot) => lot.stock_lot_id === defaultStockLotId)
            const defaultOrder = loadedOrders.find((order) => order.id === (defaultOrderId || defaultLot?.order_id || ''))
            if (defaultLot) {
                setSourceId(defaultLot.stock_lot_id)
                setSoldMeters(String(Number(defaultLot.available_meters || 0).toFixed(2)))
                setActualDispatchedMeters(String(Number(defaultLot.available_meters || 0).toFixed(2)))
            }
            if (defaultOrder) {
                const matchedParty = findUniquePartyByNameIn(defaultOrder.party_name, loadedParties)
                if (matchedParty) {
                    applyPartyToForm(matchedParty)
                } else {
                    setPartyName(defaultOrder.party_name)
                }
            }
            setLoadingData(false)
        })
    }, [open, defaultOrderId, defaultStockLotId, applyPartyToForm])

    const selectedLot = lots.find((lot) => lot.stock_lot_id === sourceId)
    const selectedOrder = selectedLot?.order_id ? orders.find((order) => order.id === selectedLot.order_id) : null

    useEffect(() => {
        const lot = lots.find((l) => l.stock_lot_id === sourceId)
        if (!lot) return
        const order = lot.order_id ? orders.find((o) => o.id === lot.order_id) : null

        const metersVal = Number(lot.available_meters || 0).toFixed(2)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSoldMeters(String(metersVal))
        setActualDispatchedMeters(String(metersVal))
        setSoldTakas(estimateSoldTakas(Number(metersVal), lot))
        const matchedParty = order?.party_name ? findUniquePartyByName(order.party_name) : null
        if (matchedParty) {
            applyPartyToForm(matchedParty)
        } else {
            setPartyId('')
            setPartyName(order?.party_name || '')
        }
    }, [sourceId, lots, orders, parties, findUniquePartyByName, applyPartyToForm])

    const soldMetersNum = Number(soldMeters) || 0
    const soldTakasNum = Number(soldTakas) || 0
    const hasSoldTakas = soldTakas.trim().length > 0
    const saleRateNum = Number(saleRate) || 0
    const creditDaysNum = Math.max(0, Math.trunc(Number(creditDays) || 0))
    const dispatchMetersNum = dispatchNow ? (Number(actualDispatchedMeters) || 0) : 0
    const projectedDueDate = dispatchNow ? addDateOnlyDays(dispatchDate, creditDaysNum) : ''
    const totalSaleValue = soldMetersNum * saleRateNum
    const costPerMeter = Number(selectedLot?.cost_per_meter || 0)
    const grossCost = soldMetersNum * costPerMeter
    const grossProfit = totalSaleValue - grossCost
    const grossMargin = totalSaleValue > 0 ? (grossProfit / totalSaleValue) * 100 : 0
    const sourceType = selectedLot?.source_type === 'market_run'
        ? 'market_run'
        : selectedLot?.source_type === 'order'
            ? 'order'
            : 'stock_lot'

    const partyNeedle = normalizePartyName(partyName)
    const selectedParty = partyId ? parties.find((party) => party.id === partyId) ?? null : null
    const exactPartyMatches = exactPartyMatchesIn(partyName, parties)
    const willAutoLinkSingleParty = !selectedParty && exactPartyMatches.length === 1 && !partyPhone.trim() && !partyGstin.trim()
    const hasAmbiguousPartyName = !selectedParty && exactPartyMatches.length > 1 && !partyPhone.trim() && !partyGstin.trim()
    const partySuggestions = partyNeedle
        ? parties
            .filter((party) => normalizePartyName(party.name).includes(partyNeedle))
            .slice(0, 5)
        : parties.slice(0, 5)

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await createPartyStockSaleAndOptionalDispatch({
                sourceType,
                sourceId,
                partyId: partyId || null,
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
                idempotencyKey,
            })

            if (result.success) {
                toast.success(dispatchNow ? 'Stock sale and dispatch saved' : 'Stock sale saved')
                onOpenChange(false)
                onSuccess?.(result.dispatchId ?? null, result.trackingUrl ?? null)
            } else {
                const notify = result.recoverable ? toast.warning : toast.error
                notify(result.message, { duration: 7000 })
                if (result.recoverable) onOpenChange(false)
            }
        })
    }

    const advanceStep = () => {
        if (step === 3 && dispatchNow) {
            const renderedDispatchDate = document.querySelector<HTMLInputElement>('[data-testid="sell-dispatch-date"]')?.value
            setDispatchDate(renderedDispatchDate || dispatchDateRef.current?.value || dispatchDate)
        }
        setStep(step + 1)
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
                            <Label>Party</Label>
                            <Input
                                value={partyName}
                                onChange={(event) => {
                                    const nextName = event.target.value
                                    setPartyName(nextName)
                                    setPartyId('')
                                }}
                                placeholder="Search existing party or type new name"
                                className="h-11 lg:h-9"
                            />
                            {selectedParty ? (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                                    <Check className="h-3.5 w-3.5" />
                                    <span className="truncate">Saved party</span>
                                    <span className="text-emerald-700">· {partyDetailLabel(selectedParty)}</span>
                                </div>
                            ) : hasAmbiguousPartyName ? (
                                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                    <UserRound className="h-3.5 w-3.5" />
                                    <span>Multiple saved parties share this name. Select one below, or add phone/GSTIN for a new party.</span>
                                </div>
                            ) : willAutoLinkSingleParty ? (
                                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Will link saved party: {partyDetailLabel(exactPartyMatches[0])}</span>
                                </div>
                            ) : partyName.trim() ? (
                                <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>New party will be saved with this sale</span>
                                </div>
                            ) : null}
                            {!selectedParty && partySuggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {partySuggestions.map((party) => (
                                        <button
                                            key={party.id}
                                            type="button"
                                            onClick={() => applyPartyToForm(party)}
                                            className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                        >
                                            <span className="block truncate">{party.name}</span>
                                            <span className="block truncate font-medium text-slate-500">{partyDetailLabel(party)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
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
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Sold meters</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={soldMeters}
                                onChange={(event) => {
                                    const val = event.target.value
                                    setSoldMeters(val)
                                    if (selectedLot) {
                                        setSoldTakas(estimateSoldTakas(Number(val) || 0, selectedLot))
                                    }
                                }}
                                className="h-11 lg:h-9"
                            />
                        </div>
                        <div className="hidden">
                            <Label>Number of Taka Sold <span className="font-normal text-slate-400">(optional count)</span></Label>
                            <Input type="number" min="0" step="0.01" value={soldTakas} onChange={(event) => setSoldTakas(event.target.value)} placeholder="Leave blank if unknown" className="h-11 lg:h-9" />
                            <p className="text-[11px] font-semibold text-slate-500">Metres Sold reserves stock. Taka Count is adjusted only when entered; the two quantities are not interchangeable.</p>
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
                        <input
                            type="checkbox"
                            checked={dispatchNow}
                            onChange={(event) => setDispatchNow(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span>
                            <span className="block text-sm font-bold text-slate-950">Dispatch now</span>
                            <span className="mt-1 block text-xs font-medium text-slate-600">Create the dispatch in the same operation. Leave unchecked to keep the sale under Sold Pending Dispatch.</span>
                        </span>
                    </label>
                    {dispatchNow && (
                        <div className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Dispatched meters</Label>
                                <Input type="number" min="0.01" step="0.01" value={actualDispatchedMeters} onChange={(event) => setActualDispatchedMeters(event.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Dispatch date</Label>
                                <Input
                                    ref={dispatchDateRef}
                                    data-testid="sell-dispatch-date"
                                    type="date"
                                    min={saleDate}
                                    value={dispatchDate}
                                    onInput={(event) => setDispatchDate((event.target as HTMLInputElement).value)}
                                    onChange={(event) => setDispatchDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label>Transport name</Label>
                                <Input value={transportName} onChange={(event) => setTransportName(event.target.value)} placeholder="Optional" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Vehicle number</Label>
                                <Input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())} placeholder="Optional" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Challan number</Label>
                                <Input value={challanNumber} onChange={(event) => setChallanNumber(event.target.value)} placeholder="Optional" />
                            </div>
                            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 sm:col-span-2">
                                Receivable due date: {projectedDueDate || 'select a valid dispatch date'}
                            </div>
                        </div>
                    )}
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
                    {renderMetric('Due date', dispatchNow ? projectedDueDate || 'Invalid dispatch date' : 'Starts from dispatch date')}
                    {renderMetric('Dispatch status', dispatchNow ? (dispatchMetersNum < soldMetersNum ? 'Partially dispatched' : 'Dispatched') : 'Not dispatched')}
                    {renderMetric('Sold pending dispatch', `${Math.max(0, soldMetersNum - dispatchMetersNum).toFixed(2)} m`)}
                </div>
            </div>
        )
    }

    const canContinue = step === 1
        ? Boolean(sourceId)
        : step === 2
            ? Boolean(partyName.trim()) && !hasAmbiguousPartyName && soldMetersNum > 0 && saleRateNum > 0 && creditDaysNum >= 0 && Boolean(selectedLot) && soldMetersNum <= Number(selectedLot?.available_meters || 0) + 0.01 && (!hasSoldTakas || (soldTakasNum > 0 && soldTakasNum <= Number(selectedLot?.available_taka_count || 0) + 0.001))
            : step === 3
                ? !dispatchNow || (Boolean(dispatchDate) && dispatchDate >= saleDate && dispatchMetersNum > 0 && dispatchMetersNum <= soldMetersNum)
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
                        <Button className="h-11 gap-2 bg-indigo-600 text-white hover:bg-indigo-700 lg:h-9" onClick={advanceStep} disabled={!canContinue}>
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
