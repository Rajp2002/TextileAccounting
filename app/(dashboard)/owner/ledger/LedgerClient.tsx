'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, BookOpen, Clock, HandCoins, WalletCards, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

import {
    createParty,
    createPartyAdjustment,
    createPartyInvoice,
    createPartyReceipt,
    setPartyActive,
    updateParty,
    type LedgerAdjustment,
    type LedgerData,
    type LedgerInvoice,
    type LedgerParty,
    type LedgerReceipt,
} from './actions'
import {
    AdjustmentFormType,
    InvoiceFormType,
    PartyFormType,
    ReceiptFormType,
    Transaction,
} from './types'
import { adjustmentLabels, methodLabels, shortMoney, toNumber } from './utils'
import { PartyList } from './components/PartyList'
import { PartyDetails } from './components/PartyDetails'
import { PartyFormModal } from './components/PartyFormModal'
import { InvoiceFormModal } from './components/InvoiceFormModal'
import { ReceiptFormModal } from './components/ReceiptFormModal'
import { AdjustmentFormModal } from './components/AdjustmentFormModal'

interface LedgerClientProps {
    initialData: LedgerData
}

function getToday() {
    return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
    const date = new Date(`${dateStr}T00:00:00`)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
}

function emptyPartyForm(): PartyFormType {
    return {
        name: '',
        party_type: 'trader',
        phone: '',
        gstin: '',
        address: '',
        broker_name: '',
        default_credit_days: '30',
        credit_limit: '',
        opening_balance: '',
        opening_balance_type: 'receivable',
        risk_note: '',
        is_active: true,
    }
}

function partyToForm(party: LedgerParty): PartyFormType {
    return {
        name: party.name,
        party_type: party.party_type,
        phone: party.phone ?? '',
        gstin: party.gstin ?? '',
        address: party.address ?? '',
        broker_name: party.broker_name ?? '',
        default_credit_days: String(party.default_credit_days),
        credit_limit: party.credit_limit ? String(party.credit_limit) : '',
        opening_balance: party.opening_balance ? String(party.opening_balance) : '',
        opening_balance_type: party.opening_balance_type,
        risk_note: party.risk_note ?? '',
        is_active: party.is_active,
    }
}

function emptyInvoiceForm(party?: LedgerParty | null): InvoiceFormType {
    const today = getToday()
    return {
        party_id: party?.id ?? '',
        order_id: 'none',
        invoice_number: '',
        invoice_date: today,
        due_date: addDays(today, party?.default_credit_days ?? 30),
        total_meters: '',
        rate_per_m: '',
        gst_percent: '0',
        notes: '',
    }
}

function emptyReceiptForm(party?: LedgerParty | null): ReceiptFormType {
    return {
        party_id: party?.id ?? '',
        invoice_id: 'none',
        receipt_date: getToday(),
        amount: '',
        method: 'bank',
        reference_no: '',
        notes: '',
    }
}

function emptyAdjustmentForm(party?: LedgerParty | null): AdjustmentFormType {
    return {
        party_id: party?.id ?? '',
        invoice_id: 'none',
        adjustment_date: getToday(),
        adjustment_type: 'shortage',
        direction: 'credit_to_party',
        amount: '',
        notes: '',
    }
}

function buildTransactions(
    party: LedgerParty,
    invoices: LedgerInvoice[],
    receipts: LedgerReceipt[],
    adjustments: LedgerAdjustment[]
): Transaction[] {
    const openingDebit = party.opening_balance_type === 'receivable' ? party.opening_balance : 0
    const openingCredit = party.opening_balance_type === 'payable' ? party.opening_balance : 0
    const opening: Transaction[] = party.opening_balance > 0
        ? [{
            id: `opening-${party.id}`,
            date: party.created_at.slice(0, 10),
            type: 'opening',
            label: 'Opening balance',
            debit: openingDebit,
            credit: openingCredit,
            notes: null,
        }]
        : []

    const invoiceRows: Transaction[] = invoices
        .filter(invoice => invoice.party_id === party.id && invoice.status !== 'cancelled')
        .map(invoice => ({
            id: invoice.id,
            date: invoice.invoice_date,
            type: 'invoice',
            label: `Bill ${invoice.invoice_number}`,
            debit: invoice.net_amount,
            credit: 0,
            notes: invoice.notes,
        }))

    const receiptRows: Transaction[] = receipts
        .filter(receipt => receipt.party_id === party.id)
        .map(receipt => ({
            id: receipt.id,
            date: receipt.receipt_date,
            type: 'receipt',
            label: `${methodLabels[receipt.method]} receipt${receipt.reference_no ? ` · ${receipt.reference_no}` : ''}`,
            debit: 0,
            credit: receipt.amount,
            notes: receipt.notes,
        }))

    const adjustmentRows: Transaction[] = adjustments
        .filter(adjustment => adjustment.party_id === party.id)
        .map(adjustment => ({
            id: adjustment.id,
            date: adjustment.adjustment_date,
            type: 'adjustment',
            label: adjustmentLabels[adjustment.adjustment_type],
            debit: adjustment.direction === 'debit_to_party' ? adjustment.amount : 0,
            credit: adjustment.direction === 'credit_to_party' ? adjustment.amount : 0,
            notes: adjustment.notes,
        }))

    return [...opening, ...invoiceRows, ...receiptRows, ...adjustmentRows]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default function LedgerClient({ initialData }: LedgerClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [selectedPartyId, setSelectedPartyId] = useState<string | null>(initialData.parties[0]?.id ?? null)
    const [partyDialogOpen, setPartyDialogOpen] = useState(false)
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
    const [editingParty, setEditingParty] = useState<LedgerParty | null>(null)
    const [partyForm, setPartyForm] = useState<PartyFormType>(emptyPartyForm())
    const [invoiceForm, setInvoiceForm] = useState<InvoiceFormType>(emptyInvoiceForm(initialData.parties[0]))
    const [receiptForm, setReceiptForm] = useState<ReceiptFormType>(emptyReceiptForm(initialData.parties[0]))
    const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormType>(emptyAdjustmentForm(initialData.parties[0]))

    const activeParties = useMemo(() => initialData.parties.filter(party => party.is_active), [initialData.parties])
    const selectedParty = useMemo(() => {
        if (!selectedPartyId) return null
        return initialData.parties.find(party => party.id === selectedPartyId) ?? null
    }, [initialData.parties, selectedPartyId])

    const filteredParties = useMemo(() => {
        const q = search.trim().toLowerCase()
        return initialData.parties.filter(party => {
            if (!showInactive && !party.is_active) return false
            if (!q) return true
            return [party.name, party.phone, party.gstin, party.broker_name]
                .filter(Boolean)
                .some(value => value!.toLowerCase().includes(q))
        })
    }, [initialData.parties, search, showInactive])

    const selectedInvoices = useMemo(() => {
        if (!selectedParty) return []
        return initialData.invoices.filter(invoice => invoice.party_id === selectedParty.id)
    }, [initialData.invoices, selectedParty])

    const selectedReceipts = useMemo(() => {
        if (!selectedParty) return []
        return initialData.receipts.filter(receipt => receipt.party_id === selectedParty.id)
    }, [initialData.receipts, selectedParty])

    const selectedAdjustments = useMemo(() => {
        if (!selectedParty) return []
        return initialData.adjustments.filter(adjustment => adjustment.party_id === selectedParty.id)
    }, [initialData.adjustments, selectedParty])

    const selectedTransactions = useMemo(() => {
        if (!selectedParty) return []
        return buildTransactions(selectedParty, initialData.invoices, initialData.receipts, initialData.adjustments)
    }, [initialData.adjustments, initialData.invoices, initialData.receipts, selectedParty])

    const invoiceParty = initialData.parties.find(party => party.id === invoiceForm.party_id) ?? selectedParty
    const receiptParty = initialData.parties.find(party => party.id === receiptForm.party_id) ?? selectedParty
    const adjustmentParty = initialData.parties.find(party => party.id === adjustmentForm.party_id) ?? selectedParty

    const receiptInvoiceOptions = initialData.invoices.filter(invoice => (
        invoice.party_id === receiptForm.party_id &&
        invoice.status !== 'cancelled' &&
        invoice.balance_amount > 0.01
    ))

    const adjustmentInvoiceOptions = initialData.invoices.filter(invoice => (
        invoice.party_id === adjustmentForm.party_id && invoice.status !== 'cancelled'
    ))

    const totals = useMemo(() => {
        const receivable = initialData.parties.reduce((sum, party) => sum + Math.max(0, party.outstanding), 0)
        const payable = initialData.parties.reduce((sum, party) => sum + Math.max(0, -party.outstanding), 0)
        const overdue = initialData.parties.reduce((sum, party) => sum + party.overdue_amount, 0)
        const overLimit = initialData.parties.filter(party => party.credit_limit > 0 && party.outstanding > party.credit_limit).length
        return { receivable, payable, overdue, overLimit }
    }, [initialData.parties])

    function refreshAfter(message: string, close?: () => void) {
        toast.success(message)
        close?.()
        router.refresh()
    }

    function openAddParty() {
        setEditingParty(null)
        setPartyForm(emptyPartyForm())
        setPartyDialogOpen(true)
    }

    function openEditParty(party: LedgerParty) {
        setEditingParty(party)
        setPartyForm(partyToForm(party))
        setPartyDialogOpen(true)
    }

    function openInvoice(party?: LedgerParty | null) {
        const fallback = party ?? selectedParty ?? activeParties[0] ?? null
        setInvoiceForm(emptyInvoiceForm(fallback))
        setInvoiceDialogOpen(true)
    }

    function openReceipt(party?: LedgerParty | null) {
        const fallback = party ?? selectedParty ?? activeParties[0] ?? null
        setReceiptForm(emptyReceiptForm(fallback))
        setReceiptDialogOpen(true)
    }

    function openAdjustment(party?: LedgerParty | null) {
        const fallback = party ?? selectedParty ?? activeParties[0] ?? null
        setAdjustmentForm(emptyAdjustmentForm(fallback))
        setAdjustmentDialogOpen(true)
    }

    function handleInvoicePartyChange(partyId: string) {
        const party = initialData.parties.find(p => p.id === partyId)
        setInvoiceForm(prev => ({
            ...prev,
            party_id: partyId,
            order_id: 'none',
            due_date: addDays(prev.invoice_date, party?.default_credit_days ?? 30),
        }))
    }

    function handleInvoiceDateChange(date: string) {
        setInvoiceForm(prev => ({
            ...prev,
            invoice_date: date,
            due_date: addDays(date, invoiceParty?.default_credit_days ?? 30),
        }))
    }

    async function submitParty() {
        startTransition(async () => {
            const payload = {
                ...partyForm,
                default_credit_days: toNumber(partyForm.default_credit_days, 30),
                credit_limit: toNumber(partyForm.credit_limit),
                opening_balance: toNumber(partyForm.opening_balance),
            }

            const result = editingParty
                ? await updateParty(editingParty.id, payload)
                : await createParty(payload)

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter(editingParty ? 'Party updated' : 'Party added', () => setPartyDialogOpen(false))
        })
    }

    async function submitInvoice() {
        if (!invoiceForm.party_id) {
            toast.error('Select a party first')
            return
        }

        startTransition(async () => {
            const result = await createPartyInvoice({
                ...invoiceForm,
                order_id: invoiceForm.order_id === 'none' ? '' : invoiceForm.order_id,
                total_meters: toNumber(invoiceForm.total_meters),
                rate_per_m: toNumber(invoiceForm.rate_per_m),
                gst_percent: toNumber(invoiceForm.gst_percent),
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter('Bill recorded', () => setInvoiceDialogOpen(false))
        })
    }

    async function submitReceipt() {
        if (!receiptForm.party_id) {
            toast.error('Select a party first')
            return
        }

        startTransition(async () => {
            const result = await createPartyReceipt({
                ...receiptForm,
                invoice_id: receiptForm.invoice_id === 'none' ? '' : receiptForm.invoice_id,
                amount: toNumber(receiptForm.amount),
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter('Receipt recorded', () => setReceiptDialogOpen(false))
        })
    }

    async function submitAdjustment() {
        if (!adjustmentForm.party_id) {
            toast.error('Select a party first')
            return
        }

        startTransition(async () => {
            const result = await createPartyAdjustment({
                ...adjustmentForm,
                invoice_id: adjustmentForm.invoice_id === 'none' ? '' : adjustmentForm.invoice_id,
                amount: toNumber(adjustmentForm.amount),
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter('Adjustment recorded', () => setAdjustmentDialogOpen(false))
        })
    }

    async function togglePartyActive(party: LedgerParty) {
        startTransition(async () => {
            const result = await setPartyActive(party.id, !party.is_active)
            if ('error' in result) {
                toast.error(result.error)
                return
            }
            refreshAfter(party.is_active ? 'Party archived' : 'Party restored')
        })
    }

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_34%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfeff_100%)] p-5 shadow-sm md:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl space-y-3">
                        <Badge variant="outline" className="border-teal-200 bg-white/70 text-teal-800">
                            Module 1 · Party receivable register
                        </Badge>
                        <div>
                            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                                <BookOpen className="h-8 w-8 text-teal-700" />
                                Party Ledger
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                                Convert the paper register into a simple digital flow: party master, bill entry, payment receipt, claim/deduction, and overdue follow-up.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="bg-white/80" onClick={openAddParty}>
                            <Plus className="mr-2 h-4 w-4" /> Add Party
                        </Button>
                        <Button className="bg-teal-700 hover:bg-teal-800" onClick={() => openInvoice()} disabled={activeParties.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> New Bill
                        </Button>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Receivable" value={shortMoney(totals.receivable)} helper="Money parties owe you" icon={WalletCards} tone="teal" />
                <MetricCard title="Overdue" value={shortMoney(totals.overdue)} helper="Past credit date" icon={Clock} tone="rose" />
                <MetricCard title="Payable/Credit" value={shortMoney(totals.payable)} helper="Advance or overpaid parties" icon={HandCoins} tone="sky" />
                <MetricCard title="Credit Risk" value={String(totals.overLimit)} helper="Parties over credit limit" icon={AlertTriangle} tone="amber" />
            </section>

            <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
                <PartyList
                    parties={filteredParties}
                    search={search}
                    onSearchChange={setSearch}
                    showInactive={showInactive}
                    onToggleShowInactive={() => setShowInactive(prev => !prev)}
                    selectedPartyId={selectedPartyId}
                    onSelectParty={setSelectedPartyId}
                />

                <PartyDetails
                    party={selectedParty}
                    invoices={selectedInvoices}
                    receipts={selectedReceipts}
                    adjustments={selectedAdjustments}
                    transactions={selectedTransactions}
                    isPending={isPending}
                    onOpenInvoice={openInvoice}
                    onOpenReceipt={openReceipt}
                    onOpenAdjustment={openAdjustment}
                    onOpenEditParty={openEditParty}
                    onTogglePartyActive={togglePartyActive}
                    onOpenAddParty={openAddParty}
                />
            </section>

            <PartyFormModal
                open={partyDialogOpen}
                onOpenChange={setPartyDialogOpen}
                editingParty={editingParty}
                partyForm={partyForm}
                setPartyForm={setPartyForm}
                isPending={isPending}
                onSubmit={submitParty}
            />

            <InvoiceFormModal
                open={invoiceDialogOpen}
                onOpenChange={setInvoiceDialogOpen}
                invoiceForm={invoiceForm}
                setInvoiceForm={setInvoiceForm}
                activeParties={activeParties}
                orders={initialData.orders}
                isPending={isPending}
                onSubmit={submitInvoice}
                onPartyChange={handleInvoicePartyChange}
                onDateChange={handleInvoiceDateChange}
            />

            <ReceiptFormModal
                open={receiptDialogOpen}
                onOpenChange={setReceiptDialogOpen}
                receiptForm={receiptForm}
                setReceiptForm={setReceiptForm}
                activeParties={activeParties}
                invoiceOptions={receiptInvoiceOptions}
                receiptParty={receiptParty}
                isPending={isPending}
                onSubmit={submitReceipt}
            />

            <AdjustmentFormModal
                open={adjustmentDialogOpen}
                onOpenChange={setAdjustmentDialogOpen}
                adjustmentForm={adjustmentForm}
                setAdjustmentForm={setAdjustmentForm}
                activeParties={activeParties}
                invoiceOptions={adjustmentInvoiceOptions}
                adjustmentParty={adjustmentParty}
                isPending={isPending}
                onSubmit={submitAdjustment}
            />
        </div>
    )
}

function MetricCard({
    title,
    value,
    helper,
    icon: Icon,
    tone,
}: {
    title: string
    value: string
    helper: string
    icon: LucideIcon
    tone: 'teal' | 'rose' | 'sky' | 'amber'
}) {
    const styles = {
        teal: 'bg-teal-50 text-teal-700 border-teal-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        sky: 'bg-sky-50 text-sky-700 border-sky-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
    }[tone]

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
                <div className={cn('rounded-2xl border p-3', styles)}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">{title}</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{value}</p>
                    <p className="text-xs font-medium text-slate-500">{helper}</p>
                </div>
            </CardContent>
        </Card>
    )
}
