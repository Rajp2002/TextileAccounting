'use client'
import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { fabricStockPreviewCopy } from '@/lib/i18n/stock-tutorial'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { fabricStockExample as sample, fabricStockBalance, stockTourSurface, type FabricStockTourStep } from '@/lib/stock-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Read-only examples; no business actions, live data or navigation dependencies. */
export default function FabricStockTourPreview({ step }: { step: FabricStockTourStep }) {
    const { t, language } = useTranslation()
    if (step === 'fs-handoff') return null
    const preview = fabricStockPreviewCopy[language]
    const tx = (key: string) => t(`qualityStock.${key}`)
    const surface = stockTourSurface(step)
    const target = (id: string, children: ReactNode) => <div data-stock-tour={id} className="space-y-3">{children}</div>
    const action = (key: string) => <Button type="button" disabled variant="outline">{tx(key)}</Button>
    const field = (key: string, value: string) => <label className="block space-y-1 text-sm">{tx(key)}<Input disabled readOnly value={value} /></label>
    const opening = surface === 'opening'
    const beforeOpening = ['fs-balance', 'fs-pending', 'fs-opening'].includes(step)
    const currentBalance = fabricStockBalance(step)
    const banner = <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>
    const history = target('history', <>
        <h2 className="text-xl font-semibold">{tx('history')} · {preview.quality}</h2>
        <div className="space-y-3">{[
            ['correction', sample.correction, sample.counted], ['opening', sample.opening, sample.balance],
            ['dispatch', -sample.dispatch, sample.production - sample.dispatch], ['productionEntry', sample.production, sample.production],
        ].map(([kind, delta, balance]) => <div key={kind} className="flex justify-between gap-3 border-b border-hairline pb-2 text-sm"><span>{tx(String(kind))}{kind === 'correction' && <span className="block text-xs">{preview.correctionReference}</span>}</span><span>{Number(delta) > 0 ? '+' : ''}{delta} {tx('metres')}<br />{tx('balanceAfter')}: {balance} {tx('metres')}</span></div>)}</div>
        <div className="flex flex-wrap gap-2">{action('more')}{action('refresh')}</div>
    </>)
    return <div className="space-y-5" data-i18n-skip="true" lang={language}>
        <h1 className="text-2xl font-semibold">{tx('title')}</h1>
        {surface === 'page' && banner}
        <div className="space-y-4 rounded-xl border border-hairline bg-surface p-4">
            {target('balance', <><p>{tx('available')} · {preview.quality}</p><strong data-fabric-tour-balance className="text-3xl">{currentBalance} {tx('metres')}</strong>{step === 'fs-balance' && <p>{sample.production} − {sample.dispatch} = {currentBalance} {tx('metres')}</p>}</>)}
            {step === 'fs-history' ? history : target('openingPending', <>
                <h2 className="font-semibold">{preview.quality}</h2>
                {beforeOpening && <span title={tx('openingPending')} className="text-sm text-[var(--wv-ochre-700)]">{tx('pending')}</span>}
                <div className="flex flex-wrap gap-2">{action(beforeOpening ? 'opening' : 'correct')}{action('history')}</div>
            </>)}
        </div>
        {(opening || surface === 'correction') && <Dialog open modal={false}><DialogContent data-stock-tour-preview="true" data-i18n-skip="true" lang={language} showCloseButton={false} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
            {banner}
            <DialogHeader><DialogTitle>{tx(opening ? 'opening' : 'correct')}</DialogTitle><DialogDescription className="sr-only">{tx(opening ? 'opening' : 'correct')}</DialogDescription></DialogHeader>
            {target(opening ? 'opening' : 'correction', <>
                {field('quality', preview.quality)}
                <p className="text-sm">{tx('current')}: {currentBalance} {tx('metres')}</p>
                {opening ? <>{field('openingMetres', String(sample.opening))}<p>{currentBalance} + {sample.opening} = {sample.balance} {tx('metres')}</p></> : <>{field('countedMetres', String(sample.counted))}<p>{sample.balance} → {sample.counted} {tx('metres')} ({sample.correction} {tx('metres')})</p></>}
                {field('reason', opening ? preview.countReference : preview.correctionReference)}
                <div className="flex gap-2">{action('close')}{action('save')}</div>
            </>)}
        </DialogContent></Dialog>}
    </div>
}
