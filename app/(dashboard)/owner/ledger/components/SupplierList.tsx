'use client'

import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { LedgerSupplier } from '../actions'
import { shortMoney } from '../utils'

interface SupplierListProps {
    suppliers: LedgerSupplier[]
    search: string
    onSearchChange: (value: string) => void
    selectedSupplierId: string | null
    onSelectSupplier: (id: string) => void
}

export function SupplierList({
    suppliers,
    search,
    onSearchChange,
    selectedSupplierId,
    onSelectSupplier,
}: SupplierListProps) {
    const { t } = useTranslation()

    return (
        <Card className="overflow-hidden border-slate-200/80 shadow-sm flex flex-col h-full">
            <CardHeader className="space-y-4 border-b bg-slate-50/70 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base font-black">{t('ledger.tabs.suppliers')}</CardTitle>
                    <Badge variant="secondary">{suppliers.length}</Badge>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={search}
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder={t('suppliers.searchPlaceholder')}
                        className="bg-white pl-9"
                    />
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[720px] xl:max-h-[800px]">
                {suppliers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                        {t('emptyState.ledger.noSupplier')}
                    </div>
                ) : suppliers.map((supplier) => {
                    const selected = selectedSupplierId === supplier.id
                    return (
                        <button
                            key={supplier.id}
                            onClick={() => onSelectSupplier(supplier.id)}
                            className={cn(
                                'w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                                selected ? 'border-indigo-400 bg-indigo-50/70 shadow-sm' : 'border-slate-200 bg-white'
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-slate-950">{supplier.name}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                        {supplier.phone ?? t('suppliers.noPhone')}{supplier.gst_number ? ` · ${supplier.gst_number}` : ''}
                                    </p>
                                </div>
                                <Badge className={supplier.balance > 0.01 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                                    {supplier.balance > 0.01 ? t('suppliers.payable') : t('suppliers.settled')}
                                </Badge>
                            </div>
                            <div className="mt-4 flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t('suppliers.balance')}</p>
                                    <p className="mt-1 rounded-full border border-slate-200 px-2.5 py-1 text-sm font-black tabular-nums text-slate-950">
                                        {shortMoney(Math.max(0, supplier.balance))}
                                    </p>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </CardContent>
        </Card>
    )
}
