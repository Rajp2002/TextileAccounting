import { Dispatch, SetStateAction } from 'react'
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
import { LedgerInvoice, LedgerParty, ReceiptMethod } from '../actions'
import { ReceiptFormType } from '../types'
import { methodLabels, shortMoney } from '../utils'
import { Field } from './Field'

interface ReceiptFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    receiptForm: ReceiptFormType
    setReceiptForm: Dispatch<SetStateAction<ReceiptFormType>>
    activeParties: LedgerParty[]
    invoiceOptions: LedgerInvoice[]
    receiptParty: LedgerParty | null
    isPending: boolean
    onSubmit: () => void
}

export function ReceiptFormModal({
    open,
    onOpenChange,
    receiptForm,
    setReceiptForm,
    activeParties,
    invoiceOptions,
    receiptParty,
    isPending,
    onSubmit
}: ReceiptFormModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Record receipt</DialogTitle>
                    <DialogDescription>
                        Capture payment exactly when cash, UPI, bank, or cheque is received.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Party" className="md:col-span-2">
                        <Select value={receiptForm.party_id || undefined} onValueChange={value => setReceiptForm(prev => ({ ...prev, party_id: value, invoice_id: 'none' }))} disabled={activeParties.length === 0}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select party" /></SelectTrigger>
                            <SelectContent>
                                {activeParties.map(party => <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Against bill">
                        <Select value={receiptForm.invoice_id} onValueChange={value => setReceiptForm(prev => ({ ...prev, invoice_id: value }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">General receipt</SelectItem>
                                {invoiceOptions.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · Bal {shortMoney(invoice.balance_amount)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Date">
                        <Input value={receiptForm.receipt_date} onChange={event => setReceiptForm(prev => ({ ...prev, receipt_date: event.target.value }))} type="date" />
                    </Field>
                    <Field label="Amount">
                        <Input value={receiptForm.amount} onChange={event => setReceiptForm(prev => ({ ...prev, amount: event.target.value }))} type="number" min="0" step="0.01" placeholder={receiptParty ? String(Math.max(0, receiptParty.outstanding)) : '0'} />
                    </Field>
                    <Field label="Method">
                        <Select value={receiptForm.method} onValueChange={value => setReceiptForm(prev => ({ ...prev, method: value as ReceiptMethod }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(methodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Reference" className="md:col-span-2">
                        <Input value={receiptForm.reference_no} onChange={event => setReceiptForm(prev => ({ ...prev, reference_no: event.target.value }))} placeholder="Cheque no., UTR, bank ref, optional" />
                    </Field>
                    <Field label="Notes" className="md:col-span-2">
                        <Textarea value={receiptForm.notes} onChange={event => setReceiptForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Optional" />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={isPending || !receiptForm.party_id} className="bg-teal-700 hover:bg-teal-800">
                        {isPending ? 'Saving...' : 'Record receipt'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
