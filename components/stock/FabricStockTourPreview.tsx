'use client'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { fabricStockTutorialCopy } from '@/lib/i18n/stock-tutorial'
import { fabricStockExample as sample, stockTourSurface, type StockTourStep } from '@/lib/stock-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Read-only examples; no business actions, live data or navigation dependencies. */
export default function FabricStockTourPreview({ step }: { step: StockTourStep }) {
    const { t, language } = useTranslation()
    const copy = fabricStockTutorialCopy[language]
    const tx = (key: string) => t(`qualityStock.${key}`)
    const quality = { en: 'Sample fabric', gu: 'નમૂના કાપડ', hi: 'नमूना कपड़ा' }[language]
    const surface = stockTourSurface(step)
    const target = (id: StockTourStep, children: ReactNode) => <div data-stock-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const action = (key: string) => <Button type="button" disabled variant="outline">{tx(key)}</Button>
    const field = (key: string, value: string) => <label className="block space-y-1 text-sm">{tx(key)}<Input disabled readOnly value={value} /></label>
    const opening = surface === 'opening'
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{tx('title')}</h1><p className="text-xs text-saffron-deep">{copy.sample}</p></header>
        {target('balance', <><p>{tx('available')}</p><strong className="text-3xl">{sample.balance} m</strong><p>2 {tx('qualities')}</p></>)}
        {target('tracking', <><p className="text-sm">{tx('cutover')}</p><p className="text-sm">{tx('legacyCommitted')}</p><p className="text-sm">{tx('correctionNote')}</p></>)}
        {target('search', field('search', ''))}
        {target('quality', <><h2 className="font-bold">{quality}</h2><p className="text-2xl">{sample.balance} m</p>{action('correct')}{action('history')}</>)}
        {target('openingPending', <><h2 className="font-bold">{quality} B</h2><p>0 m</p><p className="text-sm text-amber-700">{tx('openingPending')}</p>{action('opening')}</>)}
        {target('history', <h2 className="text-xl font-bold">{tx('history')}</h2>)}
        {target('historyFilter', <label className="block text-sm">{tx('quality')}<select disabled value="sample" className="ml-3 rounded border p-2"><option value="sample">{quality}</option></select></label>)}
        {target('movement', <div className="space-y-3">{[
            ['dispatch', -sample.dispatch, sample.balance], ['productionEntry', sample.production, sample.opening + sample.production], ['opening', sample.opening, sample.opening],
        ].map(([kind, delta, balance]) => <div key={kind} className="flex justify-between gap-3 border-b border-hairline pb-2 text-sm"><span>{quality} · {tx(String(kind))}</span><span>{Number(delta) > 0 ? '+' : ''}{delta} m<br />{tx('balanceAfter')}: {balance} m</span></div>)}</div>)}
        {target('older', action('more'))}
        {target('refresh', action('refresh'))}
        {step === 'finish' && target('finish', <p>{copy.fields.finish![1]}</p>)}
        {surface !== 'page' && <Dialog open modal={false}><DialogContent data-stock-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <DialogHeader><DialogTitle>{tx(opening ? 'opening' : 'correct')}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            <div className="space-y-3">
                {target(opening ? 'opening' : 'correction', <p className="text-sm">{tx(opening ? 'openingHelp' : 'correctHelp')}</p>)}
                {opening && target('openingQuality', field('quality', `${quality} B`))}
                {!opening && <p className="font-bold">{quality} · {tx('current')}: {sample.balance} m</p>}
                {target(opening ? 'openingAmount' : 'counted', <>{field(opening ? 'openingMetres' : 'countedMetres', String(opening ? sample.opening : sample.counted))}{!opening && <p>{sample.balance} → {sample.counted} m ({sample.correction} m)</p>}</>)}
                {target(opening ? 'openingReason' : 'correctionReason', field('reason', ''))}
                {target(opening ? 'openingSave' : 'correctionSave', <div className="flex gap-2">{action('close')}{action('save')}</div>)}
            </div>
        </DialogContent></Dialog>}
    </div>
}
