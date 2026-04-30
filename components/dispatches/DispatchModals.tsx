'use client'

import { useState, useTransition } from 'react'
import {
    Send,
    Loader2,
    QrCode,
    Copy,
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
    const [selected, setSelected] = useState<string[]>(availablePackages.map((pkg) => pkg.id))
    const [pending, startTransition] = useTransition()

    const totalMetres = availablePackages
        .filter((pkg) => selected.includes(pkg.id))
        .reduce((sum, pkg) => sum + Number(pkg.metres ?? 0), 0)

    const handleSubmit = () => {
        if (selected.length === 0) {
            toast.error('Select at least one package')
            return
        }
        startTransition(async () => {
            const res = await createDispatch(orderId, selected, notes || undefined)
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
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-indigo-600" /> Create Dispatch Batch
                    </DialogTitle>
                    <DialogDescription>
                        Select the exact packages you are sending to the trader.
                        A Tax Invoice cum Delivery Challan PDF with a tracking QR code will auto-download.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Packages to Dispatch</Label>
                        <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                            {availablePackages.map((pkg) => {
                                const checked = selected.includes(pkg.id)
                                return (
                                    <button
                                        key={pkg.id}
                                        type="button"
                                        onClick={() => setSelected((prev) => checked ? prev.filter((id) => id !== pkg.id) : [...prev, pkg.id])}
                                        className={cn(
                                            'flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left transition-all',
                                            checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                                        )}
                                    >
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{pkg.package_no}</p>
                                            <p className="text-[11px] font-semibold text-slate-500">
                                                {pkg.package_type} · {pkg.units_count} unit{pkg.units_count !== 1 ? 's' : ''} · {pkg.location}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-black text-slate-900">{Number(pkg.metres).toFixed(2)} m</p>
                                            <p className="text-[10px] font-bold text-slate-400">Grade {pkg.grade}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                            {selected.length} package{selected.length !== 1 ? 's' : ''} selected · {totalMetres.toFixed(2)} m total
                        </p>
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
                            className="text-slate-900 border-slate-200"
                        />
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] text-indigo-700">
                        A Tax Invoice cum Delivery Challan PDF with a scannable QR code will download automatically after creating this dispatch.
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={pending || selected.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2"
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
