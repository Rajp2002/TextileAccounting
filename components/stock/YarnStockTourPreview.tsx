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
    const names = { en: ['Sample yarn', 'Sample fabric'], gu: ['નમૂના યાર્ન', 'નમૂના કાપડ'], hi: ['नमूना धागा', 'नमूना कपड़ा'] }[language]
    const [yarn, quality] = names
    const surface = stockTourSurface(step)
    const historical = step === 'historical'
    const target = (id: StockTourStep, children: ReactNode) => <div data-stock-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const action = (label: string) => <Button type="button" disabled variant="outline">{label}</Button>
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm">{label}<Input disabled readOnly value={value} /></label>
    const weights = <p className="text-sm">{yarn} · {text.warp} · {sample.kgPer100} {text.per100}</p>
    const opening = surface === 'opening'
    const receipt = surface === 'receipt'
    const dialogBody = surface === 'link' ? <>
        {target('link', <p className="font-bold">{quality}</p>)}
        {target('costing', <label className="block text-sm">{text.costing}<select disabled value="v2" className="mt-2 w-full rounded border p-2"><option value="v2">{quality} · v2</option></select></label>)}
        {target('weights', weights)}
        {target('linkReason', field(text.formulaReason, ''))}
        {target('linkSave', <><p className="text-sm">{text.formulaHelp}</p>{action(text.close)}{action(text.save)}</>)}
    </> : <>
        {target(opening ? 'opening' : receipt ? 'receipt' : 'correction', <p className="text-sm">{opening ? text.openingHelp : receipt ? text.receiptHelp : text.correctionHelp}</p>)}
        {opening ? target('openingQuality', field(text.name, `${yarn} B`)) : field(text.name, yarn)}
        {target(opening ? 'openingAmount' : receipt ? 'receiptAmount' : 'counted', <>{field(text.weight, String(opening ? sample.opening : receipt ? sample.receipt : sample.counted))}{surface === 'correction' && <p>{sample.balance} → {sample.counted} kg ({sample.counted - sample.balance} kg)</p>}</>)}
        {opening ? target('openingReason', <>{field(text.reason, '')}{action(text.close)}{action(text.save)}</>) : receipt ? target('receiptSave', <>{field(text.reason, '')}{action(text.close)}{action(text.save)}</>) : target('correctionReason', <>{field(text.reason, '')}{action(text.close)}{action(text.save)}</>)}
    </>
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{text.title}</h1><p className="text-xs text-saffron-deep">{copy.sample}</p></header>
        {target('balance', <><p>{text.total} · {historical ? '2026-09-15' : text.current}</p><strong className="text-3xl">{historical ? sample.opening : sample.balance} kg</strong><p className="text-sm">{text.help}</p></>)}
        {target('tracking', <><p className="text-xs">{text.started}: 2026-09-14</p><p className="text-sm">{text.startHelp}</p></>)}
        {target('auditDate', <>{field(text.audit, historical ? '2026-09-15' : '')}{action(text.apply)}<p className="text-sm">{text.auditHelp}</p></>)}
        {historical && target('historical', <p className="text-sm">{copy.fields.historical![1]}</p>)}
        {step === 'current' && target('current', <>{field(text.audit, '')}{action(text.apply)}</>)}
        {target('export', action(text.export))}
        {target('yarn', <><h2 className="font-bold">{yarn}</h2><p className="text-2xl">{historical ? sample.opening : sample.balance} kg</p>{!historical && <div className="flex gap-2">{action(text.receipt)}{action(text.correction)}</div>}{action(text.history)}</>)}
        {!historical && target('formulas', <><h2 className="font-bold">{text.formulas}</h2><p>{quality} · v2</p>{weights}{action(text.link)}<p>{quality} B · {text.unlinked}</p></>)}
        {target('historyFilter', <><h2 className="font-bold">{text.history}</h2><label className="block text-sm">{text.name}<select disabled value="all" className="ml-3 rounded border p-2"><option value="all">{text.all}</option><option value="sample">{yarn}</option></select></label></>)}
        {target('movement', <div className="space-y-3">{!historical && <><div className="rounded border border-hairline p-3"><p>{yarn} · {text.dispatch} · −{sample.deduction} kg</p><p className="text-sm">{sample.dispatchedMetres} m · {sample.kgPer100} {text.per100}</p><p className="text-xs">{text.balance}: {sample.balance} kg</p>{action(text.viewDispatch)}</div><p>{text.receipt} · +{sample.receipt} kg · {text.balance}: {sample.opening + sample.receipt} kg</p></>}<p>{text.opening} · +{sample.opening} kg · {text.balance}: {sample.opening} kg</p>{action(text.more)}</div>)}
        {step === 'finish' && target('finish', <p>{copy.fields.finish![1]}</p>)}
        {surface !== 'page' && <Dialog open modal={false}><DialogContent data-stock-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <DialogHeader><DialogTitle>{surface === 'link' ? text.link : opening ? text.opening : receipt ? text.receipt : text.correction}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            <div className="space-y-3">{dialogBody}</div>
        </DialogContent></Dialog>}
    </div>
}
