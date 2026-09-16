'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { payrollPreviewLabels, payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'
import { makePayrollTourExample, payrollTourSurface, type PayrollTourStep, type PayrollTourVariant } from '@/lib/payroll-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Deliberately has no action, router, network, download, or messaging dependencies. */
export default function PayrollTourPreview({ step, variant }: { step: PayrollTourStep; variant: PayrollTourVariant }) {
    const { tx: translatePage, language } = useTranslation()
    const tx = (label: string) => payrollPreviewLabels[language][label] ?? translatePage(label)
    const copy = payrollTutorialCopy[language]
    const sample = makePayrollTourExample()
    const base = variant === 'base'
    const surface = payrollTourSurface(step)
    const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm font-medium">{tx(label)}<Input disabled value={value} readOnly /></label>
    const action = (label: string) => <Button type="button" disabled variant="outline">{tx(label)}</Button>
    const heading = (text: string) => <h2 className="font-bold text-ink">{tx(text)}</h2>
    const calculation = <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt>{tx('Gross earnings')}</dt><dd className="font-semibold">{money(sample.piece.gross)}</dd>
        <dt>{tx('Advance recovery')}</dt><dd className="font-semibold">{money(sample.piece.recovery)}</dd>
        <dt>{tx('Net amount payable')}</dt><dd className="font-semibold">{money(sample.piece.net)}</dd>
        <dt>{tx('Balance carried')}</dt><dd className="font-semibold">{money(sample.piece.carry)}</dd>
    </dl>
    const period = <div className="flex flex-wrap items-center gap-3">{action('Previous')}<strong>{sample.period}</strong>{action('Next')}</div>
    const paymentDetails = <div className="space-y-3">
        {field(base ? 'Payment method' : 'Payment mode', tx('Cash'))}
        {base && <>{field('Payment date', '2026-09-30')}{field('Note (optional)', tx('Paid in cash by owner'))}</>}
    </div>
    const content: Record<PayrollTourStep, ReactNode> = {
        period: <>{period}<p className="font-semibold">{tx('In Progress')} · 1/3</p><p>{tx('Remaining to settle')}: {money(sample.remaining)}</p>{action('Settle Payroll')}</>,
        cycle: <>{period}{heading('Pay window')}<p>{tx('Pay day')} 5</p>{action('Edit rules')}</>,
        readiness: <>{heading('Payroll readiness')}<p>{copy.people.review} · {tx('Review required')}</p>{action('Review')}{action('Mark as paid')}</>,
        earnings: <>
            {heading('Settle Payroll')}<p className="font-semibold">{copy.people.piece}</p><p>1,000 m × ₹2/m = ₹2,000</p>
            <div className="border-t border-hairline pt-3"><p className="font-semibold">{copy.people.salary} · {tx('Fixed monthly salary')}</p><p>₹18,000 × 30/30 = ₹18,000</p><p className="text-sm">{sample.period}</p></div>
        </>,
        fullEarnings: <><div className="flex flex-wrap gap-2">{action('Piece rate')}{action('Monthly / Daily')}</div><p className="font-semibold">{copy.people.piece}</p><p>1,000 m × ₹2/m = ₹2,000</p>{action('Mark Paid')}</>,
        recovery: <>{heading('Advance recovery')}<p>{tx('Outstanding')}: {money(sample.piece.debt)}</p><p>50% × ₹2,000 = ₹1,000</p>{calculation}</>,
        obligations: <>{heading('Settle Payroll')}<p className="font-semibold">{copy.people.zero}</p><p>{tx('Gross earnings')}: {money(sample.zero.gross)} · {tx('Net amount payable')}: {money(sample.zero.net)}</p>{action('Resolve')}<p className="text-sm">{tx('Resolved (₹0)')}</p></>,
        paymentDetails: <>{heading('Mark as paid')}<p>{copy.people.piece} · {money(sample.piece.net)}</p>{paymentDetails}</>,
        mode: paymentDetails,
        fullSettlement: <><p>{copy.people.piece}</p><p>{tx('Base Earnings')}: ₹2,000</p><p>{tx('Manual Adjustment')}: ₹0 · {tx('Statutory deductions')}: ₹0</p>{calculation}</>,
        fullRecovery: <>{field('Advance Recovery', String(sample.piece.recovery))}<p>{tx('Recommended')}: {money(sample.piece.recovery)} · {tx('Outstanding')}: {money(sample.piece.debt)}</p>{calculation}</>,
        finalSettlement: <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled checked={false} readOnly />{tx('Mark as Final Settlement')}</label>,
        confirm: <><p>{copy.people.piece} · {sample.period}</p>{calculation}<p>{tx('Cash')}{base ? ' · 30 Sep 2026' : ''}</p>{!base && <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled checked={false} readOnly />{tx('I verify calculations are correct')}</label>}{action('Mark as paid')}</>,
        paid: <>{heading('Paid')}<p>{copy.people.piece} · {money(sample.piece.net)} · {tx('Cash')}</p>{calculation}{base && <p>{tx('Ready to Complete')} · 3/3</p>}</>,
        complete: <>{heading('Ready to Complete')}<p>{tx('All worker obligations resolved')} · 3/3</p><p>{copy.people.zero} · {tx('Resolved (₹0)')}</p><p>{tx('Remaining to settle')}: ₹0</p>{action('Complete Payroll')}</>,
        advance: <>{field('Worker', copy.people.piece)}{field('Amount', '500')}{field('Description', '')}{action('Record advance')}</>,
        deduction: <>{field('Worker', copy.people.piece)}{field('Reason / Category', tx('Other'))}{field('Amount', '500')}{field('Notes', '')}{action('Record deduction')}</>,
        records: <>{heading('Payroll records')}{field('Pay period', sample.period)}<p>{copy.people.piece}</p>{calculation}</>,
        machineRecord: <>{heading('Machines')}<p>{copy.people.piece}</p><p>1,000 m × ₹2/m = ₹2,000</p></>,
        export: <><p>{sample.period}</p><div className="flex flex-wrap gap-2">{action('Export CSV')}{action('Export PDF')}</div></>,
        correction: <>{field('Reason for reversal', '')}<label className="flex gap-2 text-sm"><input type="checkbox" disabled />{tx('I confirm this payment was not actually made.')}</label>{action('Record reversal')}</>,
        rules: <>{field('Cycle start day', '1')}{field('Pay date day', '5')}{field('Reminder days', '3')}{action('Save')}</>,
        adjustment: <>{heading('Manual Adjustment')}{field('Adjustment Type', tx('Inam / Bonus'))}{field('Reason', tx('Other'))}{field('Amount', '0')}{field('Note', '')}{action('Add Adjustment')}</>,
        history: <>{heading('Settlement history')}{field('Pay period', sample.period)}<p>{copy.people.piece} · {money(sample.piece.net)}</p></>,
        receipt: <>{heading('Settlement receipt')}<p>{copy.people.piece} · {sample.period}</p>{calculation}</>,
        csv: action('Download CSV'),
        slip: <><p>{copy.people.piece} · {sample.period}</p>{action('PDF Slip')}</>,
        whatsapp: <><p>{copy.people.piece} · {sample.period}</p>{action('WhatsApp')}</>,
        finish: <>{period}<p>{copy.fields.finish[1]}</p></>,
    }
    const target = <section data-payroll-tour={step} className="space-y-4 rounded-xl border border-hairline bg-surface p-4">{content[step]}</section>
    const dialogSurface = ['settlement', 'advance', 'deduction', 'rules', 'correction'].includes(surface)
    return <div className="mx-auto max-w-6xl space-y-5" data-payroll-preview-variant={variant} data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{tx('Payroll')}</h1><p className="mt-1 text-xs font-semibold text-saffron-deep">{copy.sample}</p></header>
        {dialogSurface ? <>
            <div className="rounded-xl border border-hairline bg-surface p-4">{sample.period} · {copy.people.piece}</div>
            <Dialog open modal={false}>
                <DialogContent data-payroll-tour-preview="true" data-i18n-skip="true" lang={language} showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
                    <DialogHeader><DialogTitle>{tx(surface === 'settlement' ? (base ? 'Settle Payroll' : 'Mark Paid') : surface === 'rules' ? 'Payroll rules' : surface === 'correction' ? 'Reverse a mistaken payment record?' : surface === 'advance' ? 'Record worker advance' : 'Record worker deduction')}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
                    {target}
                </DialogContent>
            </Dialog>
        </> : target}
    </div>
}
