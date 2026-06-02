import { Dispatch, SetStateAction, useMemo } from 'react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LedgerParty } from '../actions'
import { InvoiceFormType } from '../types'
import { shortMoney, toNumber } from '../utils'
import { Field } from './Field'

type InvoiceOrderOption = {
    id: string
    party_name: string
    quality_label: string | null
    total_target_meters: number
}

interface InvoiceFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoiceForm: InvoiceFormType
    setInvoiceForm: Dispatch<SetStateAction<InvoiceFormType>>
    activeParties: LedgerParty[]
    orders: InvoiceOrderOption[]
    isPending: boolean
    onSubmit: () => void
    onPartyChange: (partyId: string) => void
    onDateChange: (date: string) => void
}

export function InvoiceFormModal({
    open,
    onOpenChange,
    invoiceForm,
    setInvoiceForm,
    activeParties,
    orders,
    isPending,
    onSubmit,
    onPartyChange,
    onDateChange
}: InvoiceFormModalProps) {
    const invoicePreview = useMemo(() => {
        const gross = toNumber(invoiceForm.total_meters) * toNumber(invoiceForm.rate_per_m)
        const gst = gross * (toNumber(invoiceForm.gst_percent) / 100)
        return { gross, gst, net: gross + gst }
    }, [invoiceForm.gst_percent, invoiceForm.rate_per_m, invoiceForm.total_meters])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Record new bill</DialogTitle>
                    <DialogDescription>
                        Enter the grey fabric bill: party, meters, rate, GST, and due date.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Party" className="md:col-span-2">
                        <Select value={invoiceForm.party_id || undefined} onValueChange={onPartyChange} disabled={activeParties.length === 0}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select party" /></SelectTrigger>
                            <SelectContent>
                                {activeParties.map(party => <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Bill number">
                        <Input value={invoiceForm.invoice_number} onChange={event => setInvoiceForm(prev => ({ ...prev, invoice_number: event.target.value }))} placeholder="Auto if blank" />
                    </Field>
                    <Field label="Link order">
                        <Select value={invoiceForm.order_id} onValueChange={value => setInvoiceForm(prev => ({ ...prev, order_id: value }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No order link</SelectItem>
                                {orders.map(order => (
                                    <SelectItem key={order.id} value={order.id}>{order.party_name} · {order.quality_label ?? 'Order'} · {order.total_target_meters.toLocaleString('en-IN')}m</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Bill date">
                        <Input value={invoiceForm.invoice_date} onChange={event => onDateChange(event.target.value)} type="date" />
                    </Field>
                    <Field label="Due date">
                        <Input value={invoiceForm.due_date} onChange={event => setInvoiceForm(prev => ({ ...prev, due_date: event.target.value }))} type="date" />
                    </Field>
                    <Field label="Meters">
                        <Input value={invoiceForm.total_meters} onChange={event => setInvoiceForm(prev => ({ ...prev, total_meters: event.target.value }))} type="number" min="0" step="0.01" placeholder="0" />
                    </Field>
                    <Field label="Rate / meter">
                        <Input value={invoiceForm.rate_per_m} onChange={event => setInvoiceForm(prev => ({ ...prev, rate_per_m: event.target.value }))} type="number" min="0" step="0.01" placeholder="0" />
                    </Field>
                    <Field label="GST %">
                        <Input value={invoiceForm.gst_percent} onChange={event => setInvoiceForm(prev => ({ ...prev, gst_percent: event.target.value }))} type="number" min="0" step="0.01" />
                    </Field>
                    <div className="rounded-2xl border bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Bill preview</p>
                        <div className="mt-2 space-y-1 text-sm font-bold text-slate-700">
                            <div className="flex justify-between"><span>Gross</span><span>{shortMoney(invoicePreview.gross)}</span></div>
                            <div className="flex justify-between"><span>GST</span><span>{shortMoney(invoicePreview.gst)}</span></div>
                            <div className="flex justify-between border-t pt-2 text-base text-slate-950"><span>Net</span><span>{shortMoney(invoicePreview.net)}</span></div>
                        </div>
                    </div>
                    <Field label="Notes" className="md:col-span-2">
                        <Textarea value={invoiceForm.notes} onChange={event => setInvoiceForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Optional delivery, quality, or broker note" />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={isPending || !invoiceForm.party_id} className="bg-teal-700 hover:bg-teal-800">
                        {isPending ? 'Saving...' : 'Record bill'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
