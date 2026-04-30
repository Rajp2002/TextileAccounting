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
import { LedgerParty, OpeningBalanceType, PartyType } from '../actions'
import { PartyFormType } from '../types'
import { partyTypeLabels } from '../utils'
import { Field } from './Field'

interface PartyFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingParty: LedgerParty | null
    partyForm: PartyFormType
    setPartyForm: Dispatch<SetStateAction<PartyFormType>>
    isPending: boolean
    onSubmit: () => void
}

export function PartyFormModal({
    open,
    onOpenChange,
    editingParty,
    partyForm,
    setPartyForm,
    isPending,
    onSubmit
}: PartyFormModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editingParty ? 'Edit party' : 'Add party'}</DialogTitle>
                    <DialogDescription>
                        Record only business details you need for billing, collections, and credit control.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Use business contact details you are authorised to record. Avoid personal, sensitive, or unrelated notes.
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Party name" hint="Use the legal or trade name used on bills and receipts." className="md:col-span-2">
                        <Input value={partyForm.name} onChange={event => setPartyForm(prev => ({ ...prev, name: event.target.value }))} placeholder="e.g. Mahavir Traders" />
                    </Field>
                    <Field label="Party type">
                        <Select value={partyForm.party_type} onValueChange={value => setPartyForm(prev => ({ ...prev, party_type: value as PartyType }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(partyTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Business phone" hint="Prefer an office or business mobile number.">
                        <Input 
                            value={partyForm.phone} 
                            onChange={event => {
                                const val = event.target.value.replace(/\D/g, '').slice(0, 10)
                                setPartyForm(prev => ({ ...prev, phone: val }))
                            }} 
                            placeholder="10 digit business number" 
                            inputMode="numeric"
                            maxLength={10}
                        />
                    </Field>
                    <Field label="GSTIN">
                        <Input value={partyForm.gstin} onChange={event => setPartyForm(prev => ({ ...prev, gstin: event.target.value.toUpperCase() }))} placeholder="Optional" />
                    </Field>
                    <Field label="State" hint="Used for CGST/SGST vs IGST on invoices.">
                        <Input value={partyForm.state} onChange={event => setPartyForm(prev => ({ ...prev, state: event.target.value }))} placeholder="Gujarat" />
                    </Field>
                    <Field label="Broker / contact name" hint="Use a business contact only if needed for transactions.">
                        <Input value={partyForm.broker_name} onChange={event => setPartyForm(prev => ({ ...prev, broker_name: event.target.value }))} placeholder="Optional business contact" />
                    </Field>
                    <Field label="Credit days">
                        <Input value={partyForm.default_credit_days} onChange={event => setPartyForm(prev => ({ ...prev, default_credit_days: event.target.value }))} type="number" min="0" />
                    </Field>
                    <Field label="Credit limit">
                        <Input value={partyForm.credit_limit} onChange={event => setPartyForm(prev => ({ ...prev, credit_limit: event.target.value }))} type="number" min="0" placeholder="Optional" />
                    </Field>
                    <Field label="Opening balance">
                        <Input value={partyForm.opening_balance} onChange={event => setPartyForm(prev => ({ ...prev, opening_balance: event.target.value }))} type="number" min="0" placeholder="0" />
                    </Field>
                    <Field label="Balance type">
                        <Select value={partyForm.opening_balance_type} onValueChange={value => setPartyForm(prev => ({ ...prev, opening_balance_type: value as OpeningBalanceType }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="receivable">Party owes us</SelectItem>
                                <SelectItem value="payable">We owe / credit</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Business address" hint="Use billing, office, or registered address details only." className="md:col-span-2">
                        <Textarea value={partyForm.address} onChange={event => setPartyForm(prev => ({ ...prev, address: event.target.value }))} placeholder="Optional business address" />
                    </Field>
                    <Field label="Collection note" hint="Keep this business-focused. Avoid personal or sensitive remarks." className="md:col-span-2">
                        <Textarea value={partyForm.risk_note} onChange={event => setPartyForm(prev => ({ ...prev, risk_note: event.target.value }))} placeholder="e.g. Payment usually comes after delivery confirmation" />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={isPending} className="bg-teal-700 hover:bg-teal-800">
                        {isPending ? 'Saving...' : editingParty ? 'Save changes' : 'Add party'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
