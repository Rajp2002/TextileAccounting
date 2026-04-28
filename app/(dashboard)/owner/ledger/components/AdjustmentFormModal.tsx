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
import { AdjustmentDirection, AdjustmentType, LedgerInvoice, LedgerParty } from '../actions'
import { AdjustmentFormType } from '../types'
import { adjustmentLabels, shortMoney } from '../utils'
import { Field } from './Field'

interface AdjustmentFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    adjustmentForm: AdjustmentFormType
    setAdjustmentForm: Dispatch<SetStateAction<AdjustmentFormType>>
    activeParties: LedgerParty[]
    invoiceOptions: LedgerInvoice[]
    adjustmentParty: LedgerParty | null
    isPending: boolean
    onSubmit: () => void
}

export function AdjustmentFormModal({
    open,
    onOpenChange,
    adjustmentForm,
    setAdjustmentForm,
    activeParties,
    invoiceOptions,
    adjustmentParty,
    isPending,
    onSubmit
}: AdjustmentFormModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Claim / deduction</DialogTitle>
                    <DialogDescription>
                        Track shortages, quality claims, discounts, and rate differences without losing the audit trail.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Party" className="md:col-span-2">
                        <Select value={adjustmentForm.party_id || undefined} onValueChange={value => setAdjustmentForm(prev => ({ ...prev, party_id: value, invoice_id: 'none' }))} disabled={activeParties.length === 0}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select party" /></SelectTrigger>
                            <SelectContent>
                                {activeParties.map(party => <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Against bill">
                        <Select value={adjustmentForm.invoice_id} onValueChange={value => setAdjustmentForm(prev => ({ ...prev, invoice_id: value }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">General adjustment</SelectItem>
                                {invoiceOptions.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {shortMoney(invoice.balance_amount)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Date">
                        <Input value={adjustmentForm.adjustment_date} onChange={event => setAdjustmentForm(prev => ({ ...prev, adjustment_date: event.target.value }))} type="date" />
                    </Field>
                    <Field label="Type">
                        <Select value={adjustmentForm.adjustment_type} onValueChange={value => setAdjustmentForm(prev => ({ ...prev, adjustment_type: value as AdjustmentType }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(adjustmentLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Effect">
                        <Select value={adjustmentForm.direction} onValueChange={value => setAdjustmentForm(prev => ({ ...prev, direction: value as AdjustmentDirection }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="credit_to_party">Reduce receivable</SelectItem>
                                <SelectItem value="debit_to_party">Increase receivable</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Amount" className="md:col-span-2">
                        <Input value={adjustmentForm.amount} onChange={event => setAdjustmentForm(prev => ({ ...prev, amount: event.target.value }))} type="number" min="0" step="0.01" placeholder={adjustmentParty ? String(Math.max(0, adjustmentParty.outstanding)) : '0'} />
                    </Field>
                    <Field label="Reason / note" className="md:col-span-2">
                        <Textarea value={adjustmentForm.notes} onChange={event => setAdjustmentForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="e.g. 42m shortage accepted by broker" />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={isPending || !adjustmentForm.party_id} className="bg-teal-700 hover:bg-teal-800">
                        {isPending ? 'Saving...' : 'Record adjustment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
