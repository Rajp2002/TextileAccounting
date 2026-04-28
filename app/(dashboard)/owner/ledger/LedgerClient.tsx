'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
    AlertTriangle,
    Archive,
    BookOpen,
    CheckCircle2,
    Clock,
    FileText,
    HandCoins,
    Pencil,
    Plus,
    Receipt,
    Search,
    UserRound,
    WalletCards,
    type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/finance'
import {
    createParty,
    createPartyAdjustment,
    createPartyInvoice,
    createPartyReceipt,
    setPartyActive,
    updateParty,
    type AdjustmentDirection,
    type AdjustmentType,
    type LedgerAdjustment,
    type LedgerData,
    type LedgerInvoice,
    type LedgerParty,
    type LedgerReceipt,
    type OpeningBalanceType,
    type PartyType,
    type ReceiptMethod,
} from './actions'

interface LedgerClientProps {
    initialData: LedgerData
}

type PartyForm = {
    name: string
    party_type: PartyType
    phone: string
    gstin: string
    address: string
    broker_name: string
    default_credit_days: string
    credit_limit: string
    opening_balance: string
    opening_balance_type: OpeningBalanceType
    risk_note: string
    is_active: boolean
}

type InvoiceForm = {
    party_id: string
    order_id: string
    invoice_number: string
    invoice_date: string
    due_date: string
    total_meters: string
    rate_per_m: string
    gst_percent: string
    notes: string
}

type ReceiptForm = {
    party_id: string
    invoice_id: string
    receipt_date: string
    amount: string
    method: ReceiptMethod
    reference_no: string
    notes: string
}

type AdjustmentForm = {
    party_id: string
    invoice_id: string
    adjustment_date: string
    adjustment_type: AdjustmentType
    direction: AdjustmentDirection
    amount: string
    notes: string
}

type Transaction = {
    id: string
    date: string
    type: 'opening' | 'invoice' | 'receipt' | 'adjustment'
    label: string
    debit: number
    credit: number
    notes: string | null
}

const partyTypeLabels: Record<PartyType, string> = {
    trader: 'Trader',
    processor: 'Processor',
    broker: 'Broker',
    supplier: 'Supplier',
    other: 'Other',
}

const adjustmentLabels: Record<AdjustmentType, string> = {
    shortage: 'Shortage',
    quality_claim: 'Quality claim',
    rate_difference: 'Rate difference',
    discount: 'Discount',
    bad_debt: 'Bad debt',
    other: 'Other',
}

const methodLabels: Record<ReceiptMethod, string> = {
    cash: 'Cash',
    upi: 'UPI',
    bank: 'Bank',
    cheque: 'Cheque',
    other: 'Other',
}

function getToday() {
    return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
    const date = new Date(`${dateStr}T00:00:00`)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
}

function toNumber(value: string, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

function formatDate(date: string) {
    return format(new Date(`${date}T00:00:00`), 'dd MMM yyyy')
}

function shortMoney(value: number) {
    return formatINR(value, { hideDecimals: Math.abs(value % 1) < 0.01 })
}

function emptyPartyForm(): PartyForm {
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

function partyToForm(party: LedgerParty): PartyForm {
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

function emptyInvoiceForm(party?: LedgerParty | null): InvoiceForm {
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

function emptyReceiptForm(party?: LedgerParty | null): ReceiptForm {
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

function emptyAdjustmentForm(party?: LedgerParty | null): AdjustmentForm {
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

function getBalanceTone(amount: number) {
    if (amount < -0.01) return 'text-sky-700 bg-sky-50 border-sky-200'
    if (amount > 0.01) return 'text-rose-700 bg-rose-50 border-rose-200'
    return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}

function getInvoiceStatusClass(invoice: LedgerInvoice) {
    if (invoice.status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (invoice.is_overdue) return 'bg-rose-50 text-rose-700 border-rose-200'
    if (invoice.status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (invoice.status === 'cancelled') return 'bg-zinc-100 text-zinc-500 border-zinc-200'
    return 'bg-slate-50 text-slate-700 border-slate-200'
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
    const [selectedPartyId, setSelectedPartyId] = useState(initialData.parties[0]?.id ?? '')
    const [partyDialogOpen, setPartyDialogOpen] = useState(false)
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
    const [editingParty, setEditingParty] = useState<LedgerParty | null>(null)
    const [partyForm, setPartyForm] = useState<PartyForm>(emptyPartyForm())
    const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(emptyInvoiceForm(initialData.parties[0]))
    const [receiptForm, setReceiptForm] = useState<ReceiptForm>(emptyReceiptForm(initialData.parties[0]))
    const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(emptyAdjustmentForm(initialData.parties[0]))

    const activeParties = useMemo(() => initialData.parties.filter(party => party.is_active), [initialData.parties])
    const selectedParty = useMemo(() => {
        return initialData.parties.find(party => party.id === selectedPartyId) ?? initialData.parties[0] ?? null
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

    const invoicePreview = useMemo(() => {
        const gross = toNumber(invoiceForm.total_meters) * toNumber(invoiceForm.rate_per_m)
        const gst = gross * (toNumber(invoiceForm.gst_percent) / 100)
        return { gross, gst, net: gross + gst }
    }, [invoiceForm.gst_percent, invoiceForm.rate_per_m, invoiceForm.total_meters])

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
                <Card className="overflow-hidden border-slate-200/80 shadow-sm">
                    <CardHeader className="space-y-4 border-b bg-slate-50/70">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-base font-black">Parties</CardTitle>
                            <Badge variant="secondary">{filteredParties.length}</Badge>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search party, GSTIN, phone..."
                                className="bg-white pl-9"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start px-0 text-xs font-bold text-slate-500 hover:bg-transparent"
                            onClick={() => setShowInactive(prev => !prev)}
                        >
                            {showInactive ? 'Hide archived parties' : 'Show archived parties'}
                        </Button>
                    </CardHeader>
                    <CardContent className="max-h-[720px] space-y-2 overflow-y-auto p-3">
                        {filteredParties.length === 0 ? (
                            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                                No parties yet. Add the trader or processor you sell grey fabric to.
                            </div>
                        ) : filteredParties.map(party => {
                            const selected = selectedParty?.id === party.id
                            const overLimit = party.credit_limit > 0 && party.outstanding > party.credit_limit
                            return (
                                <button
                                    key={party.id}
                                    onClick={() => setSelectedPartyId(party.id)}
                                    className={cn(
                                        'w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                                        selected ? 'border-teal-400 bg-teal-50/80 shadow-sm' : 'border-slate-200 bg-white',
                                        !party.is_active && 'opacity-60'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-black text-slate-950">{party.name}</p>
                                                {!party.is_active && <Badge variant="outline">Archived</Badge>}
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                {partyTypeLabels[party.party_type]}{party.broker_name ? ` · Broker: ${party.broker_name}` : ''}
                                            </p>
                                        </div>
                                        {party.overdue_amount > 0 && (
                                            <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                                                Overdue
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="mt-4 flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Outstanding</p>
                                            <p className={cn('mt-1 rounded-full border px-2.5 py-1 text-sm font-black tabular-nums', getBalanceTone(party.outstanding))}>
                                                {shortMoney(Math.abs(party.outstanding))}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs font-bold text-slate-500">
                                            {party.credit_limit > 0 ? `${Math.max(0, party.credit_used_pct ?? 0)}% used` : 'No limit set'}
                                            {overLimit && <p className="mt-1 text-rose-600">Limit crossed</p>}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </CardContent>
                </Card>

                {selectedParty ? (
                    <div className="space-y-5">
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <div className="h-1.5 bg-gradient-to-r from-teal-600 via-cyan-500 to-amber-400" />
                            <CardContent className="p-5 md:p-6">
                                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="bg-slate-50">{partyTypeLabels[selectedParty.party_type]}</Badge>
                                            {selectedParty.overdue_amount > 0 && (
                                                <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                                                    {selectedParty.overdue_invoice_count} overdue bill{selectedParty.overdue_invoice_count === 1 ? '' : 's'}
                                                </Badge>
                                            )}
                                            {selectedParty.credit_limit > 0 && selectedParty.outstanding > selectedParty.credit_limit && (
                                                <Badge className="border-amber-200 bg-amber-50 text-amber-800">Over credit limit</Badge>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
                                                <UserRound className="h-6 w-6 text-teal-700" />
                                                {selectedParty.name}
                                            </h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Credit {selectedParty.default_credit_days} days
                                                {selectedParty.credit_limit > 0 ? ` · Limit ${shortMoney(selectedParty.credit_limit)}` : ' · No credit limit set'}
                                                {selectedParty.phone ? ` · ${selectedParty.phone}` : ''}
                                            </p>
                                        </div>
                                        {selectedParty.risk_note && (
                                            <p className="max-w-2xl rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                                {selectedParty.risk_note}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
                                        <MiniStat label={selectedParty.outstanding >= 0 ? 'Receivable' : 'Credit'} value={shortMoney(Math.abs(selectedParty.outstanding))} tone={selectedParty.outstanding >= 0 ? 'rose' : 'sky'} />
                                        <MiniStat label="Overdue" value={shortMoney(selectedParty.overdue_amount)} tone="amber" />
                                        <MiniStat label="Collected" value={shortMoney(selectedParty.receipt_total)} tone="emerald" />
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-2">
                                    <Button className="bg-teal-700 hover:bg-teal-800" onClick={() => openInvoice(selectedParty)} disabled={!selectedParty.is_active}>
                                        <FileText className="mr-2 h-4 w-4" /> New Bill
                                    </Button>
                                    <Button variant="outline" onClick={() => openReceipt(selectedParty)} disabled={!selectedParty.is_active}>
                                        <Receipt className="mr-2 h-4 w-4" /> Record Receipt
                                    </Button>
                                    <Button variant="outline" onClick={() => openAdjustment(selectedParty)} disabled={!selectedParty.is_active}>
                                        <AlertTriangle className="mr-2 h-4 w-4" /> Claim / Deduction
                                    </Button>
                                    <Button variant="ghost" onClick={() => openEditParty(selectedParty)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit Party
                                    </Button>
                                    <Button variant="ghost" onClick={() => togglePartyActive(selectedParty)} disabled={isPending}>
                                        <Archive className="mr-2 h-4 w-4" /> {selectedParty.is_active ? 'Archive' : 'Restore'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-5 xl:grid-cols-2">
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
                                                {selectedInvoices.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-500">No bills recorded.</TableCell>
                                                    </TableRow>
                                                ) : selectedInvoices.map(invoice => (
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

                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base font-black">
                                        <BookOpen className="h-4 w-4 text-teal-700" /> Register
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
                                                {selectedTransactions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">No ledger entries yet.</TableCell>
                                                    </TableRow>
                                                ) : selectedTransactions.slice(0, 12).map(entry => (
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
                        </div>

                        <div className="grid gap-5 xl:grid-cols-2">
                            <SimpleListCard
                                title="Recent receipts"
                                empty="No receipts yet."
                                rows={selectedReceipts.slice(0, 5).map(receipt => ({
                                    id: receipt.id,
                                    title: `${methodLabels[receipt.method]} · ${shortMoney(receipt.amount)}`,
                                    meta: `${formatDate(receipt.receipt_date)}${receipt.reference_no ? ` · ${receipt.reference_no}` : ''}`,
                                }))}
                            />
                            <SimpleListCard
                                title="Claims and deductions"
                                empty="No adjustments yet."
                                rows={selectedAdjustments.slice(0, 5).map(adjustment => ({
                                    id: adjustment.id,
                                    title: `${adjustmentLabels[adjustment.adjustment_type]} · ${shortMoney(adjustment.amount)}`,
                                    meta: `${formatDate(adjustment.adjustment_date)} · ${adjustment.direction === 'credit_to_party' ? 'Credit to party' : 'Debit to party'}`,
                                }))}
                            />
                        </div>
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center">
                            <BookOpen className="h-12 w-12 text-slate-300" />
                            <h2 className="mt-4 text-xl font-black">Start with your first party</h2>
                            <p className="mt-2 max-w-md text-sm text-slate-500">
                                Add a trader, processor, or buyer, then record bills and receipts the way you would in a physical ledger.
                            </p>
                            <Button className="mt-5 bg-teal-700 hover:bg-teal-800" onClick={openAddParty}>
                                <Plus className="mr-2 h-4 w-4" /> Add Party
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </section>

            <Dialog open={partyDialogOpen} onOpenChange={setPartyDialogOpen}>
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
                            <Input value={partyForm.phone} onChange={event => setPartyForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="10 digit business number" inputMode="numeric" />
                        </Field>
                        <Field label="GSTIN">
                            <Input value={partyForm.gstin} onChange={event => setPartyForm(prev => ({ ...prev, gstin: event.target.value.toUpperCase() }))} placeholder="Optional" />
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
                        <Button variant="outline" onClick={() => setPartyDialogOpen(false)}>Cancel</Button>
                        <Button onClick={submitParty} disabled={isPending} className="bg-teal-700 hover:bg-teal-800">
                            {isPending ? 'Saving...' : editingParty ? 'Save changes' : 'Add party'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Record new bill</DialogTitle>
                        <DialogDescription>
                            Enter the grey fabric bill: party, meters, rate, GST, and due date.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Party" className="md:col-span-2">
                            <Select value={invoiceForm.party_id || undefined} onValueChange={handleInvoicePartyChange} disabled={activeParties.length === 0}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Select party" /></SelectTrigger>
                                <SelectContent>
                                    {activeParties.map(party => <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Bill number">
                            <Input value={invoiceForm.invoice_number} onChange={event => setInvoiceForm(prev => ({ ...prev, invoice_number: event.target.value }))} placeholder="Auto if blank" />
                        </Field>
                        <Field label="Link order">
                            <Select value={invoiceForm.order_id} onValueChange={value => setInvoiceForm(prev => ({ ...prev, order_id: value }))}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No order link</SelectItem>
                                    {initialData.orders.map(order => (
                                        <SelectItem key={order.id} value={order.id}>{order.party_name} · {order.quality_label ?? 'Order'} · {order.total_target_meters.toLocaleString('en-IN')}m</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Bill date">
                            <Input value={invoiceForm.invoice_date} onChange={event => handleInvoiceDateChange(event.target.value)} type="date" />
                        </Field>
                        <Field label="Due date">
                            <Input value={invoiceForm.due_date} onChange={event => setInvoiceForm(prev => ({ ...prev, due_date: event.target.value }))} type="date" />
                        </Field>
                        <Field label="Meters">
                            <Input value={invoiceForm.total_meters} onChange={event => setInvoiceForm(prev => ({ ...prev, total_meters: event.target.value }))} type="number" min="0" step="0.01" placeholder="0" />
                        </Field>
                        <Field label="Rate / meter">
                            <Input value={invoiceForm.rate_per_m} onChange={event => setInvoiceForm(prev => ({ ...prev, rate_per_m: event.target.value }))} type="number" min="0" step="0.01" placeholder="0" />
                        </Field>
                        <Field label="GST %">
                            <Input value={invoiceForm.gst_percent} onChange={event => setInvoiceForm(prev => ({ ...prev, gst_percent: event.target.value }))} type="number" min="0" step="0.01" />
                        </Field>
                        <div className="rounded-2xl border bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Bill preview</p>
                            <div className="mt-2 space-y-1 text-sm font-bold text-slate-700">
                                <div className="flex justify-between"><span>Gross</span><span>{shortMoney(invoicePreview.gross)}</span></div>
                                <div className="flex justify-between"><span>GST</span><span>{shortMoney(invoicePreview.gst)}</span></div>
                                <div className="flex justify-between border-t pt-2 text-base text-slate-950"><span>Net</span><span>{shortMoney(invoicePreview.net)}</span></div>
                            </div>
                        </div>
                        <Field label="Notes" className="md:col-span-2">
                            <Textarea value={invoiceForm.notes} onChange={event => setInvoiceForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Optional delivery, quality, or broker note" />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
                        <Button onClick={submitInvoice} disabled={isPending || !invoiceForm.party_id} className="bg-teal-700 hover:bg-teal-800">
                            {isPending ? 'Saving...' : 'Record bill'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
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
                                    {receiptInvoiceOptions.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · Bal {shortMoney(invoice.balance_amount)}</SelectItem>)}
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
                        <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>Cancel</Button>
                        <Button onClick={submitReceipt} disabled={isPending || !receiptForm.party_id} className="bg-teal-700 hover:bg-teal-800">
                            {isPending ? 'Saving...' : 'Record receipt'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
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
                                    {adjustmentInvoiceOptions.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {shortMoney(invoice.balance_amount)}</SelectItem>)}
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
                        <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>Cancel</Button>
                        <Button onClick={submitAdjustment} disabled={isPending || !adjustmentForm.party_id} className="bg-teal-700 hover:bg-teal-800">
                            {isPending ? 'Saving...' : 'Record adjustment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
    return (
        <div className={cn('space-y-2', className)}>
            <Label className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</Label>
            {children}
            {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
    )
}
