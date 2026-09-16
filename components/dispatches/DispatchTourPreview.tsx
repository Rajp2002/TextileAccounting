'use client'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { dispatchTutorialCopy } from '@/lib/i18n/dispatch-tutorial'
import { dispatchTourExample as sample, dispatchTourSurface, type DispatchTourStep } from '@/lib/dispatch-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Display-only screens. Never import mutations, business records, printing or navigation. */
export default function DispatchTourPreview({ step }: { step: DispatchTourStep }) {
    const { t, language } = useTranslation()
    const copy = dispatchTutorialCopy[language]
    const tx = (key: string) => t(`challan.${key}`)
    const [quality, customer, sender] = { en: ['Sample fabric', 'Sample customer', 'Sample factory'], gu: ['નમૂના કાપડ', 'નમૂના ગ્રાહક', 'નમૂના ફેક્ટરી'], hi: ['नमूना कपड़ा', 'नमूना ग्राहक', 'नमूना कारखाना'] }[language]
    const surface = dispatchTourSurface(step)
    const target = (id: DispatchTourStep, children: ReactNode) => <div data-dispatch-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const field = (key: string, value: string) => <label className="block space-y-1 text-sm">{tx(key)}<Input disabled readOnly value={value} /></label>
    const action = (key: string) => <Button type="button" disabled variant="outline">{tx(key)}</Button>
    const buttons = <div className="flex gap-2">{action('save')}</div>
    const draft = <>
        {target('new', <p className="text-sm">{tx('draftHelp')}</p>)}
        {target('quality', <>{field('quality', quality)}<p className="text-xs">600 m {tx('available')}</p></>)}
        {target('rate', field('sellingRate', String(sample.rate)))}
        {target('parties', <div className="grid gap-3 sm:grid-cols-2">{field('date', '2026-09-16')}{field('sender_name', sender)}{field('sender_address', 'Surat')}{field('customer_name', customer)}{field('customer_address', 'Surat')}{field('delivery_address', 'Surat')}</div>)}
        {target('terms', <>{field('payment_due_date', '2026-09-30')}{field('payment_terms', '')}</>)}
        {target('optional', <>{field('transport', '')}{field('vehicle', '')}{field('customer_gstin', '')}<p className="text-xs">{tx('taxHelp')}</p></>)}
        {target('lots', <><h3 className="font-bold">{tx('lotEntry')}</h3>{[['SAMPLE-1', '60'], ['SAMPLE-2', '40']].map(([lot, metres]) => <div key={lot} className="grid grid-cols-2 gap-2">{field('lot', lot)}{field('meters', metres)}</div>)}<div className="flex flex-wrap gap-2">{action('addLine')}{action('remove')}</div></>)}
        {target('keyboard', <p className="text-sm">{tx('keyboardHelp')}</p>)}
        {target('totals', <><h3 className="font-bold">{tx('livePreview')}</h3><p>{tx('totalSent')}: {sample.sent} m</p><p>{tx('fabricValue')}: ₹{sample.value}</p><p className="text-xs">{tx('beforeCharges')}</p></>)}
        {target('saveDraft', <><p className="text-xs">{tx('numberOnSave')}</p>{action('saveDraft')}</>)}
    </>
    const operation = surface === 'confirm' ? <>
        {target('confirm', <><p>{sample.sent} m · {quality}</p><p className="text-sm">{tx('confirmHelp')}</p>{action('confirm')}</>)}
        {target('yarn', <><h3 className="font-bold">{copy.fields.yarn[0]}</h3><p>{sample.sent} m × {sample.yarnKgPer100} kg / 100 m = {sample.yarnDeduction} kg</p><p className="text-sm">{copy.fields.yarn[1]}</p></>)}
    </> : surface === 'receipt' ? <>
        {target('receipt', <>{action('receivedAsSent')}<p className="text-sm">{copy.fields.receipt[1]}</p></>)}
        {target('acknowledged', <>{field('meters', String(sample.received))}{field('evidenceLink', '')}{field('reason', '')}{buttons}</>)}
    </> : surface === 'resolve' ? target('resolve', <><label className="block text-sm">{tx('decision')}<select disabled value="accepted" className="mt-2 w-full rounded border p-2"><option value="accepted">{tx('accepted')}</option><option value="disputed">{tx('disputed')}</option></select></label>{field('reason', '')}{buttons}</>)
        : surface === 'payment' ? target('payment', <>{field('amount', String(sample.payment))}{field('date', '2026-09-16')}{field('method', '')}{field('reason', '')}{buttons}</>)
        : surface === 'adjustment' ? target('adjustment', <>{field('amount', '-80')}{field('reason', '')}<p className="text-sm">{copy.fields.adjustment[1]}</p>{buttons}</>)
        : surface === 'changeTerms' ? target('changeTerms', <>{field('payment_due_date', '2026-10-05')}{field('payment_terms', '')}{field('reason', '')}{buttons}</>)
        : surface === 'refund' ? target('refund', <><p>{tx('credit')}: ₹{sample.credit}</p><p className="text-sm">{tx('paid')}: ₹{sample.value} · {tx('chargeable')}: {sample.received} m × ₹{sample.rate}</p>{field('amount', String(sample.credit))}{field('date', '2026-09-16')}{field('method', '')}{field('reason', '')}{buttons}</>)
        : surface === 'reverseEntry' ? target('reverseEntry', <><p>{tx('payment')}: ₹{sample.payment}</p><p className="text-sm">{copy.fields.reverseEntry[1]}</p>{field('reason', '')}{buttons}</>)
        : target('reverseDispatch', <><p className="text-sm">{tx('reverseHelp')}</p>{field('reason', '')}<label className="flex gap-2 text-sm"><input type="checkbox" disabled checked={false} readOnly />{tx('stockPresent')}</label>{buttons}</>)
    const isDialog = surface !== 'page' && surface !== 'detail'
    const settledExample = ['balance', 'payment', 'adjustment', 'due', 'changeTerms', 'audit', 'reverseEntry'].includes(step)
    const creditExample = step === 'refund'
    const receivedExample = settledExample || creditExample || ['difference', 'resolve'].includes(step)
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{tx('title')}</h1><p className="text-xs text-saffron-deep">{copy.sample}</p></header>
        {target('overview', <p className="text-sm">{tx('intro')}</p>)}
        {target('tabs', <div className="flex gap-2">{action('active')}{action('history')}</div>)}
        {target('search', <>{field('search', '')}{action('searchButton')}{action('more')}</>)}
        {surface === 'page' ? <>
            {target('status', <><h2 className="font-bold">SAMPLE-001 · {customer}</h2><p>{quality} · {sample.sent} m</p><p>{tx('sent')} · {tx('unpaid')}</p><p>{tx('balance')}: ₹{sample.value}</p></>)}
            {target('legacy', action('legacy'))}
            {step === 'finish' && target('finish', <p className="text-sm">{copy.fields.finish[1]}</p>)}
        </> : <>
            {target('issued', <><h2 className="font-bold">SAMPLE-001 · {customer}</h2><p>{quality} · {surface === 'draft' || step === 'print' ? tx('draft') : receivedExample ? tx('received') : tx('sent')}</p><p>{tx('sentMeters')}: {sample.sent} m · ₹{sample.rate}/m</p></>)}
            {target('print', action('print'))}
            {receivedExample && target('difference', <><p>{tx('acknowledged')}: {sample.received} m</p><p>{tx('differenceMeters')}: {sample.sent - sample.received} m</p><p>{tx(settledExample || creditExample ? 'accepted' : 'review')}</p></>)}
            {settledExample && target('balance', <><p>{tx('chargeable')}: {sample.received} m × ₹{sample.rate} = ₹{sample.acceptedValue}</p><p>{tx('paid')}: ₹{sample.payment}</p><strong>{tx('balance')}: ₹{sample.balance}</strong></>)}
            {target('due', <><p>{tx('payment_due_date')}: 2026-09-30</p>{action('changePaymentTerms')}</>)}
            {step === 'audit' && target('audit', <><h3 className="font-bold">{tx('audit')}</h3>{['saveDraft', 'confirm', 'receipt', 'resolve', 'payment'].map(key => <p key={key} className="border-b border-hairline pb-2 text-sm">{tx(key)}</p>)}{action('reverse_entry')}</>)}
        </>}
        {isDialog && <Dialog open modal={false}><DialogContent data-dispatch-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <DialogHeader><DialogTitle>{surface === 'draft' ? tx('draftTitle') : copy.fields[step][0]}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            <div className="space-y-3">{surface === 'draft' ? draft : operation}</div>
        </DialogContent></Dialog>}
    </div>
}
