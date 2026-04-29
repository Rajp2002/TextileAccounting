'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, BookOpen, Clock, HandCoins, WalletCards, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

import {
    createParty,
    createPartyAdjustment,
    createPartyInvoice,
    createPartyReceipt,
    createSupplier,
    createSupplierLedgerEntry,
    setPartyActive,
    updateParty,
    updateSupplier,
    type LedgerAdjustment,
    type LedgerData,
    type LedgerInvoice,
    type LedgerParty,
    type LedgerReceipt,
    type LedgerSupplier,
} from './actions'
import {
    AdjustmentFormType,
    InvoiceFormType,
    PartyFormType,
    ReceiptFormType,
    SupplierEntryFormType,
    SupplierFormType,
    Transaction,
} from './types'
import { adjustmentLabels, methodLabels, shortMoney, toNumber } from './utils'
import { PartyList } from './components/PartyList'
import { PartyDetails } from './components/PartyDetails'
import { PartyFormModal } from './components/PartyFormModal'
import { InvoiceFormModal } from './components/InvoiceFormModal'
import { ReceiptFormModal } from './components/ReceiptFormModal'
import { AdjustmentFormModal } from './components/AdjustmentFormModal'
import { SupplierList } from './components/SupplierList'
import { SupplierDetails } from './components/SupplierDetails'
import { SupplierFormModal } from './components/SupplierFormModal'
import { SupplierEntryFormModal } from './components/SupplierEntryFormModal'

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
        allocate_across_invoices: false,
        allocations: [],
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

function emptySupplierForm(): SupplierFormType {
    return {
        name: '',
        phone: '',
        gst_number: '',
        notes: '',
    }
}

function supplierToForm(supplier: LedgerSupplier): SupplierFormType {
    return {
        name: supplier.name,
        phone: supplier.phone ?? '',
        gst_number: supplier.gst_number ?? '',
        notes: supplier.notes ?? '',
    }
}

function emptySupplierEntryForm(supplier?: LedgerSupplier | null, type: 'purchase' | 'payment' = 'purchase'): SupplierEntryFormType {
    return {
        supplier_id: supplier?.id ?? '',
        type,
        amount: '',
        entry_date: getToday(),
        note: '',
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
    const { t } = useTranslation()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [activeTab, setActiveTab] = useState<'parties' | 'suppliers'>('parties')
    const [search, setSearch] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [selectedPartyId, setSelectedPartyId] = useState<string | null>(initialData.parties[0]?.id ?? null)
    const [supplierSearch, setSupplierSearch] = useState('')
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(initialData.suppliers[0]?.id ?? null)
    const [partyDialogOpen, setPartyDialogOpen] = useState(false)
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
    const [supplierEntryDialogOpen, setSupplierEntryDialogOpen] = useState(false)
    const [editingParty, setEditingParty] = useState<LedgerParty | null>(null)
    const [editingSupplier, setEditingSupplier] = useState<LedgerSupplier | null>(null)
    const [partyForm, setPartyForm] = useState<PartyFormType>(emptyPartyForm())
    const [invoiceForm, setInvoiceForm] = useState<InvoiceFormType>(emptyInvoiceForm(initialData.parties[0]))
    const [receiptForm, setReceiptForm] = useState<ReceiptFormType>(emptyReceiptForm(initialData.parties[0]))
    const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormType>(emptyAdjustmentForm(initialData.parties[0]))
    const [supplierForm, setSupplierForm] = useState<SupplierFormType>(emptySupplierForm())
    const [supplierEntryForm, setSupplierEntryForm] = useState<SupplierEntryFormType>(emptySupplierEntryForm(initialData.suppliers[0]))

    const activeParties = useMemo(() => initialData.parties.filter(party => party.is_active), [initialData.parties])
    const selectedParty = useMemo(() => {
        if (!selectedPartyId) return null
        return initialData.parties.find(party => party.id === selectedPartyId) ?? null
    }, [initialData.parties, selectedPartyId])

    const selectedSupplier = useMemo(() => {
        if (!selectedSupplierId) return null
        return initialData.suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null
    }, [initialData.suppliers, selectedSupplierId])

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

    const filteredSuppliers = useMemo(() => {
        const q = supplierSearch.trim().toLowerCase()
        return initialData.suppliers.filter((supplier) => {
            if (!q) return true
            return [supplier.name, supplier.phone, supplier.gst_number]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(q))
        })
    }, [initialData.suppliers, supplierSearch])

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
    const selectedSupplierEntries = useMemo(() => {
        if (!selectedSupplier) return []
        return initialData.supplierEntries.filter((entry) => entry.supplier_id === selectedSupplier.id)
    }, [initialData.supplierEntries, selectedSupplier])

    const receiptInvoiceOptions = initialData.invoices.filter(invoice => (
        invoice.party_id === receiptForm.party_id &&
        invoice.status !== 'cancelled' &&
        invoice.balance_amount > 0.01
    ))

    const receiptAllocatedTotal = useMemo(() => {
        return receiptForm.allocations.reduce((sum, allocation) => sum + toNumber(allocation.allocated_amount), 0)
    }, [receiptForm.allocations])

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

    function openAddSupplier() {
        setEditingSupplier(null)
        setSupplierForm(emptySupplierForm())
        setSupplierDialogOpen(true)
    }

    function openEditSupplier(supplier: LedgerSupplier) {
        setEditingSupplier(supplier)
        setSupplierForm(supplierToForm(supplier))
        setSupplierDialogOpen(true)
    }

    function openSupplierEntry(supplier?: LedgerSupplier | null, type: 'purchase' | 'payment' = 'purchase') {
        const fallback = supplier ?? selectedSupplier ?? initialData.suppliers[0] ?? null
        setSupplierEntryForm(emptySupplierEntryForm(fallback, type))
        setSupplierEntryDialogOpen(true)
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

            refreshAfter(editingParty ? t('ledger.party.updated') : t('ledger.party.added'), () => setPartyDialogOpen(false))
        })
    }

    async function submitInvoice() {
        if (!invoiceForm.party_id) {
            toast.error(t('ledger.party.selectFirst'))
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

            refreshAfter(t('ledger.invoice.recorded'), () => setInvoiceDialogOpen(false))
        })
    }

    async function submitReceipt() {
        if (!receiptForm.party_id) {
            toast.error(t('ledger.party.selectFirst'))
            return
        }

        startTransition(async () => {
            const result = await createPartyReceipt({
                ...receiptForm,
                invoice_id: receiptForm.invoice_id === 'none' ? '' : receiptForm.invoice_id,
                amount: toNumber(receiptForm.amount),
                allocations: receiptForm.allocate_across_invoices
                    ? receiptForm.allocations
                        .map((allocation) => ({
                            invoice_id: allocation.invoice_id,
                            allocated_amount: toNumber(allocation.allocated_amount),
                        }))
                        .filter((allocation) => allocation.allocated_amount > 0)
                    : [],
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter(t('ledger.receipt.receiptRecorded'), () => setReceiptDialogOpen(false))
        })
    }

    async function submitAdjustment() {
        if (!adjustmentForm.party_id) {
            toast.error(t('ledger.party.selectFirst'))
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

            refreshAfter(t('ledger.adjustment.recorded'), () => setAdjustmentDialogOpen(false))
        })
    }

    async function togglePartyActive(party: LedgerParty) {
        startTransition(async () => {
            const result = await setPartyActive(party.id, !party.is_active)
            if ('error' in result) {
                toast.error(result.error)
                return
            }
            refreshAfter(party.is_active ? t('ledger.party.archived') : t('ledger.party.restored'))
        })
    }

    async function submitSupplier() {
        startTransition(async () => {
            const result = editingSupplier
                ? await updateSupplier(editingSupplier.id, supplierForm)
                : await createSupplier(supplierForm)

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter(editingSupplier ? t('ledger.supplier.updated') : t('ledger.supplier.added'), () => setSupplierDialogOpen(false))
        })
    }

    async function submitSupplierEntry() {
        if (!supplierEntryForm.supplier_id) {
            toast.error(t('ledger.supplier.selectFirst'))
            return
        }

        startTransition(async () => {
            const result = await createSupplierLedgerEntry({
                ...supplierEntryForm,
                amount: toNumber(supplierEntryForm.amount),
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            refreshAfter(
                supplierEntryForm.type === 'purchase' ? t('suppliers.entry.recordPurchase') : t('suppliers.entry.recordPayment'),
                () => setSupplierEntryDialogOpen(false)
            )
        })
    }

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_34%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#ecfeff_100%)] p-5 shadow-sm md:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl space-y-3">
                        <Badge variant="outline" className="border-teal-200 bg-white/70 text-teal-800">
                            {t('ledger.heroBadge')}
                        </Badge>
                        <div>
                            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                                <BookOpen className="h-8 w-8 text-teal-700" />
                                {t('ledger.pageTitle')}
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                                {t('ledger.pageDescription')}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="flex rounded-2xl border border-slate-200 bg-white/80 p-1">
                            <Button variant={activeTab === 'parties' ? 'default' : 'ghost'} className={cn('rounded-xl', activeTab === 'parties' ? 'bg-slate-900 text-white hover:bg-slate-900' : '')} onClick={() => setActiveTab('parties')}>
                                {t('ledger.tabs.parties')}
                            </Button>
                            <Button variant={activeTab === 'suppliers' ? 'default' : 'ghost'} className={cn('rounded-xl', activeTab === 'suppliers' ? 'bg-slate-900 text-white hover:bg-slate-900' : '')} onClick={() => setActiveTab('suppliers')}>
                                {t('ledger.tabs.suppliers')}
                            </Button>
                        </div>
                        {activeTab === 'parties' ? (
                            <>
                                <Button variant="outline" className="bg-white/80" onClick={openAddParty}>
                                    <Plus className="mr-2 h-4 w-4" /> {t('emptyState.ledger.addParty')}
                                </Button>
                                <Button className="bg-teal-700 hover:bg-teal-800" onClick={() => openInvoice()} disabled={activeParties.length === 0}>
                                    <FileText className="mr-2 h-4 w-4" /> {t('ledger.invoice.submit')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" className="bg-white/80" onClick={openAddSupplier}>
                                    <Plus className="mr-2 h-4 w-4" /> {t('suppliers.addSupplier')}
                                </Button>
                                <Button className="bg-indigo-700 hover:bg-indigo-800" onClick={() => openSupplierEntry(undefined, 'purchase')} disabled={initialData.suppliers.length === 0}>
                                    <FileText className="mr-2 h-4 w-4" /> {t('suppliers.entry.recordPurchase')}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {activeTab === 'parties' ? (
                    <>
                        <MetricCard title={t('ledger.metrics.receivable')} value={shortMoney(totals.receivable)} helper={t('ledger.metrics.receivableHelp')} icon={WalletCards} tone="teal" />
                        <MetricCard title={t('ledger.metrics.overdue')} value={shortMoney(totals.overdue)} helper={t('ledger.metrics.overdueHelp')} icon={Clock} tone="rose" />
                        <MetricCard title={t('ledger.metrics.payable')} value={shortMoney(totals.payable)} helper={t('ledger.metrics.payableHelp')} icon={HandCoins} tone="sky" />
                        <MetricCard title={t('ledger.metrics.creditRisk')} value={String(totals.overLimit)} helper={t('ledger.metrics.creditRiskHelp')} icon={AlertTriangle} tone="amber" />
                    </>
                ) : (
                    <>
                        <MetricCard title={t('ledger.metrics.suppliers')} value={String(initialData.suppliers.length)} helper={t('ledger.metrics.suppliersHelp')} icon={BookOpen} tone="teal" />
                        <MetricCard title={t('suppliers.entry.purchasesMetric')} value={shortMoney(initialData.supplierEntries.filter(entry => entry.type === 'purchase').reduce((sum, entry) => sum + entry.amount, 0))} helper={t('ledger.metrics.purchasesHelp')} icon={FileText} tone="amber" />
                        <MetricCard title={t('suppliers.entry.paymentsMetric')} value={shortMoney(initialData.supplierEntries.filter(entry => entry.type === 'payment').reduce((sum, entry) => sum + entry.amount, 0))} helper={t('ledger.metrics.paymentsHelp')} icon={HandCoins} tone="sky" />
                        <MetricCard title={t('suppliers.balance')} value={shortMoney(initialData.suppliers.reduce((sum, supplier) => sum + Math.max(0, supplier.balance), 0))} helper={t('ledger.metrics.supplierPayableHelp')} icon={AlertTriangle} tone="rose" />
                    </>
                )}
            </section>

            {activeTab === 'parties' ? (
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
            ) : (
                <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
                    <SupplierList
                        suppliers={filteredSuppliers}
                        search={supplierSearch}
                        onSearchChange={setSupplierSearch}
                        selectedSupplierId={selectedSupplierId}
                        onSelectSupplier={setSelectedSupplierId}
                    />
                    <SupplierDetails
                        supplier={selectedSupplier}
                        entries={selectedSupplierEntries}
                        onOpenAddSupplier={openAddSupplier}
                        onOpenEditSupplier={openEditSupplier}
                        onOpenEntry={openSupplierEntry}
                    />
                </section>
            )}

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
                allocatedTotal={receiptAllocatedTotal}
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

            <SupplierFormModal
                open={supplierDialogOpen}
                onOpenChange={setSupplierDialogOpen}
                supplierForm={supplierForm}
                setSupplierForm={setSupplierForm}
                editing={!!editingSupplier}
                isPending={isPending}
                onSubmit={submitSupplier}
            />

            <SupplierEntryFormModal
                open={supplierEntryDialogOpen}
                onOpenChange={setSupplierEntryDialogOpen}
                entryForm={supplierEntryForm}
                setEntryForm={setSupplierEntryForm}
                suppliers={initialData.suppliers}
                isPending={isPending}
                onSubmit={submitSupplierEntry}
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
