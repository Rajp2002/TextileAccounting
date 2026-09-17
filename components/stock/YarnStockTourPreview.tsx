'use client'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { yarnStockText } from '@/lib/i18n/yarn-stock'
import { yarnStockTutorialCopy } from '@/lib/i18n/stock-tutorial'
import { yarnStockExample as sample, stockTourSurface, type StockTourStep } from '@/lib/stock-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Isolated illustrations: no mutations, draft storage, dispatch navigation or CSV downloads. */
export default function YarnStockTourPreview({ step }: { step: StockTourStep }) {
    const { language } = useTranslation()
    const text = yarnStockText[language]
    const copy = yarnStockTutorialCopy[language]
    const labels = {
        en: { yarn: 'Sample yarn', quality: 'Sample fabric', unused: 'Unused yarn', embodied: 'Yarn in undispatched fabric', reference: 'Verified count', receiptReference: 'Receipt 001', formulaReference: 'Verified formula', recovery: 'If no costing is available', estimator: 'Cost Estimate' },
        gu: { yarn: 'નમૂના યાર્ન', quality: 'નમૂના કાપડ', unused: 'વણવપરાયેલું યાર્ન', embodied: 'મોકલવાના બાકી કાપડનું યાર્ન', reference: 'ચકાસેલી ગણતરી', receiptReference: 'રસીદ 001', formulaReference: 'ચકાસેલું સૂત્ર', recovery: 'કોસ્ટિંગ ઉપલબ્ધ ન હોય તો', estimator: 'ખર્ચ અંદાજ' },
        hi: { yarn: 'नमूना धागा', quality: 'नमूना कपड़ा', unused: 'बचा हुआ धागा', embodied: 'भेजे नहीं गए कपड़े का धागा', reference: 'सत्यापित गिनती', receiptReference: 'रसीद 001', formulaReference: 'सत्यापित सूत्र', recovery: 'लागत उपलब्ध न हो तो', estimator: 'लागत अनुमान' },
    }[language]
    const { yarn, quality } = labels
    const surface = stockTourSurface(step)
    const opening = surface === 'opening'
    const receipt = surface === 'receipt'
    const beforeDispatch = ['balance', 'yarn', 'opening', 'receipt', 'link'].includes(step)
    const balance = step === 'finish' ? sample.counted : ['receipt', 'link'].includes(step) ? sample.opening + sample.receipt : beforeDispatch ? sample.opening : sample.balance
    const target = (id: StockTourStep, children: ReactNode) => <div data-stock-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const action = (label: string) => <Button type="button" disabled variant="outline">{label}</Button>
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm">{label}<Input disabled readOnly value={value} /></label>
    const weights = <ul className="text-sm"><li>{yarn} · {text.warp} · {sample.warpKgPer100} {text.per100}</li><li>{yarn} · {text.weft} · {sample.weftKgPer100} {text.per100}</li></ul>
    const dialogBody = surface === 'link' ? target('link', <>
        <p className="font-bold">{quality}</p>
        <label className="block text-sm">{text.costing}<select disabled value="v2" className="mt-2 w-full rounded border bg-surface p-2"><option value="v2">{quality} · v2</option></select></label>
        {weights}
        {field(text.formulaReason, labels.formulaReference)}
        <div className="flex gap-2">{action(text.close)}{action(text.save)}</div>
        <div className="border-t border-hairline pt-3 text-sm"><p className="font-semibold">{labels.recovery}</p><p>{text.noCostings}</p><p>{text.costing} → {labels.estimator}</p></div>
    </>) : target(opening ? 'opening' : receipt ? 'receipt' : 'correction', <>
        <p className="text-sm">{opening ? text.openingHelp : receipt ? text.receiptHelp : text.correctionHelp}</p>
        {field(text.name, yarn)}
        {field(text.weight, String(opening ? sample.opening : receipt ? sample.receipt : sample.counted))}
        {receipt && <p>{sample.opening} + {sample.receipt} = {sample.opening + sample.receipt} kg</p>}
        {surface === 'correction' && <p>{sample.balance} → {sample.counted} kg ({sample.counted - sample.balance} kg)</p>}
        {field(text.reason, receipt ? labels.receiptReference : labels.reference)}
        <div className="flex gap-2">{action(text.close)}{action(text.save)}</div>
    </>)
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{text.title}</h1><p className="text-xs text-saffron-deep">{copy.sample}</p></header>
        {target('balance', <><p>{text.total} · {text.current}</p><strong className="text-3xl">{balance} kg</strong><p className="text-sm">{text.help}</p></>)}
        {target('yarn', <>
            <h2 className="font-bold">{yarn}</h2>
            {step === 'yarn' ? <><p>{labels.unused}: {sample.unused} kg</p><p>{labels.embodied}: {sample.embodied} kg</p><p>{quality} · v2 · {sample.undispatchedMetres} m × {sample.kgPer100} {text.per100} = {sample.embodied} kg</p>{weights}<p className="text-xl font-bold">{sample.unused} + {sample.embodied} = {sample.opening} kg</p></> : <p className="text-2xl">{balance} kg</p>}
            <div className="flex flex-wrap gap-2">{action(text.receipt)}{action(text.correction)}{action(text.history)}</div>
        </>)}
        {target('movement', <><h2 className="font-bold">{text.history}</h2>{step === 'finish' && <div><p>{text.correction} · {sample.counted - sample.balance} kg · {text.balance}: {sample.counted} kg</p><p className="text-sm">{labels.reference}</p></div>}{!beforeDispatch && <div className="space-y-2"><p>{yarn} · {text.dispatch} · −{sample.deduction} kg</p><p>{sample.dispatchedMetres} m × {sample.kgPer100} {text.per100} = {sample.deduction} kg</p><p>{text.balance}: {sample.balance} kg</p>{action(text.viewDispatch)}</div>}{(!beforeDispatch || ['receipt', 'link'].includes(step)) && <p>{text.receipt} · +{sample.receipt} kg · {text.balance}: {sample.opening + sample.receipt} kg</p>}<p>{text.opening} · +{sample.opening} kg · {text.balance}: {sample.opening} kg</p></>)}
        {step === 'finish' && target('finish', <><h2 className="font-bold">{text.formulas}</h2><p>{quality} · v2</p>{weights}{action(text.link)}<p>{text.started}: 2026-09-14</p>{field(text.audit, '')}<div className="flex flex-wrap gap-2">{action(text.apply)}{action(text.export)}{action(text.more)}</div></>)}
        {surface !== 'page' && <Dialog open modal={false}><DialogContent data-stock-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <DialogHeader><DialogTitle>{surface === 'link' ? text.link : opening ? text.opening : receipt ? text.receipt : text.correction}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            <div className="space-y-3">{dialogBody}</div>
        </DialogContent></Dialog>}
    </div>
}
