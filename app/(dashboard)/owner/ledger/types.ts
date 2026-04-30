import {
    AdjustmentDirection,
    AdjustmentType,
    LedgerAdjustment,
    LedgerData,
    LedgerInvoice,
    LedgerParty,
    LedgerReceipt,
    OpeningBalanceType,
    PartyType,
    ReceiptMethod,
} from './actions'

export type PartyFormType = {
    name: string
    party_type: PartyType
    phone: string
    gstin: string
    state: string
    address: string
    broker_name: string
    default_credit_days: string
    credit_limit: string
    opening_balance: string
    opening_balance_type: OpeningBalanceType
    risk_note: string
    is_active: boolean
}

export type InvoiceFormType = {
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

export type ReceiptFormType = {
    party_id: string
    invoice_id: string
    receipt_date: string
    amount: string
    method: ReceiptMethod
    reference_no: string
    notes: string
    allocate_across_invoices: boolean
    allocations: Array<{
        invoice_id: string
        allocated_amount: string
    }>
}

export type AdjustmentFormType = {
    party_id: string
    invoice_id: string
    adjustment_date: string
    adjustment_type: AdjustmentType
    direction: AdjustmentDirection
    amount: string
    notes: string
}

export type Transaction = {
    id: string
    date: string
    type: 'opening' | 'invoice' | 'receipt' | 'adjustment'
    label: string
    debit: number
    credit: number
    notes: string | null
}

export type SupplierFormType = {
    name: string
    phone: string
    gst_number: string
    notes: string
}

export type SupplierEntryFormType = {
    supplier_id: string
    type: 'purchase' | 'payment'
    amount: string
    entry_date: string
    note: string
}
