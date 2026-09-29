'use client'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { fabricStockTutorialCopy, fabricStockPreviewCopy } from '@/lib/i18n/stock-tutorial'
import { fabricStockExample as sample, stockTourSurface, type StockTourStep } from '@/lib/stock-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Read-only examples; no business actions, live data or navigation dependencies. */
export default function FabricStockTourPreview({ step }: { step: StockTourStep }) {
    const { t, language } = useTranslation()
    const copy = fabricStockTutorialCopy[language]
    const preview = fabricStockPreviewCopy[language]
    const tx = (key: string) => t(`qualityStock.${key}`)
    const surface = stockTourSurface(step)
    const target = (id: StockTourStep, children: ReactNode) => <div data-stock-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const action = (key: string) => <Button type="button" disabled variant="outline">{tx(key)}</Button>
    const field = (key: string, value: string) => <label className="block space-y-1 text-sm">{tx(key)}<Input disabled readOnly value={value} /></label>
    const opening = surface === 'opening'
    const beforeOpening = step === 'openingPending' || opening
    const currentBalance = beforeOpening ? sample.production - sample.dispatch : step === 'finish' ? sample.counted : sample.balance
    return <div className="mx-auto max-w-6xl space-y-5" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{tx('title')}</h1><p className="text-xs text-saffron-deep">{copy.sample}</p></header>
        {target('balance', <><p>{tx('available')} · {preview.quality}</p><strong className="text-3xl">{currentBalance} m</strong>{step === 'balance' && <p>{preview.balanceEquation}</p>}</>)}
        {target('tracking', <><p className="font-semibold">{preview.trackingStart}</p><p className="text-sm">{preview.trackingNote}</p></>)}
        {target('openingPending', <><h2 className="font-bold">{preview.quality}</h2><p className="text-sm">{preview.openingEquation}</p>{beforeOpening && <p className="text-sm text-[var(--wv-ochre-700)]">{tx('openingPending')}</p>}{action(beforeOpening ? 'opening' : 'correct')}{action('history')}</>)}
        {step === 'finish' && target('finish', <>
            <h2 className="text-xl font-bold">{tx('history')} · {preview.quality}</h2>
            <div className="space-y-3">{[
                ['correction', sample.correction, sample.counted], ['opening', sample.opening, sample.balance],
                ['dispatch', -sample.dispatch, sample.production - sample.dispatch], ['productionEntry', sample.production, sample.production],
            ].map(([kind, delta, balance]) => <div key={kind} className="flex justify-between gap-3 border-b border-hairline pb-2 text-sm"><span>{tx(String(kind))}{kind === 'correction' && <span className="block text-xs">{preview.correctionReference}</span>}</span><span>{Number(delta) > 0 ? '+' : ''}{delta} m<br />{tx('balanceAfter')}: {balance} m</span></div>)}</div>
            <div className="flex flex-wrap gap-2">{action('more')}{action('refresh')}</div>
        </>)}
        {(surface === 'opening' || surface === 'correction') && <Dialog open modal={false}><DialogContent data-stock-tour-preview="true" showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            <DialogHeader><DialogTitle>{tx(opening ? 'opening' : 'correct')}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            {target(opening ? 'opening' : 'correction', <>
                {field('quality', preview.quality)}
                <p className="text-sm">{tx('current')}: {opening ? sample.production - sample.dispatch : sample.balance} m</p>
                {opening ? <>{field('openingMetres', String(sample.opening))}<p>{sample.production - sample.dispatch} + {sample.opening} = {sample.balance} m</p></> : target('counted', <>{field('countedMetres', String(sample.counted))}<p>{sample.balance} → {sample.counted} m ({sample.correction} m)</p></>)}
                {field('reason', opening ? preview.countReference : preview.correctionReference)}
                <div className="flex gap-2">{action('close')}{action('save')}</div>
            </>)}
        </DialogContent></Dialog>}
    </div>
}
