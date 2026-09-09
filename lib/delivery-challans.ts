import { z } from 'zod'
import Decimal from 'decimal.js'
import { validPaymentDueDate } from './challan-payment-terms'
const decimal = z
    .number()
    .finite()
    .refine(
        (n) => new Decimal(n).decimalPlaces() <= 2,
        'Use at most two decimal places.',
    )
export const DocumentSchema = z
    .record(z.string(), z.string().max(1000))
    .superRefine((d, ctx) => {
        for (const key of [
            'sender_name',
            'sender_address',
            'customer_name',
            'customer_address',
            'delivery_address',
            'date',
        ]) {
            if (!d[key]?.trim())
                ctx.addIssue({
                    code: 'custom',
                    message: `${key.replaceAll('_', ' ')} is required.`,
                })
        }
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '') ||
            Number.isNaN(Date.parse(d.date))
        )
            ctx.addIssue({ code: 'custom', message: 'Enter a valid date.' })
        if (d.payment_due_date && !validPaymentDueDate(d.payment_due_date))
            ctx.addIssue({
                code: 'custom',
                message: 'Enter a valid payment due date.',
            })
        for (const key of ['external_attachment'])
            if (d[key] && !safeEvidenceUrl(d[key]))
                ctx.addIssue({
                    code: 'custom',
                    message: 'Evidence links must use HTTPS.',
                })
    })
export const ChallanDraftSchema = z
    .object({
        quality_id: z.string().uuid(),
        selling_rate: decimal.pipe(z.number().positive().max(100_000_000)),
        document: DocumentSchema,
        lines: z
            .array(
                z.object({
                    lot: z.string().trim().min(1).max(80),
                    meters: decimal.pipe(
                        z.number().positive().max(100_000_000),
                    ),
                }),
            )
            .min(1)
            .max(500),
    })
    .superRefine((d, ctx) => {
        if (new Set(d.lines.map((l) => l.lot)).size !== d.lines.length)
            ctx.addIssue({
                code: 'custom',
                message: 'Lot identifiers must be unique within this document.',
            })
        if (challanTotals(d.lines, d.selling_rate).meters > 100_000_000)
            ctx.addIssue({
                code: 'custom',
                message: 'Total metres exceed the limit.',
            })
    })
export type ChallanDraft = z.infer<typeof ChallanDraftSchema>
export type Challan = ChallanDraft & {
    payment_due_date?: string | null
    payment_terms?: string
    id: string
    number: string
    quality_label: string
    sent_meters: number
    chargeable_meters: number
    acknowledged_meters: number | null
    delivery_status: 'draft' | 'sent' | 'received' | 'reversed'
    difference_status: 'none' | 'review' | 'accepted' | 'disputed'
    adjustment_amount: number
    paid_amount: number
    balance: number
    version: number
    archived_at: string | null
    issued_at: string | null
    created_at: string
}
export type ChallanEvent = {
    previous_terms?: {
        payment_due_date: string | null
        payment_terms: string
    } | null
    id: string
    action: string
    payload: { data: Record<string, unknown> }
    amount: number | null
    reverses_id: string | null
    created_at: string
    created_by: string
}
export type ChallanMutation = {
    id: string
    requestId: string
    version: number
    action:
        | 'payment_terms'
        | 'save'
        | 'confirm'
        | 'receipt'
        | 'resolve'
        | 'payment'
        | 'refund'
        | 'adjustment'
        | 'reverse_entry'
        | 'reverse_dispatch'
    payload: Record<string, unknown>
}
export const PaymentTermsSchema = z.object({
    payment_due_date: z
        .string()
        .refine(
            (v) => v === '' || validPaymentDueDate(v),
            'Enter a valid payment due date.',
        )
        .optional(),
    payment_terms: z.string().max(1000).optional(),
    reason: z
        .string()
        .trim()
        .min(3, 'Explain why the agreed payment terms changed.')
        .max(500),
})
export const MutationSchema = z.object({
    id: z.string().uuid(),
    requestId: z.string().uuid(),
    version: z.number().int().nonnegative(),
    action: z.enum([
        'payment_terms',
        'save',
        'confirm',
        'receipt',
        'resolve',
        'payment',
        'refund',
        'adjustment',
        'reverse_entry',
        'reverse_dispatch',
    ]),
    payload: z.record(z.string(), z.unknown()),
})
export function challanTotals(lines: { meters: number }[], rate: number) {
    const meters = lines.reduce(
        (sum, line) => sum.plus(Number.isFinite(line.meters) ? line.meters : 0),
        new Decimal(0),
    )
    return {
        count: lines.length,
        meters: meters.toNumber(),
        value: meters
            .times(Number.isFinite(rate) ? rate : 0)
            .toDecimalPlaces(2)
            .toNumber(),
    }
}
export function safeEvidenceUrl(value: string) {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password
            ? url.href
            : null
    } catch {
        return null
    }
}
export function paymentStatus(
    d: Pick<Challan, 'balance' | 'paid_amount' | 'delivery_status'>,
) {
    return d.delivery_status === 'draft'
        ? 'draft'
        : Number(d.balance) < 0
          ? 'credit'
          : Number(d.balance) === 0
            ? 'settled'
            : Number(d.paid_amount) > 0
              ? 'partial'
              : 'unpaid'
}
