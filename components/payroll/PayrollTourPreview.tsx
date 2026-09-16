'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'
import { makePayrollTourExample, payrollTourSurface, type PayrollTourStep, type PayrollTourVariant } from '@/lib/payroll-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Deliberately has no action, router, network, download, or messaging dependencies. */
export default function PayrollTourPreview({ step, variant }: { step: PayrollTourStep; variant: PayrollTourVariant }) {
    const { tx, language } = useTranslation()
    const copy = payrollTutorialCopy[language]
    const sample = makePayrollTourExample()
    const base = variant === 'base'
    const surface = payrollTourSurface(step)
    const settled = ['paid', 'complete'].includes(step)
    const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm font-medium">{tx(label)}<Input disabled value={value} readOnly /></label>
    const target = (id: PayrollTourStep, children: ReactNode) => <div data-payroll-tour={id} className="space-y-2 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const action = (label: string) => <Button type="button" disabled variant="outline">{tx(label)}</Button>
    const heading = (text: string) => <h2 className="font-bold text-ink">{tx(text)}</h2>
    const calculation = <div className="grid grid-cols-2 gap-3 text-sm">
        <span>{tx('Gross earnings')}</span><strong>{money(sample.piece.gross)}</strong>
        <span>{tx('Advance recovery')}</span><strong>{money(sample.piece.recovery)}</strong>
        <span>{tx('Net amount payable')}</span><strong>{money(sample.piece.net)}</strong>
    </div>
    const paymentPreview = <div className="space-y-4">
        {target(base ? 'workspace' : 'fullSettlement', <>{heading(base ? 'Settle Payroll' : 'Mark Paid')}<p>{sample.period} · {sample.piece.name}</p>{!base && <p className="text-sm">{tx('Base Earnings')} {money(sample.piece.gross)} · {tx('Statutory deductions')} ₹0</p>}{calculation}</>)}
        {base && target('breakdown', <><p className="text-sm font-semibold">{sample.piece.name} · Sample loom · Sample fabric</p><p>1,000 m × ₹2/m = ₹2,000</p></>)}
        {!base && target('adjustment', <>{heading('Manual Adjustment')}{field('Adjustment Type', tx('Inam / Bonus'))}{field('Reason', tx('Other'))}{field('Amount', '0')}{field('Note', '')}{action('Add Adjustment')}</>)}
        {!base && target('fullRecovery', <>{field('Advance Recovery', '500')}<p className="text-xs">{tx('Recommended')}: ₹500 · {tx('Outstanding')}: ₹1,000</p></>)}
        {target('mode', field(base ? 'Payment method' : 'Payment mode', tx('Cash')))}
        {base && target('paymentDate', field('Payment date', '2026-09-30'))}
        {base && target('note', field('Note (optional)', tx('Paid in cash by owner')))}
        {!base && target('finalSettlement', <label className="flex gap-2 text-sm"><input type="checkbox" disabled checked={false} readOnly />{tx('Mark as Final Settlement')}</label>)}
        {target('confirm', <>{calculation}<p className="text-sm">{copy.fields.confirm[1]}</p>{action('Mark as paid')}</>)}
        {settled && target('paid', <>{heading('Paid')}<p>{sample.piece.name} · {money(sample.piece.net)} · {tx('Cash')} · 30 Sep 2026</p></>)}
        {base && step === 'complete' && target('complete', <>{heading('All worker obligations resolved')}<p>{tx('Remaining to settle')}: ₹0</p>{action('Complete Payroll')}</>)}
    </div>
    const recordsPreview = <div className="space-y-4">
        {target(base ? 'records' : 'history', <>{heading(base ? 'Payroll records' : 'Settlement history')}{field('Pay period', sample.period)}</>)}
        {base ? <>
            {target('workerRecord', <>{heading('Workers')}<p>{sample.piece.name}</p>{calculation}<p className="text-sm">{tx('Balance carried')}: {money(sample.piece.carry)}</p></>)}
            {target('machineRecord', <>{heading('Machines')}<p>Sample loom · Sample fabric · {sample.piece.name}</p><p>1,000 m × ₹2/m = ₹2,000</p></>)}
            {target('export', <div className="flex flex-wrap gap-2">{action('Export CSV')}{action('Export PDF')}</div>)}
        </> : <>
            {target('receipt', <>{heading('Settlement receipt')}<p>{sample.piece.name} · {sample.period}</p>{calculation}</>)}
            {target('csv', action('Download CSV'))}
        </>}
    </div>
    const dialogSurface = ['settlement', 'advance', 'deduction', 'rules', 'correction'].includes(surface)
    const dialogBody = surface === 'settlement' ? paymentPreview
        : surface === 'rules' ? <>{target('rules', <>{field('Cycle start day', '1')}{field('Pay date day', '5')}{field('Reminder days', '3')}{action('Save')}</>)}</>
        : surface === 'correction' ? target('correction', <><p className="text-sm">{copy.fields.correction[1]}</p>{field('Reason for reversal', '')}<label className="flex gap-2 text-sm"><input type="checkbox" disabled />{tx('I confirm this payment was not actually made.')}</label>{action('Record reversal')}</>)
        : target(surface === 'advance' ? 'advance' : 'deduction', <>{field('Worker', sample.piece.name)}{surface === 'deduction' && field('Reason / Category', tx('Other'))}{field('Amount', '500')}{field(surface === 'advance' ? 'Description' : 'Notes', '')}{action(surface === 'advance' ? 'Record advance' : 'Record deduction')}</>)
    return <div className="mx-auto max-w-6xl space-y-5" data-payroll-preview-variant={variant}>
        <header><h1 className="text-2xl font-bold">{tx('Payroll')}</h1><p className="mt-1 text-xs font-semibold text-saffron-deep">{copy.sample}</p></header>
        {surface === 'records' ? recordsPreview : <>
            {target(base ? 'period' : 'cycle', <div className="flex flex-wrap items-center gap-3">{action('Previous')}<strong>{sample.period}</strong>{action('Next')}</div>)}
            {base ? target('periodStatus', <span className="text-sm font-bold text-saffron-deep">{tx(settled ? 'Ready to Complete' : 'In Progress')} · {settled ? '2/2' : '1/2'}</span>) : target('payWindow', <>{heading('Pay window')}<p>{tx('Pay day')} 5</p>{action('Edit rules')}</>)}
            {target('summary', <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[[tx(base ? 'Total Payroll' : 'Gross Target'), sample.gross], [tx(base ? 'Advance recovery' : 'Recovered'), sample.recovery], [tx(base ? 'Paid so far' : 'Net Paid'), settled ? sample.net : sample.paid], [tx(base ? 'Remaining to settle' : 'Outstanding'), settled ? 0 : sample.remaining]].map(([label, amount]) => <div key={label}><p className="text-xs text-subtle">{label}</p><strong className="text-lg">{money(Number(amount))}</strong></div>)}</div>)}
            {base && target('progress', <><p>{tx('Settlement Progress')} · {settled ? '100%' : '50%'}</p><progress className="w-full accent-amber-600" value={settled ? 100 : 50} max={100} /></>)}
            {base && target('readiness', <>{heading('Payroll readiness')}<p className="text-sm">{tx('Reconciled')} · 1 {tx('Ready workers')}</p>{step === 'readiness' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{tx('Review required')} · Sample review worker</strong><p>{copy.fields.readiness[1]}</p><Button disabled type="button" variant="outline">{tx('Mark as paid')}</Button></div>}</>)}
            <div className="grid gap-3 sm:grid-cols-2">
                {target('search', field('Find worker', ''))}
                {base ? target('filter', <label className="block text-sm">{tx('Payment status')}<select disabled className="mt-1 w-full rounded-lg border border-hairline p-2">{['All workers', 'Ready to pay', 'Needs review', 'Paid', 'No earnings'].map(label => <option key={label}>{tx(label)}</option>)}</select></label>) : target('tabs', <div className="flex flex-wrap gap-2">{action('Piece rate')}{action('Monthly / Daily')}</div>)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {target('piece', <>{heading(sample.piece.name)}<p>{tx('Piece rate')} · 1,000 m × ₹2/m = ₹2,000</p>{calculation}</>)}
                {target('salary', <>{heading(sample.salary.name)}<p>{tx('Fixed monthly salary')} · {tx('Paid')}</p><p>₹18,000 × 30/30 = ₹18,000</p>{!base && <div className="flex flex-wrap gap-2">{target('slip', action('PDF Slip'))}{target('whatsapp', action('WhatsApp'))}</div>}</>)}
            </div>
            {base && <div className="grid gap-4 sm:grid-cols-2">{target('recovery', <>{heading('Advance recovery')}<p>₹1,000 − ₹500 = ₹500</p></>)}{target('carry', <>{heading('Balance carried')}<p>₹500 · {sample.period}</p></>)}</div>}
        </>}
        {step === 'finish' && target('finish', <p>{copy.fields.finish[1]}</p>)}
        {dialogSurface && <Dialog open modal={false}>
            <DialogContent data-payroll-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
                <DialogHeader><DialogTitle>{tx(surface === 'settlement' ? (base ? 'Settle Payroll' : 'Mark Paid') : surface === 'rules' ? 'Payroll rules' : surface === 'correction' ? 'Reverse a mistaken payment record?' : surface === 'advance' ? 'Record worker advance' : 'Record worker deduction')}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
                {dialogBody}
            </DialogContent>
        </Dialog>}
    </div>
}
