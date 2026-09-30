'use client'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { yarnStockText } from '@/lib/i18n/yarn-stock'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { yarnStockExample as sample, stockTourSurface, type StockTourStep } from '@/lib/stock-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Isolated illustrations: no mutations, draft storage, dispatch navigation or CSV downloads. */
export default function YarnStockTourPreview({ step }: { step: StockTourStep }) {
    const { language, t } = useTranslation()
    if (step === 'ys-handoff') return null
    const text = yarnStockText[language]
    const labels = {
        en: { yarn: 'Sample yarn', quality: 'Sample fabric', reference: 'Verified count', receiptReference: 'Receipt 001', formulaReference: 'Verified formula', recovery: 'If no costing is available', estimator: 'Cost Estimate' },
        gu: { yarn: 'નમૂના યાર્ન', quality: 'નમૂના કાપડ', reference: 'ચકાસેલી ગણતરી', receiptReference: 'રસીદ 001', formulaReference: 'ચકાસેલું સૂત્ર', recovery: 'કોસ્ટિંગ ઉપલબ્ધ ન હોય તો', estimator: 'ખર્ચ અંદાજ' },
        hi: { yarn: 'नमूना धागा', quality: 'नमूना कपड़ा', reference: 'सत्यापित गिनती', receiptReference: 'रसीद 001', formulaReference: 'सत्यापित सूत्र', recovery: 'लागत उपलब्ध न हो तो', estimator: 'लागत अनुमान' },
    }[language]
    const { yarn, quality } = labels
    const surface = stockTourSurface(step)
    const opening = surface === 'opening'
    const receipt = surface === 'receipt'
    const afterReceipt = ['ys-receipt', 'ys-link', 'ys-usage', 'ys-correct'].includes(step)
    const afterProduction = ['ys-usage', 'ys-correct'].includes(step)
    const balance = afterProduction ? sample.balance : afterReceipt ? sample.opening + sample.receipt : sample.opening
    const target = (id: string, children: ReactNode) => <div data-stock-tour={id} className="space-y-3">{children}</div>
    const action = (label: string) => <Button type="button" disabled variant="outline">{label}</Button>
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm">{label}<Input disabled readOnly value={value} /></label>
    const banner = <p data-tour-sample-banner className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>
    const weights = <ul className="text-sm"><li>{yarn} · {text.warp} · {sample.warpKgPer100} {text.per100}</li><li>{yarn} · {text.weft} · {sample.weftKgPer100} {text.per100}</li></ul>
    const dialogBody = surface === 'link' ? target('link', <>
        <p className="font-semibold">{quality}</p>
        <label className="block text-sm">{text.costing}<select disabled value="v2" className="mt-2 min-h-11 w-full rounded-md border bg-surface p-2"><option value="v2">{quality} · v2</option></select></label>
        {weights}
        <p>{sample.warpKgPer100} + {sample.weftKgPer100} = {sample.kgPer100} {text.per100}</p>
        {field(text.formulaReason, labels.formulaReference)}
        <div className="flex flex-wrap gap-2">{action(text.close)}{action(text.save)}</div>
        <div className="border-t border-hairline pt-3 text-sm"><p className="font-semibold">{labels.recovery}</p><p>{text.noCostings}</p><p>{text.costing} → {labels.estimator}</p></div>
    </>) : target(opening ? 'opening' : receipt ? 'receipt' : 'correction', <>
        <p className="text-sm">{opening ? text.openingHelp : receipt ? text.receiptHelp : text.correctionHelp}</p>
        {field(text.name, yarn)}
        {field(text.weight, String(opening ? sample.opening : receipt ? sample.receipt : sample.counted))}
        {receipt && <p>{sample.opening} + {sample.receipt} = {sample.opening + sample.receipt} kg</p>}
        {surface === 'correction' && <p>{sample.balance} → {sample.counted} kg ({sample.counted - sample.balance} kg)</p>}
        {field(text.reason, receipt ? labels.receiptReference : labels.reference)}
        <div className="flex flex-wrap gap-2">{action(text.close)}{action(text.save)}</div>
    </>)
    return <div className="space-y-5" data-i18n-skip="true" lang={language}>
        <header data-yarn-tour-section="header" className="space-y-3">
            <h1 className="text-2xl font-semibold">{text.title}</h1>
            <div className="flex flex-wrap gap-2">{action(t('qualityStock.audit'))}{action(text.refresh)}{action(text.opening)}{action(text.receipt)}</div>
        </header>
        {surface === 'page' && banner}
        <section data-yarn-tour-section="balance" className="rounded-xl border border-hairline bg-surface p-4">
            {target('balance', <><p>{text.total} · {text.current}</p><strong data-yarn-tour-balance className="text-3xl tabular-nums">{balance} kg</strong><p className="text-sm">{text.help}</p></>)}
        </section>
        <section data-yarn-tour-section="date" className="space-y-3 rounded-xl border border-hairline p-4">
            <div className="flex flex-wrap items-end gap-3"><label className="block space-y-1 text-sm">{text.audit}<Input type="date" disabled readOnly value="" /></label>{action(text.apply)}{action(text.export)}</div>
            <p className="text-xs text-muted-foreground">{text.auditHelp}</p>
        </section>
        <section data-yarn-tour-section="yarns" className="space-y-3 rounded-xl border border-hairline bg-surface p-4">
            <h2 className="font-semibold">{yarn}</h2><p className="text-2xl tabular-nums">{balance} kg</p>
            <div className="flex flex-wrap gap-2">{action(text.receipt)}{action(text.correction)}{action(text.history)}</div>
        </section>
        <section data-yarn-tour-section="costings" className="space-y-3">
            <h2 className="text-xl font-semibold">{text.formulas}</h2><p className="text-sm text-muted-foreground">{text.formulaHelp}</p>
            <div className="space-y-3 rounded-xl border border-hairline bg-surface p-4"><h3 className="font-semibold">{quality} · v2</h3>{weights}{action(text.link)}</div>
        </section>
        <section data-yarn-tour-section="history" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">{text.history}</h2><label className="text-sm">{text.name}<select disabled value="" className="ml-2 min-h-11 rounded-md border bg-surface p-2"><option value="">{text.all}</option><option value="tour-yarn">{yarn}</option></select></label></div>
            <div className="space-y-3 rounded-xl border border-hairline bg-surface p-4">
                {afterProduction && target('movement', <><p>{yarn} · {text.production_consumption} · −{sample.deduction} kg</p><p>{sample.producedMetres} m × {sample.kgPer100} ÷ 100 = {sample.deduction} kg</p><p>{text.balance}: {sample.balance} kg</p></>)}
                {afterReceipt && <p>{text.receipt} · +{sample.receipt} kg · {text.balance}: {sample.opening + sample.receipt} kg</p>}
                <p>{text.opening} · +{sample.opening} kg · {text.balance}: {sample.opening} kg</p>
            </div>
        </section>
        {surface !== 'page' && <Dialog open modal={false}><DialogContent data-stock-tour-preview="true" data-i18n-skip="true" lang={language} showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            {banner}
            <DialogHeader><DialogTitle>{surface === 'link' ? text.link : opening ? text.opening : receipt ? text.receipt : text.correction}</DialogTitle><DialogDescription className="sr-only">{surface === 'link' ? text.link : opening ? text.opening : receipt ? text.receipt : text.correction}</DialogDescription></DialogHeader>
            {dialogBody}
        </DialogContent></Dialog>}
    </div>
}
