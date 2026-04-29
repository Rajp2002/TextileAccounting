'use client'

import { format } from 'date-fns'
import { BookOpen, Pencil, Plus, Receipt, Truck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/context'
import { LedgerSupplier, SupplierLedgerEntry } from '../actions'
import { shortMoney } from '../utils'

function formatDate(date: string) {
    return format(new Date(`${date}T00:00:00`), 'dd MMM yyyy')
}

interface SupplierDetailsProps {
    supplier: LedgerSupplier | null
    entries: SupplierLedgerEntry[]
    onOpenAddSupplier: () => void
    onOpenEditSupplier: (supplier: LedgerSupplier) => void
    onOpenEntry: (supplier?: LedgerSupplier | null, type?: 'purchase' | 'payment') => void
}

export function SupplierDetails({
    supplier,
    entries,
    onOpenAddSupplier,
    onOpenEditSupplier,
    onOpenEntry,
}: SupplierDetailsProps) {
    const { t } = useTranslation()

    if (!supplier) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center">
                    <BookOpen className="h-12 w-12 text-slate-300" />
                    <h2 className="mt-4 text-xl font-black">{t('suppliers.introTitle')}</h2>
                    <p className="mt-2 max-w-md text-sm text-slate-500">
                        {t('suppliers.introBody')}
                    </p>
                    <Button className="mt-5 bg-indigo-700 hover:bg-indigo-800" onClick={onOpenAddSupplier}>
                        <Plus className="mr-2 h-4 w-4" /> {t('suppliers.addSupplier')}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-5">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-sky-500 to-amber-400" />
                <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                            <div>
                                <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
                                    <UserRound className="h-6 w-6 text-indigo-700" />
                                    {supplier.name}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {supplier.phone ?? t('suppliers.noPhone')}
                                    {supplier.gst_number ? ` · ${supplier.gst_number}` : ''}
                                </p>
                            </div>
                            {supplier.notes && (
                                <p className="max-w-2xl rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                    {supplier.notes}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
                            <MiniStat label={t('suppliers.entry.purchasesMetric')} value={shortMoney(supplier.purchase_total)} tone="amber" />
                            <MiniStat label={t('suppliers.entry.paymentsMetric')} value={shortMoney(supplier.payment_total)} tone="emerald" />
                            <MiniStat label={t('suppliers.balance')} value={shortMoney(Math.max(0, supplier.balance))} tone="rose" />
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <Button className="bg-indigo-700 hover:bg-indigo-800" onClick={() => onOpenEntry(supplier, 'purchase')}>
                            <Truck className="mr-2 h-4 w-4" /> {t('suppliers.entry.purchase')}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenEntry(supplier, 'payment')}>
                            <Receipt className="mr-2 h-4 w-4" /> {t('suppliers.entry.payment')}
                        </Button>
                        <Button variant="ghost" onClick={() => onOpenEditSupplier(supplier)}>
                            <Pencil className="mr-2 h-4 w-4" /> {t('suppliers.editSupplier')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-black">
                        <BookOpen className="h-4 w-4 text-indigo-700" /> {t('suppliers.ledgerTitle')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-hidden rounded-2xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('suppliers.entry.date')}</TableHead>
                                    <TableHead>{t('suppliers.entry.type')}</TableHead>
                                    <TableHead className="text-right">{t('suppliers.entry.amount')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-500">{t('suppliers.noEntries')}</TableCell>
                                    </TableRow>
                                ) : entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="text-xs text-slate-500">{formatDate(entry.entry_date)}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-slate-900">
                                                {entry.type === 'purchase' ? t('suppliers.entry.purchase') : t('suppliers.entry.payment')}
                                            </div>
                                            {entry.note && <div className="max-w-[260px] truncate text-xs text-slate-500">{entry.note}</div>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge className={entry.type === 'purchase' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                                                {shortMoney(entry.amount)}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function MiniStat({
    label,
    value,
    tone,
}: {
    label: string
    value: string
    tone: 'amber' | 'emerald' | 'rose'
}) {
    const toneClass = {
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
    }[tone]

    return (
        <div className={`rounded-2xl border p-4 ${toneClass}`}>
            <p className="text-xs font-black uppercase tracking-wider">{label}</p>
            <p className="mt-2 text-xl font-black tabular-nums">{value}</p>
        </div>
    )
}
