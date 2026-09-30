'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { productionStepCopy, productionTourControlLabels } from '@/lib/i18n/production-tutorial'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { productionTourExample as example, productionTourSurface, type ProductionTourStep, type ProductionOverviewTourStep, type ProductionTourField } from '@/lib/production-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Display-only sample screens: no live data, business actions, navigation or printing. */
export default function ProductionTourPreview({ step }: { step: ProductionTourStep }) {
    if (step === 'pd-handoff') return null
    return <OverviewPreview step={step} />
}

function OverviewPreview({ step }: { step: Exclude<ProductionOverviewTourStep, 'pd-handoff'> }) {
    const { t, tx, language } = useTranslation()
    const labels = productionTourControlLabels(t)
    const copy = productionStepCopy(language, step, labels)
    const surface = productionTourSurface(step)
    const [quality, worker, loom] = { en: ['Sample fabric', 'Sample worker', 'Sample loom'], gu: ['નમૂના કાપડ', 'નમૂના કારીગર', 'નમૂના લૂમ'], hi: ['नमूना कपड़ा', 'नमूना कारीगर', 'नमूना लूम'] }[language]
    const target = (id: ProductionTourField, children: ReactNode) => <div data-production-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const heading = (label: string) => <h2 className="font-bold text-ink">{label}</h2>
    const action = (label: string) => <Button type="button" disabled variant="outline" className="h-auto min-h-11 whitespace-normal">{label}</Button>
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm font-medium">{label}<Input disabled readOnly value={value} /></label>
    const banner = <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>
    const dialog = surface === 'activate'
        ? target('activate', <>{field(tx('Search saved qualities'), quality)}<p className="font-semibold">{quality} · v2</p><p>{tx('Weaver wage')}: ₹{example.rate}/m</p><p>{t('production.cost')}: ₹40/m</p>{action(tx('Activate'))}</>)
        : target('allocate', <><p>{quality} · v2</p>{[1, 2, 3].map(number => <label key={number} className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-3"><span className="flex gap-2"><input type="checkbox" disabled readOnly checked={number < 3} />{loom} {number}</span><span className="text-xs">{tx(number === 1 ? 'Currently assigned' : number === 2 ? 'Available' : 'Producing other quality')}</span></label>)}{action(tx('Assign 2 Loom(s)'))}</>)
    const isDialog = surface === 'activate' || surface === 'allocate'
    return <div className="space-y-5" data-production-sample="true" data-i18n-skip="true" lang={language}>
        <h1 className="text-2xl font-bold">{t('navigation.production')}</h1>
        {isDialog ? <Dialog open modal={false}><DialogContent data-production-tour-preview="true" data-i18n-skip="true" lang={language} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} showCloseButton={false}>
            {banner}
            <DialogHeader><DialogTitle>{surface === 'activate' ? labels.activateQuality : labels.assignLooms}</DialogTitle><DialogDescription className="sr-only">{copy.title}</DialogDescription></DialogHeader>
            {dialog}
        </DialogContent></Dialog> : <>
            {banner}
            {step === 'pd-prereq' && target('prerequisites', <div className="space-y-3">{['costings', 'yarnStock', 'machines', 'workers'].map(key => <p key={key} className="text-sm font-semibold">{t(`navigation.${key}`)}</p>)}</div>)}
            {target('overview', <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Active Qualities', '1'], ['Machines Running', '2 / 3'], ['Workers Assigned', '1'], ['Looms Available', '1']].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{tx(label)}</p><strong className="text-xl">{value}</strong></div>)}</div>)}
            {target('qualities', <>{heading(tx('Active Qualities'))}<p className="font-semibold">{quality} · v2</p><p>{tx('Weaver wage')}: ₹{example.rate}/m · 2 {tx('Looms')}</p><div className="flex flex-wrap gap-2">{action(labels.activateQuality)}{action(labels.assignLooms)}{action(labels.qualityActions)}</div></>)}
            {target('filters', <>{field(tx('Search by loom or worker'), '')}<div className="flex flex-wrap gap-2">{action(tx('All'))}{action(tx('Running'))}{action(tx('Available'))}</div></>)}
            {target('operators', <>{heading(t('production.manageOperatorsForLoom', { loom: `${loom} 1` }))}<p>{loom} 1 · {quality}</p><div className="flex flex-wrap gap-2">{action(tx('Day Shift'))}{action(tx('Night Shift'))}</div>{field(tx('Assign / Replace Operator'), worker)}{action(tx('Assign'))}<p>{tx('Day shift')}: {worker}</p><p>{tx('Night shift')}: {tx('Unassigned')}</p></>)}
            {target('board', <>{heading(labels.machineBoard)}<p>{loom} 1 · {quality} · v2 · {worker}</p><p>{tx('Running')}</p><p>{loom} 2 · {quality} · v2 · {worker}</p><p>{tx('Running')}</p><p>{loom} 3 · {tx('Available')}</p><div className="flex flex-wrap gap-2">{action(labels.switchQuality)}{action(labels.manageWorkers)}</div></>)}
        </>}
    </div>
}
