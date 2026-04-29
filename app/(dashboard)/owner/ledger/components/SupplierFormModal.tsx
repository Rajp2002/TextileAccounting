'use client'

import { Dispatch, SetStateAction } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/lib/i18n/context'
import { SupplierFormType } from '../types'
import { Field } from './Field'

interface SupplierFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    supplierForm: SupplierFormType
    setSupplierForm: Dispatch<SetStateAction<SupplierFormType>>
    editing: boolean
    isPending: boolean
    onSubmit: () => void
}

export function SupplierFormModal({
    open,
    onOpenChange,
    supplierForm,
    setSupplierForm,
    editing,
    isPending,
    onSubmit,
}: SupplierFormModalProps) {
    const { t } = useTranslation()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editing ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}</DialogTitle>
                    <DialogDescription>
                        {t('suppliers.formDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t('suppliers.name')} className="md:col-span-2">
                        <Input value={supplierForm.name} onChange={(event) => setSupplierForm(prev => ({ ...prev, name: event.target.value }))} />
                    </Field>
                    <Field label={t('suppliers.phone')}>
                        <Input value={supplierForm.phone} onChange={(event) => setSupplierForm(prev => ({ ...prev, phone: event.target.value }))} />
                    </Field>
                    <Field label={t('suppliers.gstNumber')}>
                        <Input value={supplierForm.gst_number} onChange={(event) => setSupplierForm(prev => ({ ...prev, gst_number: event.target.value }))} />
                    </Field>
                    <Field label={t('suppliers.notes')} className="md:col-span-2">
                        <Textarea value={supplierForm.notes} onChange={(event) => setSupplierForm(prev => ({ ...prev, notes: event.target.value }))} />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button onClick={onSubmit} disabled={isPending || !supplierForm.name.trim()} className="bg-indigo-700 hover:bg-indigo-800">
                        {isPending ? t('production.saving') : editing ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
