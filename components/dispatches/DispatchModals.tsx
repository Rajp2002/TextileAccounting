'use client'

import { useState, useTransition } from 'react'
import {
    Send,
    Loader2,
    QrCode,
    Copy,
    AlertTriangle,
    ExternalLink,
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
import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'
import { createDispatch, type DispatchRow, type AvailableFabricPackage } from '@/app/(dashboard)/owner/orders/actions'

/**
 * Modal for creating a new dispatch batch.
 */
export function CreateDispatchModal({
    orderId,
    availablePackages,
    onClose,
    onCreated,
}: {
    orderId: string
    availablePackages: AvailableFabricPackage[]
    onClose: () => void
    onCreated: (dispatch: DispatchRow, trackingToken: string, partyName: string, orgName: string) => void
}) {
    const [notes, setNotes] = useState('')
    const [ewayNumber, setEwayNumber] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [transporterName, setTransporterName] = useState('')
    const [transporterId, setTransporterId] = useState('')
    const [distanceKm, setDistanceKm] = useState('')
    const [selected, setSelected] = useState<string[]>(availablePackages.map((pkg) => pkg.id))
    const [pending, startTransition] = useTransition()

    // ── Configurable Batch Dispatch Date, Meters & Takas State ──
    const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [customMeters, setCustomMeters] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {}
        availablePackages.forEach((pkg) => {
            initial[pkg.id] = String(Number(pkg.metres ?? 0).toFixed(2))
        })
        return initial
    })
    const [customTakas, setCustomTakas] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {}
        availablePackages.forEach((pkg) => {
            initial[pkg.id] = String(Number(pkg.units_count ?? 0))
        })
        return initial
    })

    const selectedPackages = availablePackages.filter((pkg) => selected.includes(pkg.id))
    
    // Total meters and taxable values dynamically calculated based on inputs
    const totalMetres = selectedPackages
        .reduce((sum, pkg) => sum + (Number(customMeters[pkg.id]) || 0), 0)
    
    const taxableValue = selectedPackages
        .reduce((sum, pkg) => {
            const meters = Number(customMeters[pkg.id]) || 0
            const rate = Number(pkg.price_per_meter ?? 0)
            return sum + (meters * rate)
        }, 0)

    const estimatedGst = taxableValue * 0.05
    const estimatedConsignmentValue = taxableValue + estimatedGst
    const ewayLikelyRequired = estimatedConsignmentValue > 50000
    const parsedDistance = distanceKm.trim() ? Number(distanceKm) : null

    // Validation for enabling/disabling the main dispatch action
    const isAnyInputInvalid = selectedPackages.some((pkg) => {
        const m = Number(customMeters[pkg.id]) || 0
        const t = Number(customTakas[pkg.id]) || 0
        return m <= 0 || m > Number(pkg.metres) + 0.01 || t <= 0 || t > Number(pkg.units_count)
    })

    const handleSubmit = () => {
        if (selected.length === 0) {
            toast.error('Select at least one sold stock entry')
            return
        }
        if (parsedDistance !== null && (!Number.isFinite(parsedDistance) || parsedDistance < 0)) {
            toast.error('Enter a valid distance')
            return
        }

        // Additional validation
        for (const pkg of selectedPackages) {
            const m = Number(customMeters[pkg.id]) || 0
            const t = Number(customTakas[pkg.id]) || 0
            if (m <= 0) {
                toast.error(`Enter a valid meters value for package ${pkg.package_no}`)
                return
            }
            if (m > Number(pkg.metres) + 0.01) {
                toast.error(`Meters to dispatch for ${pkg.package_no} cannot exceed available ${Number(pkg.metres).toFixed(2)} m`)
                return
            }
            if (t <= 0) {
                toast.error(`Enter a valid unit count for package ${pkg.package_no}`)
                return
            }
            if (t > Number(pkg.units_count)) {
                toast.error(`Units to dispatch for ${pkg.package_no} cannot exceed available ${pkg.units_count}`)
                return
            }
        }

        const dispatchMetersObj: Record<string, number> = {}
        const dispatchTakasObj: Record<string, number> = {}
        selected.forEach((id) => {
            dispatchMetersObj[id] = Number(customMeters[id])
            dispatchTakasObj[id] = Number(customTakas[id])
        })

        startTransition(async () => {
            const res = await createDispatch(orderId, selected, notes || undefined, {
                eway_bill_number: ewayNumber,
                vehicle_number: vehicleNumber,
                transporter_name: transporterName,
                transporter_id: transporterId,
                approximate_distance_km: parsedDistance,
                eway_bill_generated_at: ewayNumber.trim() ? new Date().toISOString() : '',
            }, dispatchMetersObj, dispatchTakasObj, dispatchDate)
            
            if ('error' in res) {
                toast.error(res.error)
            } else {
                toast.success(`Dispatch #${res.dispatch_number} created — downloading invoice…`)
                onCreated(res.dispatch, res.tracking_token, res.party_name, res.org_name)
            }
        })
    }

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[95vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Send className="h-5 w-5 text-indigo-600 animate-pulse" /> Create Dispatch Batch
                    </DialogTitle>
                    <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">
                        Select the sold takas you are sending to the trader. Customize quantities to support partial/batch dispatches.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
                    {/* Dispatch Date Input */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Dispatch Date</Label>
                        <Input
                            type="date"
                            value={dispatchDate}
                            onChange={(e) => setDispatchDate(e.target.value)}
                            className="h-11 border-slate-200 text-slate-900 bg-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Sold Stock to Dispatch</Label>
                        <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                            {availablePackages.map((pkg) => {
                                const checked = selected.includes(pkg.id)
                                const maxMetres = Number(pkg.metres)
                                const maxUnits = Number(pkg.units_count)
                                
                                const metersVal = customMeters[pkg.id] ?? ''
                                const unitsVal = customTakas[pkg.id] ?? ''
                                
                                const metersNum = Number(metersVal) || 0
                                const unitsNum = Number(unitsVal) || 0
                                
                                const isMetersInvalid = checked && (metersNum <= 0 || metersNum > maxMetres + 0.01)
                                const isUnitsInvalid = checked && (unitsNum <= 0 || unitsNum > maxUnits)

                                return (
                                    <div
                                        key={pkg.id}
                                        className={cn(
                                            'rounded-xl border p-4 transition-all space-y-3 bg-white shadow-sm border-slate-200',
                                            checked && 'border-indigo-300 bg-indigo-50/20'
                                        )}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id={`pkg-${pkg.id}`}
                                                    checked={checked}
                                                    onChange={() => setSelected((prev) => checked ? prev.filter((id) => id !== pkg.id) : [...prev, pkg.id])}
                                                    className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <label htmlFor={`pkg-${pkg.id}`} className="cursor-pointer select-none">
                                                    <p className="text-sm font-bold text-slate-900 leading-tight">{pkg.package_no}</p>
                                                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                                        Original: {maxUnits} unit{maxUnits !== 1 ? 's' : ''} · {pkg.location}
                                                    </p>
                                                </label>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono text-sm font-black text-slate-900">{maxMetres.toFixed(2)} m</p>
                                                <p className="text-[10px] font-bold text-slate-400">Available</p>
                                            </div>
                                        </div>

                                        {checked && (
                                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-indigo-100/50">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Meters to Send</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={metersVal}
                                                        onChange={(e) => setCustomMeters(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                        className={cn(
                                                            "h-9 text-xs border-slate-200 text-slate-900 bg-white",
                                                            isMetersInvalid && "border-red-400 focus-visible:ring-red-400 bg-red-50/10"
                                                        )}
                                                    />
                                                    {isMetersInvalid && (
                                                        <p className="text-[9px] text-red-500 font-semibold mt-0.5">Max: {maxMetres.toFixed(2)} m</p>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Units to Send</Label>
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        min="0"
                                                        value={unitsVal}
                                                        onChange={(e) => setCustomTakas(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                        className={cn(
                                                            "h-9 text-xs border-slate-200 text-slate-900 bg-white",
                                                            isUnitsInvalid && "border-red-400 focus-visible:ring-red-400 bg-red-50/10"
                                                        )}
                                                    />
                                                    {isUnitsInvalid && (
                                                        <p className="text-[9px] text-red-500 font-semibold mt-0.5">Max: {maxUnits}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                            {selected.length} sale{selected.length !== 1 ? 's' : ''} selected · {totalMetres.toFixed(2)} m total
                        </p>
                    </div>

                    <div className={cn(
                        'rounded-xl border px-3 py-2.5 text-[11px] transition-all',
                        ewayLikelyRequired
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-100 bg-emerald-50 text-emerald-800'
                    )}>
                        <div className="flex items-start gap-2">
                            <AlertTriangle className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', ewayLikelyRequired ? 'text-amber-600' : 'text-emerald-600')} />
                            <div className="space-y-1">
                                <p className="font-bold">
                                    {ewayLikelyRequired ? 'E-way bill may be required' : 'E-way bill likely not required by value'}
                                </p>
                                <p className="leading-relaxed">
                                    Estimated consignment value is Rs. {estimatedConsignmentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.
                                    E-way bill is generally needed above Rs. 50,000 before goods move. Check local/state exemptions.
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

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">E-way Bill No.</Label>
                            <Input
                                value={ewayNumber}
                                onChange={e => setEwayNumber(e.target.value)}
                                placeholder="Optional"
                                className="text-slate-900 border-slate-200 bg-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Vehicle No.</Label>
                            <Input
                                value={vehicleNumber}
                                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                                placeholder="GJ01AB1234"
                                className="text-slate-900 border-slate-200 bg-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Transporter</Label>
                            <Input
                                value={transporterName}
                                onChange={e => setTransporterName(e.target.value)}
                                placeholder="Transport name"
                                className="text-slate-900 border-slate-200 bg-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Transporter ID</Label>
                            <Input
                                value={transporterId}
                                onChange={e => setTransporterId(e.target.value.toUpperCase())}
                                placeholder="Optional"
                                className="text-slate-900 border-slate-200 bg-white"
                            />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs font-semibold text-slate-700">Approx. Distance (km)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="1"
                                value={distanceKm}
                                onChange={e => setDistanceKm(e.target.value)}
                                placeholder="Used for EWB validity planning"
                                className="text-slate-900 border-slate-200 bg-white"
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
                            placeholder="Invoice #, truck number, e-way bill, etc."
                            className="text-slate-900 border-slate-200 bg-white"
                        />
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] text-indigo-700">
                        A Tax Invoice cum Delivery Challan PDF with a scannable QR code will download automatically after creating this dispatch.
                    </div>
                </div>

                <DialogFooter className="shrink-0 gap-2 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={onClose} disabled={pending} className="h-10 px-4 rounded-xl">Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={pending || selected.length === 0 || isAnyInputInvalid || !dispatchDate}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 h-10 px-5 rounded-xl transition-all shadow-md active:scale-98"
                    >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {pending ? 'Creating…' : 'Create & Download Invoice'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/**
 * Share Modal — QR Code + Copy Link for WhatsApp sharing.
 */
export function ShareTrackingModal({
    trackingUrl,
    trackingToken,
    onClose,
}: {
    trackingUrl: string
    trackingToken: string
    onClose: () => void
}) {
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(trackingUrl)
            toast.success('Link copied — paste into WhatsApp!')
        } catch {
            toast.error('Copy failed — please copy the URL manually')
        }
    }

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-indigo-600" /> Share Tracking Link
                    </DialogTitle>
                    <DialogDescription>
                        Print this QR on the invoice/challan, or paste the link into WhatsApp.
                        No login required for your Trader.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                    {/* QR Code */}
                    <div className="flex justify-center">
                        <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm">
                            <QRCodeSVG
                                value={trackingUrl}
                                size={200}
                                fgColor="#1A5C38"
                                bgColor="#FFFFFF"
                                level="M"
                            />
                        </div>
                    </div>

                    {/* URL Display */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tracking URL</p>
                        <p className="text-xs font-mono text-slate-700 break-all leading-relaxed">{trackingUrl}</p>
                        <p className="mt-1 text-[10px] font-mono text-slate-400">Token {trackingToken}</p>
                    </div>

                    {/* Copy button */}
                    <Button
                        onClick={handleCopy}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold gap-2"
                    >
                        <Copy className="h-4 w-4" />
                        Copy link for WhatsApp
                    </Button>

                    <p className="text-[10px] text-center text-slate-400">
                        Your Trader can scan the QR or open the link — no app or login needed.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
