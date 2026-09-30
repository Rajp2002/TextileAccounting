'use client'
import { useTranslation } from '@/lib/i18n/context'
import { dispatchStepCopy, dispatchTourControlLabels } from '@/lib/i18n/dispatch-tutorial'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { dispatchTourExample as sample, dispatchTourSurface, type DispatchTourStep } from '@/lib/dispatch-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Display-only screens. Never import mutations, business records, printing or navigation. */
export default function DispatchTourPreview({ step }: { step: DispatchTourStep }) {
    const { t, language } = useTranslation()
    if (step === 'handoff') return null
    const copy = dispatchStepCopy(language, step, dispatchTourControlLabels(t))
    const tx = (key: string) => t(`challan.${key}`)
    const [quality, customer, sender] = { en: ['Sample fabric', 'Sample customer', 'Sample factory'], gu: ['નમૂના કાપડ', 'નમૂના ગ્રાહક', 'નમૂના ફેક્ટરી'], hi: ['नमूना कपड़ा', 'नमूना ग्राहक', 'नमूना कारखाना'] }[language]
    const surface = dispatchTourSurface(step)
    const format = (value: number) => value.toLocaleString('en-IN')
    const field = (key: string, value: string) => <label className="block space-y-1 text-sm">{tx(key)}<Input disabled readOnly value={value} /></label>
    const action = (key: string) => <Button type="button" disabled variant="outline" className="h-auto min-h-11 whitespace-normal">{tx(key)}</Button>
    const value = <p>{tx('fabricValue')}: {sample.sent} m × ₹{sample.rate} = ₹{format(sample.value)}</p>
    const content = {
        overview: <><p>{tx('intro')}</p><p>{tx('sentMeters')}: {sample.sent} m</p><p>{tx('acknowledged')}: {sample.received} m</p><p>{tx('paid')}: ₹{format(sample.payment)}</p></>,
        quality: <>{field('quality', quality)}<p>600 m {tx('available')}</p></>,
        parties: <>{field('sellingRate', String(sample.rate))}<div className="grid gap-3 sm:grid-cols-2">{field('date', '2026-09-16')}{field('sender_name', sender)}{field('sender_address', 'Surat')}{field('customer_name', customer)}{field('customer_address', 'Surat')}{field('delivery_address', 'Surat')}</div></>,
        lots: <><h3 className="font-semibold">{tx('lotEntry')}</h3>{[['SAMPLE-1', '60'], ['SAMPLE-2', '40']].map(([lot, metres]) => <div key={lot} className="grid grid-cols-2 gap-2">{field('lot', lot)}{field('meters', metres)}</div>)}<p>{tx('totalSent')}: {sample.sent} m</p>{value}<p className="text-xs">{tx('beforeCharges')}</p></>,
        saveDraft: <><p>{quality} · {customer}</p>{value}<p className="text-xs">{tx('numberOnSave')}</p>{action('saveDraft')}</>,
        confirm: <><p>{sample.sent} m · {quality}</p><p className="text-sm">{tx('confirmHelp')}</p>{action('confirm')}</>,
        receipt: <><div data-dispatch-receipt-toolbar>{action('receivedAsSent')}</div><div data-dispatch-receipt-fields className="space-y-3 border-t border-hairline pt-3">{field('meters', String(sample.received))}{field('evidenceLink', '')}{action('save')}</div></>,
        difference: <><p>{tx('sentMeters')}: {sample.sent} m</p><p>{tx('acknowledged')}: {sample.received} m</p><p>{tx('differenceMeters')}: {sample.sent - sample.received} m</p><p>{tx('accepted')}: {sample.received} m × ₹{sample.rate} = ₹{format(sample.acceptedValue)}</p>{action('resolve')}</>,
        payment: <><p>{tx('accepted')}: {sample.received} m × ₹{sample.rate} = ₹{format(sample.acceptedValue)}</p>{field('amount', String(sample.payment))}{field('date', '2026-09-16')}{field('method', '')}{field('reason', '')}{action('save')}<p>{tx('paid')}: ₹{format(sample.payment)}</p><strong>{tx('balance')}: ₹{format(sample.balance)}</strong></>,
    }[step]
    const target = <div data-dispatch-tour={step} className="space-y-3">{content}</div>
    const isDialog = surface !== 'page' && surface !== 'detail'
    const banner = <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>
    return <div className="space-y-5" data-i18n-skip="true" lang={language}>
        <h1 className="text-2xl font-semibold">{tx('title')}</h1>
        {isDialog ? <Dialog open modal={false}><DialogContent data-dispatch-tour-preview="true" data-i18n-skip="true" lang={language} showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            {banner}
            <DialogHeader><DialogTitle>{surface === 'draft' ? tx('draftTitle') : copy.title}</DialogTitle><DialogDescription className="sr-only">{copy.title}</DialogDescription></DialogHeader>
            {target}
        </DialogContent></Dialog> : <>{banner}<div className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{target}</div></>}
    </div>
}
