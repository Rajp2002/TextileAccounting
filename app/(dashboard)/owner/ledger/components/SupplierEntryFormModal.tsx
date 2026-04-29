'use client'

import { Dispatch, SetStateAction } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n/context'
import { LedgerSupplier } from '../actions'
import { SupplierEntryFormType } from '../types'
import { Field } from './Field'

interface SupplierEntryFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entryForm: SupplierEntryFormType
    setEntryForm: Dispatch<SetStateAction<SupplierEntryFormType>>
    suppliers: LedgerSupplier[]
    isPending: boolean
    onSubmit: () => void
}

export function SupplierEntryFormModal({
    open,
    onOpenChange,
    entryForm,
    setEntryForm,
    suppliers,
    isPending,
    onSubmit,
}: SupplierEntryFormModalProps) {
    const { t } = useTranslation()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{entryForm.type === 'purchase' ? t('suppliers.entry.purchase') : t('suppliers.entry.payment')}</DialogTitle>
                    <DialogDescription>
                        {t('suppliers.entry.formDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t('suppliers.entry.supplier')} className="md:col-span-2">
                        <Select value={entryForm.supplier_id || undefined} onValueChange={(value) => setEntryForm(prev => ({ ...prev, supplier_id: value }))}>
                            <SelectTrigger className="w-full"><SelectValue placeholder={t('suppliers.entry.selectSupplier')} /></SelectTrigger>
                            <SelectContent>
                                {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t('suppliers.entry.type')}>
                        <Select value={entryForm.type} onValueChange={(value) => setEntryForm(prev => ({ ...prev, type: value as 'purchase' | 'payment' }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="purchase">{t('suppliers.entry.purchase')}</SelectItem>
                                <SelectItem value="payment">{t('suppliers.entry.payment')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t('suppliers.entry.date')}>
                        <Input type="date" value={entryForm.entry_date} onChange={(event) => setEntryForm(prev => ({ ...prev, entry_date: event.target.value }))} />
                    </Field>
                    <Field label={t('suppliers.entry.amount')}>
                        <Input type="number" min="0" step="0.01" value={entryForm.amount} onChange={(event) => setEntryForm(prev => ({ ...prev, amount: event.target.value }))} />
                    </Field>
                    <Field label={t('suppliers.entry.note')} className="md:col-span-2">
                        <Textarea value={entryForm.note} onChange={(event) => setEntryForm(prev => ({ ...prev, note: event.target.value }))} />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button onClick={onSubmit} disabled={isPending || !entryForm.supplier_id} className="bg-indigo-700 hover:bg-indigo-800">
                        {isPending ? t('production.saving') : entryForm.type === 'purchase' ? t('suppliers.entry.recordPurchase') : t('suppliers.entry.recordPayment')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
