'use client'
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
    const field = (key: string, value: string) => <label className="block space-y-1 text-sm">{tx(key)}<Input disabled readOnly value={value} /></label>
    const action = (key: string) => <Button type="button" disabled variant="outline">{tx(key)}</Button>
    const value = <p>{tx('fabricValue')}: {sample.sent} m × ₹{sample.rate} = ₹{sample.value}</p>
    const content = {
        overview: <><p>{tx('intro')}</p><p>{tx('sentMeters')}: {sample.sent} m</p><p>{tx('acknowledged')}: {sample.received} m</p><p>{tx('paid')}: ₹{sample.payment}</p></>,
        quality: <>{field('quality', quality)}<p>600 m {tx('available')}</p></>,
        parties: <>{field('sellingRate', String(sample.rate))}<div className="grid gap-3 sm:grid-cols-2">{field('date', '2026-09-16')}{field('sender_name', sender)}{field('sender_address', 'Surat')}{field('customer_name', customer)}{field('customer_address', 'Surat')}{field('delivery_address', 'Surat')}</div></>,
        lots: <><h3 className="font-bold">{tx('lotEntry')}</h3>{[['SAMPLE-1', '60'], ['SAMPLE-2', '40']].map(([lot, metres]) => <div key={lot} className="grid grid-cols-2 gap-2">{field('lot', lot)}{field('meters', metres)}</div>)}<p>{tx('totalSent')}: {sample.sent} m</p>{value}<p className="text-xs">{tx('beforeCharges')}</p></>,
        saveDraft: <><p>{quality} · {customer}</p>{value}<p className="text-xs">{tx('numberOnSave')}</p><p className="text-xs">{tx('taxHelp')}</p>{action('saveDraft')}</>,
        confirm: <><p>{sample.sent} m · {quality}</p><p className="text-sm">{tx('confirmHelp')}</p>{action('confirm')}</>,
        receipt: <>{action('receivedAsSent')}{field('meters', String(sample.received))}{field('evidenceLink', '')}{action('save')}</>,
        difference: <><p>{tx('sentMeters')}: {sample.sent} m</p><p>{tx('acknowledged')}: {sample.received} m</p><p>{tx('differenceMeters')}: {sample.sent - sample.received} m · {tx('review')}</p>{action('resolve')}</>,
        payment: <><p>{tx('accepted')}: {sample.received} m × ₹{sample.rate} = ₹{sample.acceptedValue}</p>{field('amount', String(sample.payment))}{field('date', '2026-09-16')}{field('method', '')}{field('reason', '')}{action('save')}</>,
        balance: <><p>{tx('chargeable')}: {sample.received} m × ₹{sample.rate} = ₹{sample.acceptedValue}</p><p>{tx('paid')}: ₹{sample.payment}</p><strong>{tx('balance')}: ₹{sample.balance}</strong></>,
        finish: <>{action('new')}<p className="text-sm">{copy.fields.finish[1]}</p></>,
    }[step]
    const target = <div data-dispatch-tour={step} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{content}</div>
    const isDialog = surface !== 'page' && surface !== 'detail'
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{tx('title')}</h1><p className="text-xs text-saffron-deep">{copy.sample}</p></header>
        {isDialog ? <Dialog open modal={false}><DialogContent data-dispatch-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <DialogHeader><DialogTitle>{surface === 'draft' ? tx('draftTitle') : copy.fields[step][0]}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            {target}
        </DialogContent></Dialog> : target}
    </div>
}
