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
import { useTranslation } from '@/lib/i18n/context'

interface ReceiptFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    receiptForm: ReceiptFormType
    setReceiptForm: Dispatch<SetStateAction<ReceiptFormType>>
    activeParties: LedgerParty[]
    invoiceOptions: LedgerInvoice[]
    receiptParty: LedgerParty | null
    allocatedTotal: number
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
    allocatedTotal,
    isPending,
    onSubmit
}: ReceiptFormModalProps) {
    const { t } = useTranslation()
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t('ledger.receipt.title')}</DialogTitle>
                    <DialogDescription>
                        {t('ledger.receipt.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t('ledger.receipt.party')} className="md:col-span-2">
                        <Select value={receiptForm.party_id || undefined} onValueChange={value => setReceiptForm(prev => ({ ...prev, party_id: value, invoice_id: 'none' }))} disabled={activeParties.length === 0}>
                            <SelectTrigger className="w-full"><SelectValue placeholder={t('ledger.receipt.selectParty')} /></SelectTrigger>
                            <SelectContent>
                                {activeParties.map(party => <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t('ledger.receipt.againstBill')}>
                        <Select value={receiptForm.invoice_id} onValueChange={value => setReceiptForm(prev => ({ ...prev, invoice_id: value }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t('ledger.receipt.generalReceipt')}</SelectItem>
                                {invoiceOptions.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {shortMoney(invoice.balance_amount)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t('ledger.receipt.date')}>
                        <Input value={receiptForm.receipt_date} onChange={event => setReceiptForm(prev => ({ ...prev, receipt_date: event.target.value }))} type="date" />
                    </Field>
                    <Field label={t('ledger.receipt.amount')}>
                        <Input value={receiptForm.amount} onChange={event => setReceiptForm(prev => ({ ...prev, amount: event.target.value }))} type="number" min="0" step="0.01" placeholder={receiptParty ? String(Math.max(0, receiptParty.outstanding)) : '0'} />
                    </Field>
                    <Field label={t('ledger.receipt.method')}>
                        <Select value={receiptForm.method} onValueChange={value => setReceiptForm(prev => ({ ...prev, method: value as ReceiptMethod }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(methodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t('ledger.receipt.reference')} className="md:col-span-2">
                        <Input value={receiptForm.reference_no} onChange={event => setReceiptForm(prev => ({ ...prev, reference_no: event.target.value }))} placeholder={t('ledger.receipt.referencePlaceholder')} />
                    </Field>
                    <Field label={t('ledger.receipt.notes')} className="md:col-span-2">
                        <Textarea value={receiptForm.notes} onChange={event => setReceiptForm(prev => ({ ...prev, notes: event.target.value }))} placeholder={t('common.optional')} />
                    </Field>
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-black text-slate-900">{t('ledger.payment.allocateToggle')}</p>
                                <p className="text-xs text-slate-500">{t('ledger.payment.allocateHelp')}</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={receiptForm.allocate_across_invoices}
                                onChange={(event) => setReceiptForm(prev => ({
                                    ...prev,
                                    allocate_across_invoices: event.target.checked,
                                    invoice_id: event.target.checked ? 'none' : prev.invoice_id,
                                    allocations: event.target.checked
                                        ? invoiceOptions.map(invoice => ({
                                            invoice_id: invoice.id,
                                            allocated_amount: prev.allocations.find(allocation => allocation.invoice_id === invoice.id)?.allocated_amount ?? '',
                                        }))
                                        : [],
                                }))}
                                className="h-4 w-4 rounded border-slate-300"
                            />
                        </div>
                        {receiptForm.allocate_across_invoices && (
                            <div className="space-y-3">
                                {invoiceOptions.length === 0 ? (
                                    <p className="text-xs text-slate-500">{t('ledger.payment.noOpenInvoices')}</p>
                                ) : (
                                    invoiceOptions.map((invoice) => {
                                        const allocation = receiptForm.allocations.find(item => item.invoice_id === invoice.id)
                                        return (
                                            <div key={invoice.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_160px] md:items-center">
                                                <div>
                                                    <p className="font-bold text-slate-900">{invoice.invoice_number}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {t('ledger.payment.dueBalance')
                                                            .replace('{date}', invoice.due_date)
                                                            .replace('{amount}', shortMoney(invoice.balance_amount))}
                                                    </p>
                                                </div>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={allocation?.allocated_amount ?? ''}
                                                    onChange={(event) => setReceiptForm(prev => ({
                                                        ...prev,
                                                        allocations: prev.allocations.map(item => item.invoice_id === invoice.id
                                                            ? { ...item, allocated_amount: event.target.value }
                                                            : item
                                                        ),
                                                    }))}
                                                    placeholder={t('ledger.receipt.allocationLabel')}
                                                />
                                            </div>
                                        )
                                    })
                                )}
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span>{t('ledger.payment.allocated')}</span>
                                    {Math.abs(allocatedTotal - Number(receiptForm.amount || 0)) < 0.01 ? (
                                        <span className="text-emerald-600">{t('ledger.payment.allocateFull')}</span>
                                    ) : (
                                        <span className="text-rose-600">
                                            {shortMoney(allocatedTotal)} / {shortMoney(Number(receiptForm.amount || 0))}
                                        </span>
                                    )}
                                </div>
                                {Math.abs(allocatedTotal - Number(receiptForm.amount || 0)) >= 0.01 && (
                                    <p className="text-xs font-bold text-rose-600">{t('ledger.payment.allocateWarning')}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button
                        onClick={onSubmit}
                        disabled={isPending || !receiptForm.party_id || (receiptForm.allocate_across_invoices && Math.abs(allocatedTotal - Number(receiptForm.amount || 0)) >= 0.01)}
                        className="bg-teal-700 hover:bg-teal-800"
                    >
                        {isPending ? t('common.saving') : t('ledger.receipt.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
