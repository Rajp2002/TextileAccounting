'use server'

import Decimal from 'decimal.js'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
    CreateSupplierLedgerEntrySchema,
    CreateSupplierSchema,
    CreatePartyAdjustmentSchema,
    CreatePartyInvoiceSchema,
    CreatePartyReceiptSchema,
    CreatePartySchema,
    UpdatePartySchema,
    safeParse,
    UuidSchema,
} from '@/lib/schemas'

export type PartyType = 'trader' | 'processor' | 'broker' | 'supplier' | 'other'
export type OpeningBalanceType = 'receivable' | 'payable'
export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled'
export type ReceiptMethod = 'cash' | 'upi' | 'bank' | 'cheque' | 'other'
export type AdjustmentType = 'shortage' | 'quality_claim' | 'rate_difference' | 'discount' | 'bad_debt' | 'other'
export type AdjustmentDirection = 'credit_to_party' | 'debit_to_party'

export interface LedgerParty {
    id: string
    org_id: string
    name: string
    party_type: PartyType
    phone: string | null
    gstin: string | null
    address: string | null
    broker_name: string | null
    default_credit_days: number
    credit_limit: number
    opening_balance: number
    opening_balance_type: OpeningBalanceType
    risk_note: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    invoice_total: number
    receipt_total: number
    adjustment_debits: number
    adjustment_credits: number
    outstanding: number
    overdue_amount: number
    overdue_invoice_count: number
    credit_used_pct: number | null
    last_activity_at: string | null
}

export interface LedgerInvoice {
    id: string
    org_id: string
    party_id: string
    order_id: string | null
    invoice_number: string
    invoice_date: string
    due_date: string
    total_meters: number
    rate_per_m: number
    gross_amount: number
    gst_percent: number
    gst_amount: number
    net_amount: number
    status: InvoiceStatus
    notes: string | null
    created_at: string
    paid_amount: number
    credit_adjustments: number
    debit_adjustments: number
    balance_amount: number
    is_overdue: boolean
    days_overdue: number
}

export interface LedgerReceipt {
    id: string
    org_id: string
    party_id: string
    invoice_id: string | null
    receipt_date: string
    amount: number
    method: ReceiptMethod
    reference_no: string | null
    notes: string | null
    created_at: string
}

export interface LedgerAdjustment {
    id: string
    org_id: string
    party_id: string
    invoice_id: string | null
    adjustment_date: string
    adjustment_type: AdjustmentType
    direction: AdjustmentDirection
    amount: number
    notes: string | null
    created_at: string
}

export interface LedgerOrderOption {
    id: string
    party_name: string
    quality_label: string | null
    total_target_meters: number
    status: string
}

export interface LedgerData {
    parties: LedgerParty[]
    invoices: LedgerInvoice[]
    receipts: LedgerReceipt[]
    adjustments: LedgerAdjustment[]
    orders: LedgerOrderOption[]
    suppliers: LedgerSupplier[]
    supplierEntries: SupplierLedgerEntry[]
    paymentAllocations: PaymentAllocation[]
}

export interface PaymentAllocation {
    id: string
    org_id: string
    party_receipt_id: string
    invoice_id: string
    allocated_amount: number
    created_at: string
}

export interface LedgerSupplier {
    id: string
    org_id: string
    name: string
    phone: string | null
    gst_number: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    purchase_total: number
    payment_total: number
    balance: number
    last_activity_at: string | null
}

export interface SupplierLedgerEntry {
    id: string
    org_id: string
    supplier_id: string
    type: 'purchase' | 'payment'
    amount: number
    note: string | null
    entry_date: string
    created_at: string
}

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

type RawParty = Omit<LedgerParty,
    | 'invoice_total'
    | 'receipt_total'
    | 'adjustment_debits'
    | 'adjustment_credits'
    | 'outstanding'
    | 'overdue_amount'
    | 'overdue_invoice_count'
    | 'credit_used_pct'
    | 'last_activity_at'
>

type RawInvoice = Omit<LedgerInvoice,
    | 'paid_amount'
    | 'credit_adjustments'
    | 'debit_adjustments'
    | 'balance_amount'
    | 'is_overdue'
    | 'days_overdue'
>

type RawSupplier = Omit<
    LedgerSupplier,
    'purchase_total' | 'payment_total' | 'balance' | 'last_activity_at'
>

const LEDGER_PATH = '/owner/ledger'

function money(value: string | number | null | undefined): number {
    return Number(new Decimal(value ?? 0).toFixed(2))
}

function toDbText(value: string | null | undefined): string | null {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function toDbUuid(value: string | null | undefined): string | null {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function todayDateString() {
    return new Date().toISOString().slice(0, 10)
}

function daysBetween(fromDate: string, toDate: string) {
    const from = new Date(`${fromDate}T00:00:00.000Z`).getTime()
    const to = new Date(`${toDate}T00:00:00.000Z`).getTime()
    return Math.max(0, Math.floor((to - from) / 86_400_000))
}

function latestDate(...dates: Array<string | null | undefined>) {
    const present = dates.filter(Boolean) as string[]
    if (present.length === 0) return null
    return present.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function normalizeParty(row: RawParty): RawParty {
    return {
        ...row,
        default_credit_days: Number(row.default_credit_days ?? 30),
        credit_limit: money(row.credit_limit),
        opening_balance: money(row.opening_balance),
    }
}

function normalizeInvoice(row: RawInvoice): RawInvoice {
    return {
        ...row,
        total_meters: money(row.total_meters),
        rate_per_m: Number(new Decimal(row.rate_per_m ?? 0).toFixed(4)),
        gross_amount: money(row.gross_amount),
        gst_percent: Number(new Decimal(row.gst_percent ?? 0).toFixed(2)),
        gst_amount: money(row.gst_amount),
        net_amount: money(row.net_amount),
    }
}

function normalizeReceipt(row: LedgerReceipt): LedgerReceipt {
    return { ...row, amount: money(row.amount) }
}

function normalizeAdjustment(row: LedgerAdjustment): LedgerAdjustment {
    return { ...row, amount: money(row.amount) }
}

function normalizeOrder(row: LedgerOrderOption): LedgerOrderOption {
    return { ...row, total_target_meters: money(row.total_target_meters) }
}

function normalizePaymentAllocation(row: PaymentAllocation): PaymentAllocation {
    return { ...row, allocated_amount: money(row.allocated_amount) }
}

function normalizeSupplier(row: RawSupplier): RawSupplier {
    return { ...row }
}

function normalizeSupplierEntry(row: SupplierLedgerEntry): SupplierLedgerEntry {
    return { ...row, amount: money(row.amount) }
}

function getOpeningSigned(party: RawParty) {
    return party.opening_balance_type === 'receivable'
        ? money(party.opening_balance)
        : -money(party.opening_balance)
}

function invoiceBalance(
    invoice: RawInvoice,
    receipts: LedgerReceipt[],
    adjustments: LedgerAdjustment[],
    allocations: PaymentAllocation[]
) {
    const directPaid = receipts
        .filter(receipt => receipt.invoice_id === invoice.id)
        .reduce((sum, receipt) => sum.plus(receipt.amount), new Decimal(0))

    const allocatedPaid = allocations
        .filter(allocation => allocation.invoice_id === invoice.id)
        .reduce((sum, allocation) => sum.plus(allocation.allocated_amount), new Decimal(0))

    const credits = adjustments
        .filter(adj => adj.invoice_id === invoice.id && adj.direction === 'credit_to_party')
        .reduce((sum, adj) => sum.plus(adj.amount), new Decimal(0))

    const debits = adjustments
        .filter(adj => adj.invoice_id === invoice.id && adj.direction === 'debit_to_party')
        .reduce((sum, adj) => sum.plus(adj.amount), new Decimal(0))

    const paid = directPaid.plus(allocatedPaid)
    const balance = Decimal.max(0, new Decimal(invoice.net_amount).plus(debits).minus(paid).minus(credits))

    return {
        paid: money(paid.toString()),
        credits: money(credits.toString()),
        debits: money(debits.toString()),
        balance: money(balance.toString()),
    }
}

function enrichInvoices(
    invoices: RawInvoice[],
    receipts: LedgerReceipt[],
    adjustments: LedgerAdjustment[],
    allocations: PaymentAllocation[]
): LedgerInvoice[] {
    const today = todayDateString()

    return invoices.map(invoice => {
        const balance = invoiceBalance(invoice, receipts, adjustments, allocations)
        const isOverdue = invoice.status !== 'cancelled' && balance.balance > 0.01 && invoice.due_date < today

        return {
            ...invoice,
            paid_amount: balance.paid,
            credit_adjustments: balance.credits,
            debit_adjustments: balance.debits,
            balance_amount: balance.balance,
            is_overdue: isOverdue,
            days_overdue: isOverdue ? daysBetween(invoice.due_date, today) : 0,
        }
    })
}

function buildPartySummaries(
    parties: RawParty[],
    invoices: LedgerInvoice[],
    receipts: LedgerReceipt[],
    adjustments: LedgerAdjustment[]
): LedgerParty[] {
    return parties.map(party => {
        const partyInvoices = invoices.filter(invoice => invoice.party_id === party.id && invoice.status !== 'cancelled' && invoice.status !== 'draft')
        const partyReceipts = receipts.filter(receipt => receipt.party_id === party.id)
        const partyAdjustments = adjustments.filter(adjustment => adjustment.party_id === party.id)

        const invoiceTotal = partyInvoices.reduce((sum, invoice) => sum.plus(invoice.net_amount), new Decimal(0))
        const receiptTotal = partyReceipts.reduce((sum, receipt) => sum.plus(receipt.amount), new Decimal(0))
        const adjustmentDebits = partyAdjustments
            .filter(adj => adj.direction === 'debit_to_party')
            .reduce((sum, adj) => sum.plus(adj.amount), new Decimal(0))
        const adjustmentCredits = partyAdjustments
            .filter(adj => adj.direction === 'credit_to_party')
            .reduce((sum, adj) => sum.plus(adj.amount), new Decimal(0))

        const outstanding = new Decimal(getOpeningSigned(party))
            .plus(invoiceTotal)
            .plus(adjustmentDebits)
            .minus(receiptTotal)
            .minus(adjustmentCredits)

        const overdueInvoices = partyInvoices.filter(invoice => invoice.is_overdue)
        const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum.plus(invoice.balance_amount), new Decimal(0))
        const creditLimit = new Decimal(party.credit_limit || 0)
        const outstandingMoney = money(outstanding.toString())

        return {
            ...party,
            invoice_total: money(invoiceTotal.toString()),
            receipt_total: money(receiptTotal.toString()),
            adjustment_debits: money(adjustmentDebits.toString()),
            adjustment_credits: money(adjustmentCredits.toString()),
            outstanding: outstandingMoney,
            overdue_amount: money(overdueAmount.toString()),
            overdue_invoice_count: overdueInvoices.length,
            credit_used_pct: creditLimit.gt(0) ? Number(new Decimal(outstandingMoney).div(creditLimit).times(100).toFixed(1)) : null,
            last_activity_at: latestDate(
                ...partyInvoices.map(invoice => invoice.created_at),
                ...partyReceipts.map(receipt => receipt.created_at),
                ...partyAdjustments.map(adjustment => adjustment.created_at),
                party.updated_at
            ),
        }
    }).sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        return Math.abs(b.outstanding) - Math.abs(a.outstanding)
    })
}

function buildSupplierSummaries(
    suppliers: RawSupplier[],
    entries: SupplierLedgerEntry[]
): LedgerSupplier[] {
    return suppliers.map((supplier) => {
        const supplierEntries = entries.filter((entry) => entry.supplier_id === supplier.id)
        const purchaseTotal = supplierEntries
            .filter((entry) => entry.type === 'purchase')
            .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
        const paymentTotal = supplierEntries
            .filter((entry) => entry.type === 'payment')
            .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))

        return {
            ...supplier,
            purchase_total: money(purchaseTotal.toString()),
            payment_total: money(paymentTotal.toString()),
            balance: money(purchaseTotal.minus(paymentTotal).toString()),
            last_activity_at: latestDate(
                ...supplierEntries.map((entry) => entry.created_at),
                supplier.updated_at
            ),
        }
    }).sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        return Math.abs(b.balance) - Math.abs(a.balance)
    })
}

async function generateInvoiceNumber(supabase: SupabaseServerClient, orgId: string) {
    const prefix = `INV-${todayDateString().replace(/-/g, '')}`
    const { count } = await supabase
        .from('party_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .ilike('invoice_number', `${prefix}%`)

    return `${prefix}-${String((count ?? 0) + 1).padStart(3, '0')}`
}

async function assertPartyBelongsToOrg(supabase: SupabaseServerClient, orgId: string, partyId: string) {
    const { data, error } = await supabase
        .from('parties')
        .select('id')
        .eq('id', partyId)
        .eq('org_id', orgId)
        .maybeSingle()

    if (error || !data) throw new Error('Party not found')
}

async function assertInvoiceMatchesParty(
    supabase: SupabaseServerClient,
    orgId: string,
    partyId: string,
    invoiceId: string | null
) {
    if (!invoiceId) return

    const { data, error } = await supabase
        .from('party_invoices')
        .select('id, party_id')
        .eq('id', invoiceId)
        .eq('org_id', orgId)
        .maybeSingle()

    if (error || !data || data.party_id !== partyId) {
        throw new Error('Invoice does not belong to this party')
    }
}

async function refreshInvoiceStatus(supabase: SupabaseServerClient, orgId: string, invoiceId: string | null) {
    if (!invoiceId) return

    const [invoiceResult, receiptsResult, adjustmentsResult, allocationsResult] = await Promise.all([
        supabase
            .from('party_invoices')
            .select('id, org_id, party_id, order_id, invoice_number, invoice_date, due_date, total_meters, rate_per_m, gross_amount, gst_percent, gst_amount, net_amount, status, notes, created_at')
            .eq('id', invoiceId)
            .eq('org_id', orgId)
            .maybeSingle(),
        supabase
            .from('party_receipts')
            .select('id, org_id, party_id, invoice_id, receipt_date, amount, method, reference_no, notes, created_at')
            .eq('invoice_id', invoiceId)
            .eq('org_id', orgId),
        supabase
            .from('party_adjustments')
            .select('id, org_id, party_id, invoice_id, adjustment_date, adjustment_type, direction, amount, notes, created_at')
            .eq('invoice_id', invoiceId)
            .eq('org_id', orgId),
        supabase
            .from('payment_allocations')
            .select('id, org_id, party_receipt_id, invoice_id, allocated_amount, created_at')
            .eq('invoice_id', invoiceId)
            .eq('org_id', orgId),
    ])

    if (invoiceResult.error || !invoiceResult.data || invoiceResult.data.status === 'cancelled') return

    const invoice = normalizeInvoice(invoiceResult.data as RawInvoice)
    const receipts = ((receiptsResult.data ?? []) as LedgerReceipt[]).map(normalizeReceipt)
    const adjustments = ((adjustmentsResult.data ?? []) as LedgerAdjustment[]).map(normalizeAdjustment)
    const normalizedAllocations = ((allocationsResult.data ?? []) as PaymentAllocation[]).map(normalizePaymentAllocation)
    const balance = invoiceBalance(invoice, receipts, adjustments, normalizedAllocations)
    const hasActivity = receipts.length > 0 || normalizedAllocations.length > 0 || adjustments.some(adj => adj.direction === 'credit_to_party')
    const status: InvoiceStatus = balance.balance <= 0.01 ? 'paid' : hasActivity ? 'partial' : 'unpaid'

    await supabase
        .from('party_invoices')
        .update({ status })
        .eq('id', invoiceId)
        .eq('org_id', orgId)
}

export async function getLedgerData(): Promise<{ data: LedgerData } | { error: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const [partiesResult, invoicesResult, receiptsResult, adjustmentsResult, ordersResult, suppliersResult, supplierEntriesResult, paymentAllocationsResult] = await Promise.all([
        supabase
            .from('parties')
            .select('id, org_id, name, party_type, phone, gstin, address, broker_name, default_credit_days, credit_limit, opening_balance, opening_balance_type, risk_note, is_active, created_at, updated_at')
            .eq('org_id', profile.org_id)
            .order('name', { ascending: true }),
        supabase
            .from('party_invoices')
            .select('id, org_id, party_id, order_id, invoice_number, invoice_date, due_date, total_meters, rate_per_m, gross_amount, gst_percent, gst_amount, net_amount, status, notes, created_at')
            .eq('org_id', profile.org_id)
            .order('invoice_date', { ascending: false }),
        supabase
            .from('party_receipts')
            .select('id, org_id, party_id, invoice_id, receipt_date, amount, method, reference_no, notes, created_at')
            .eq('org_id', profile.org_id)
            .order('receipt_date', { ascending: false }),
        supabase
            .from('party_adjustments')
            .select('id, org_id, party_id, invoice_id, adjustment_date, adjustment_type, direction, amount, notes, created_at')
            .eq('org_id', profile.org_id)
            .order('adjustment_date', { ascending: false }),
        supabase
            .from('orders')
            .select('id, party_name, quality_label, total_target_meters, status')
            .eq('org_id', profile.org_id)
            .in('status', ['active', 'completed'])
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('suppliers')
            .select('id, org_id, name, phone, gst_number, notes, is_active, created_at, updated_at')
            .eq('org_id', profile.org_id)
            .order('name', { ascending: true }),
        supabase
            .from('supplier_ledger_entries')
            .select('id, org_id, supplier_id, type, amount, note, entry_date, created_at')
            .eq('org_id', profile.org_id)
            .order('entry_date', { ascending: false }),
        supabase
            .from('payment_allocations')
            .select('id, org_id, party_receipt_id, invoice_id, allocated_amount, created_at')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
    ])

    const firstError =
        partiesResult.error ||
        invoicesResult.error ||
        receiptsResult.error ||
        adjustmentsResult.error ||
        ordersResult.error ||
        suppliersResult.error ||
        supplierEntriesResult.error ||
        paymentAllocationsResult.error
    if (firstError) return { error: firstError.message }

    const rawParties = ((partiesResult.data ?? []) as RawParty[]).map(normalizeParty)
    const rawInvoices = ((invoicesResult.data ?? []) as RawInvoice[]).map(normalizeInvoice)
    const receipts = ((receiptsResult.data ?? []) as LedgerReceipt[]).map(normalizeReceipt)
    const adjustments = ((adjustmentsResult.data ?? []) as LedgerAdjustment[]).map(normalizeAdjustment)
    const paymentAllocations = ((paymentAllocationsResult.data ?? []) as PaymentAllocation[]).map(normalizePaymentAllocation)
    const invoices = enrichInvoices(rawInvoices, receipts, adjustments, paymentAllocations)
    const parties = buildPartySummaries(rawParties, invoices, receipts, adjustments)
    const orders = ((ordersResult.data ?? []) as LedgerOrderOption[]).map(normalizeOrder)
    const rawSuppliers = ((suppliersResult.data ?? []) as RawSupplier[]).map(normalizeSupplier)
    const supplierEntries = ((supplierEntriesResult.data ?? []) as SupplierLedgerEntry[]).map(normalizeSupplierEntry)
    const suppliers = buildSupplierSummaries(rawSuppliers, supplierEntries)

    return { data: { parties, invoices, receipts, adjustments, orders, suppliers, supplierEntries, paymentAllocations } }
}

export async function createParty(input: unknown): Promise<{ success: true } | { error: string }> {
    const parsed = safeParse(CreatePartySchema, input)
    if ('error' in parsed) return parsed

    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data

    const { error } = await supabase.from('parties').insert({
        org_id: profile.org_id,
        name: data.name,
        party_type: data.party_type,
        phone: toDbText(data.phone),
        gstin: toDbText(data.gstin),
        address: toDbText(data.address),
        broker_name: toDbText(data.broker_name),
        default_credit_days: data.default_credit_days,
        credit_limit: data.credit_limit,
        opening_balance: data.opening_balance,
        opening_balance_type: data.opening_balance_type,
        risk_note: toDbText(data.risk_note),
    })

    if (error) return { error: error.code === '23505' ? 'An active party with this name already exists.' : error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function updateParty(partyId: string, input: unknown): Promise<{ success: true } | { error: string }> {
    const id = safeParse(UuidSchema, partyId)
    if ('error' in id) return id

    const parsed = safeParse(UpdatePartySchema, input)
    if ('error' in parsed) return parsed

    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data

    const { error } = await supabase
        .from('parties')
        .update({
            name: data.name,
            party_type: data.party_type,
            phone: toDbText(data.phone),
            gstin: toDbText(data.gstin),
            address: toDbText(data.address),
            broker_name: toDbText(data.broker_name),
            default_credit_days: data.default_credit_days,
            credit_limit: data.credit_limit,
            opening_balance: data.opening_balance,
            opening_balance_type: data.opening_balance_type,
            risk_note: toDbText(data.risk_note),
            is_active: data.is_active ?? true,
        })
        .eq('id', id.data)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.code === '23505' ? 'An active party with this name already exists.' : error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function setPartyActive(partyId: string, isActive: boolean): Promise<{ success: true } | { error: string }> {
    const id = safeParse(UuidSchema, partyId)
    if ('error' in id) return id

    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('parties')
        .update({ is_active: isActive })
        .eq('id', id.data)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function createPartyInvoice(input: unknown): Promise<{ success: true } | { error: string }> {
    const parsed = safeParse(CreatePartyInvoiceSchema, input)
    if ('error' in parsed) return parsed

    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data

    try {
        await assertPartyBelongsToOrg(supabase, profile.org_id, data.party_id)
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Party not found' }
    }

    const invoiceNumber = toDbText(data.invoice_number) ?? await generateInvoiceNumber(supabase, profile.org_id)
    const gross = new Decimal(data.total_meters).times(data.rate_per_m)
    const gst = gross.times(data.gst_percent).div(100)
    const net = gross.plus(gst)

    const { error } = await supabase.from('party_invoices').insert({
        org_id: profile.org_id,
        party_id: data.party_id,
        order_id: toDbUuid(data.order_id),
        invoice_number: invoiceNumber,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        total_meters: data.total_meters,
        rate_per_m: data.rate_per_m,
        gross_amount: money(gross.toString()),
        gst_percent: data.gst_percent,
        gst_amount: money(gst.toString()),
        net_amount: money(net.toString()),
        status: 'unpaid',
        notes: toDbText(data.notes),
        created_by: user.id,
    })

    if (error) return { error: error.code === '23505' ? 'This invoice number already exists.' : error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function createPartyReceipt(input: unknown): Promise<{ success: true } | { error: string }> {
    const parsed = safeParse(CreatePartyReceiptSchema, input)
    if ('error' in parsed) return parsed

    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data
    const invoiceId = toDbUuid(data.invoice_id)
    const allocations = data.allocations ?? []

    try {
        await assertPartyBelongsToOrg(supabase, profile.org_id, data.party_id)
        await assertInvoiceMatchesParty(supabase, profile.org_id, data.party_id, invoiceId)
        for (const allocation of allocations) {
            await assertInvoiceMatchesParty(supabase, profile.org_id, data.party_id, allocation.invoice_id)
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Invalid receipt' }
    }

    const allocatedTotal = allocations.reduce((sum, allocation) => sum.plus(allocation.allocated_amount), new Decimal(0))
    if (allocations.length > 0 && !allocatedTotal.equals(new Decimal(data.amount))) {
        return { error: 'Allocated amount must equal payment total' }
    }

    const { data: insertedReceipt, error } = await supabase.from('party_receipts').insert({
        org_id: profile.org_id,
        party_id: data.party_id,
        invoice_id: invoiceId,
        receipt_date: data.receipt_date,
        amount: data.amount,
        method: data.method,
        reference_no: toDbText(data.reference_no),
        notes: toDbText(data.notes),
        created_by: user.id,
    }).select('id').single()

    if (error) return { error: error.message }

    if (allocations.length > 0 && insertedReceipt) {
        const { error: allocationError } = await supabase.from('payment_allocations').insert(
            allocations.map((allocation) => ({
                org_id: profile.org_id,
                party_receipt_id: insertedReceipt.id,
                invoice_id: allocation.invoice_id,
                allocated_amount: allocation.allocated_amount,
            }))
        )

        if (allocationError) return { error: allocationError.message }
    }

    const invoiceIdsToRefresh = new Set<string>()
    if (invoiceId) invoiceIdsToRefresh.add(invoiceId)
    allocations.forEach((allocation) => invoiceIdsToRefresh.add(allocation.invoice_id))

    await Promise.all(Array.from(invoiceIdsToRefresh).map((targetInvoiceId) =>
        refreshInvoiceStatus(supabase, profile.org_id, targetInvoiceId)
    ))
    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function createPartyAdjustment(input: unknown): Promise<{ success: true } | { error: string }> {
    const parsed = safeParse(CreatePartyAdjustmentSchema, input)
    if ('error' in parsed) return parsed

    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data
    const invoiceId = toDbUuid(data.invoice_id)

    try {
        await assertPartyBelongsToOrg(supabase, profile.org_id, data.party_id)
        await assertInvoiceMatchesParty(supabase, profile.org_id, data.party_id, invoiceId)
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Invalid adjustment' }
    }

    const { error } = await supabase.from('party_adjustments').insert({
        org_id: profile.org_id,
        party_id: data.party_id,
        invoice_id: invoiceId,
        adjustment_date: data.adjustment_date,
        adjustment_type: data.adjustment_type,
        direction: data.direction,
        amount: data.amount,
        notes: toDbText(data.notes),
        created_by: user.id,
    })

    if (error) return { error: error.message }

    await refreshInvoiceStatus(supabase, profile.org_id, invoiceId)
    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function createSupplier(input: unknown): Promise<{ success: true } | { error: string }> {
    const parsed = safeParse(CreateSupplierSchema, input)
    if ('error' in parsed) return parsed

    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data

    const { error } = await supabase.from('suppliers').insert({
        org_id: profile.org_id,
        name: data.name,
        phone: toDbText(data.phone),
        gst_number: toDbText(data.gst_number),
        notes: toDbText(data.notes),
    })

    if (error) return { error: error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function updateSupplier(supplierId: string, input: unknown): Promise<{ success: true } | { error: string }> {
    const id = safeParse(UuidSchema, supplierId)
    if ('error' in id) return id

    const parsed = safeParse(CreateSupplierSchema, input)
    if ('error' in parsed) return parsed

    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data

    const { error } = await supabase
        .from('suppliers')
        .update({
            name: data.name,
            phone: toDbText(data.phone),
            gst_number: toDbText(data.gst_number),
            notes: toDbText(data.notes),
        })
        .eq('id', id.data)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}

export async function createSupplierLedgerEntry(input: unknown): Promise<{ success: true } | { error: string }> {
    const parsed = safeParse(CreateSupplierLedgerEntrySchema, input)
    if ('error' in parsed) return parsed

    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const data = parsed.data

    const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('id')
        .eq('id', data.supplier_id)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (supplierError || !supplier) return { error: 'Supplier not found' }

    const { error } = await supabase.from('supplier_ledger_entries').insert({
        org_id: profile.org_id,
        supplier_id: data.supplier_id,
        type: data.type,
        amount: data.amount,
        note: toDbText(data.note),
        entry_date: data.entry_date,
        created_by: user.id,
    })

    if (error) return { error: error.message }

    revalidatePath(LEDGER_PATH)
    return { success: true }
}
