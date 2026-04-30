'use client'

import { format } from 'date-fns'
import {
    AlertTriangle,
    Archive,
    BookOpen,
    CheckCircle2,
    FileText,
    Pencil,
    Plus,
    Receipt,
    UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import { LedgerAdjustment, LedgerInvoice, LedgerParty, LedgerReceipt } from '../actions'
import { adjustmentLabels, getInvoiceStatusClass, methodLabels, partyTypeLabels, shortMoney } from '../utils'
import { Transaction } from '../types'

function formatDate(date: string) {
    return format(new Date(`${date}T00:00:00`), 'dd MMM yyyy')
}

interface PartyDetailsProps {
    party: LedgerParty | null
    invoices: LedgerInvoice[]
    receipts: LedgerReceipt[]
    adjustments: LedgerAdjustment[]
    transactions: Transaction[]
    isPending: boolean
    onOpenInvoice: (party?: LedgerParty | null) => void
    onOpenReceipt: (party?: LedgerParty | null) => void
    onOpenAdjustment: (party?: LedgerParty | null) => void
    onOpenEditParty: (party: LedgerParty) => void
    onTogglePartyActive: (party: LedgerParty) => void
    onOpenAddParty: () => void
}

export function PartyDetails({
    party,
    invoices,
    receipts,
    adjustments,
    transactions,
    isPending,
    onOpenInvoice,
    onOpenReceipt,
    onOpenAdjustment,
    onOpenEditParty,
    onTogglePartyActive,
    onOpenAddParty
}: PartyDetailsProps) {
    const { t } = useTranslation()

    if (!party) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center">
                    <BookOpen className="h-12 w-12 text-slate-300" />
                    <h2 className="mt-4 text-xl font-black">{t('emptyState.ledger.title')}</h2>
                    <p className="mt-2 max-w-md text-sm text-slate-500">
                        Add a trader, processor, or buyer, then record bills and receipts the way you would in a physical ledger.
                    </p>
                    <Button className="mt-5 bg-teal-700 hover:bg-teal-800" onClick={onOpenAddParty}>
                        <Plus className="mr-2 h-4 w-4" /> {t('emptyState.ledger.addParty')}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-5">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="h-1.5 bg-gradient-to-r from-teal-600 via-cyan-500 to-amber-400" />
                <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="bg-slate-50">{partyTypeLabels[party.party_type]}</Badge>
                                {party.overdue_amount > 0 && (
                                    <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                                        {party.overdue_invoice_count} overdue bill{party.overdue_invoice_count === 1 ? '' : 's'}
                                    </Badge>
                                )}
                                {party.credit_limit > 0 && party.outstanding > party.credit_limit && (
                                    <Badge className="border-amber-200 bg-amber-50 text-amber-800">Over credit limit</Badge>
                                )}
                            </div>
                            <div>
                                <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
                                    <UserRound className="h-6 w-6 text-teal-700" />
                                    {party.name}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Credit {party.default_credit_days} days
                                    {party.credit_limit > 0 ? ` · Limit ${shortMoney(party.credit_limit)}` : ' · No credit limit set'}
                                    {party.phone ? ` · ${party.phone}` : ''}
                                </p>
                            </div>
                            {party.risk_note && (
                                <p className="max-w-2xl rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                    {party.risk_note}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
                            <MiniStat label={party.outstanding >= 0 ? 'Receivable' : 'Credit'} value={shortMoney(Math.abs(party.outstanding))} tone={party.outstanding >= 0 ? 'rose' : 'sky'} />
                            <MiniStat label="Overdue" value={shortMoney(party.overdue_amount)} tone="amber" />
                            <MiniStat label="Collected" value={shortMoney(party.receipt_total)} tone="emerald" />
                        </div>
                    </div>

                    <div className="mt-5 grid gap-2 md:grid-cols-3">
                        <MiniStat label="Current <30d" value={shortMoney(party.current_amount)} tone="sky" />
                        <MiniStat label="Overdue 30-60d" value={shortMoney(party.overdue_30_60_amount)} tone="amber" />
                        <div className="relative">
                            <MiniStat label="Overdue >60d" value={shortMoney(party.overdue_60_plus_amount)} tone="rose" />
                            {party.overdue_60_plus_amount > 0 && (
                                <Badge className="absolute right-3 top-3 border-rose-200 bg-white text-rose-700">Follow up</Badge>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <Button className="bg-teal-700 hover:bg-teal-800" onClick={() => onOpenInvoice(party)} disabled={!party.is_active}>
                            <FileText className="mr-2 h-4 w-4" /> New Bill
                        </Button>
                        <Button variant="outline" onClick={() => onOpenReceipt(party)} disabled={!party.is_active}>
                            <Receipt className="mr-2 h-4 w-4" /> Record Receipt
                        </Button>
                        <Button variant="outline" onClick={() => onOpenAdjustment(party)} disabled={!party.is_active}>
                            <AlertTriangle className="mr-2 h-4 w-4" /> Claim / Deduction
                        </Button>
                        <Button variant="ghost" onClick={() => onOpenEditParty(party)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Party
                        </Button>
                        <Button variant="ghost" onClick={() => onTogglePartyActive(party)} disabled={isPending}>
                            <Archive className="mr-2 h-4 w-4" /> {party.is_active ? 'Archive' : 'Restore'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="register" className="w-full">
                <TabsList className="mb-4 bg-transparent p-0">
                    <TabsTrigger value="register" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-transparent data-[state=active]:border-slate-200 px-4 py-2">Register</TabsTrigger>
                    <TabsTrigger value="bills" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-transparent data-[state=active]:border-slate-200 px-4 py-2">Bills</TabsTrigger>
                    <TabsTrigger value="payments" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-transparent data-[state=active]:border-slate-200 px-4 py-2">Receipts & Claims</TabsTrigger>
                </TabsList>
                
                <TabsContent value="register">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base font-black">
                                <BookOpen className="h-4 w-4 text-teal-700" /> Transaction Register
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-hidden rounded-2xl border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Entry</TableHead>
                                            <TableHead className="text-right">Debit</TableHead>
                                            <TableHead className="text-right">Credit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">No ledger entries yet.</TableCell>
                                            </TableRow>
                                        ) : transactions.map(entry => (
                                            <TableRow key={`${entry.type}-${entry.id}`}>
                                                <TableCell className="text-xs text-slate-500">{formatDate(entry.date)}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-900">{entry.label}</div>
                                                    {entry.notes && <div className="max-w-[220px] truncate text-xs text-slate-500">{entry.notes}</div>}
                                                </TableCell>
                                                <TableCell className="text-right font-bold tabular-nums text-rose-700">{entry.debit ? shortMoney(entry.debit) : '-'}</TableCell>
                                                <TableCell className="text-right font-bold tabular-nums text-emerald-700">{entry.credit ? shortMoney(entry.credit) : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bills">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base font-black">
                                <FileText className="h-4 w-4 text-teal-700" /> Bills
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-hidden rounded-2xl border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Bill</TableHead>
                                            <TableHead>Due</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-500">No bills recorded.</TableCell>
                                            </TableRow>
                                        ) : invoices.map(invoice => (
                                            <TableRow key={invoice.id}>
                                                <TableCell>
                                                    <div className="font-bold text-slate-900">{invoice.invoice_number}</div>
                                                    <div className="text-xs text-slate-500">{formatDate(invoice.invoice_date)} · {invoice.total_meters.toLocaleString('en-IN')}m @ {shortMoney(invoice.rate_per_m)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn('border', getInvoiceStatusClass(invoice))}>
                                                        {invoice.is_overdue ? `${invoice.days_overdue}d late` : invoice.status}
                                                    </Badge>
                                                    <div className="mt-1 text-xs text-slate-500">{formatDate(invoice.due_date)}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-black tabular-nums">
                                                    {shortMoney(invoice.balance_amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payments">
                    <div className="grid gap-5 xl:grid-cols-2">
                        <SimpleListCard
                            title="Recent receipts"
                            empty="No receipts yet."
                            rows={receipts.map(receipt => ({
                                id: receipt.id,
                                title: `${methodLabels[receipt.method]} · ${shortMoney(receipt.amount)}`,
                                meta: `${formatDate(receipt.receipt_date)}${receipt.reference_no ? ` · ${receipt.reference_no}` : ''}`,
                            }))}
                        />
                        <SimpleListCard
                            title="Claims and deductions"
                            empty="No adjustments yet."
                            rows={adjustments.map(adjustment => ({
                                id: adjustment.id,
                                title: `${adjustmentLabels[adjustment.adjustment_type]} · ${shortMoney(adjustment.amount)}`,
                                meta: `${formatDate(adjustment.adjustment_date)} · ${adjustment.direction === 'credit_to_party' ? 'Credit to party' : 'Debit to party'}`,
                            }))}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'rose' | 'amber' | 'emerald' | 'sky' }) {
    const styles = {
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        sky: 'bg-sky-50 text-sky-700 border-sky-100',
    }[tone]

    return (
        <div className={cn('rounded-2xl border p-4', styles)}>
            <p className="text-[11px] font-black uppercase tracking-wider opacity-70">{label}</p>
            <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
        </div>
    )
}

function SimpleListCard({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; meta: string }>; empty: string }) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base font-black">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {rows.length === 0 ? (
                    <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-slate-500">{empty}</p>
                ) : rows.map(row => (
                    <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4">
                        <div>
                            <p className="font-bold text-slate-900">{row.title}</p>
                            <p className="text-xs text-slate-500">{row.meta}</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
