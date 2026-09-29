'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { dailySheetStepCopy, dailySheetTourControlLabels } from '@/lib/i18n/daily-sheet-tutorial'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { dailySheetTourExample as example, type DailySheetTourStep } from '@/lib/daily-sheet-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

function formatDateOnly(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** Moved from ProductionTourPreview: display-only readings and correction preview. */
export default function DailySheetTourPreview({ step }: { step: DailySheetTourStep }) {
    const { language, t, tx } = useTranslation()
    if (step === 'ds-handoff') return null
    const labels = dailySheetTourControlLabels(t)
    const copy = dailySheetStepCopy(language, step, labels)
    const [quality, worker, loom] = { en: ['Sample fabric', 'Sample worker', 'Sample loom'], gu: ['નમૂના કાપડ', 'નમૂના કારીગર', 'નમૂના લૂમ'], hi: ['नमूना कपड़ा', 'नमूना कारीगर', 'नमूना लूम'] }[language]
    const target = (id: string, children: ReactNode) => <section data-daily-tour={id} className="space-y-3 border-b border-hairline bg-surface p-4">{children}</section>
    const action = (label: string) => <Button type="button" disabled variant="outline" className="h-auto min-h-11 whitespace-normal">{label}</Button>
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm font-medium">{label}<Input disabled readOnly value={value} /></label>
    const banner = <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>
    const isDialog = step === 'ds-earnings' || step === 'ds-correct'
    return <div className="space-y-4" data-daily-sample="true" data-i18n-skip="true" lang={language}>
        {isDialog ? <Dialog open modal={false}><DialogContent data-daily-tour-preview="true" data-production-tour-preview="true" data-i18n-skip="true" lang={language} onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} showCloseButton={false}>
            {banner}
            <DialogHeader><DialogTitle>{step === 'ds-earnings' ? labels.workerReview : tx('Edit this saved production log?')}</DialogTitle><DialogDescription className="sr-only">{copy.title}</DialogDescription></DialogHeader>
            {step === 'ds-earnings'
                ? target('review', <><p className="font-semibold">{worker}</p><p>{example.metres} m × ₹{example.rate}/m = ₹{example.earnings}</p>{field(tx('Status'), tx('Produced'))}<div className="flex flex-wrap gap-2">{action(tx('Zero output'))}{action(tx('Absent / no production'))}</div></>)
                : target('correct', <>{field(tx('Reason for correction'), '')}<p className="text-sm">{copy.detail}</p><div className="flex flex-wrap gap-2">{action(tx('Keep locked'))}{action(tx('Unlock editing'))}</div></>)}
        </DialogContent></Dialog> : <>
            {banner}
            {target('shift', <><h2 className="font-bold">{t('dailySheet.shiftDetails')}</h2><div className="grid gap-3 sm:grid-cols-2">{field(tx('Date'), formatDateOnly(example.date))}{field(tx('Shift'), tx('Day shift'))}</div>{action(labels.printSheet)}</>)}
            <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
                {target('sheet', <h2 className="font-bold">{t('dailySheet.machineSheet')}</h2>)}
                {target('reading', <><p className="font-semibold">{loom} 1 · {quality} · v2 · {worker}</p>{field(t('dailySheet.metres'), String(example.metres))}</>)}
                {target('pending', <>{action(t('dailySheet.showPending'))}<div className="grid grid-cols-2 gap-3"><div><p>{loom} 2 · {quality} · v2 · {worker}</p>{field(t('dailySheet.metres'), '')}<span>{tx('Pending')}</span></div><div><p>{loom} 3 · {quality} · v2 · {worker}</p>{field(t('dailySheet.metres'), '0')}{action(labels.notRunning)}</div></div></>)}
                {action(labels.workerReview)}
            </div>
            {target('draft', <><p className="font-semibold">{t('dailySheet.draftOnDevice')}</p>{action(t('dailySheet.discardDraft'))}</>)}
            <aside className={step === 'ds-save' ? 'production-daily-sheet-rail' : undefined}>
                {target('save', <>{action(labels.saveShift)}<p>{example.metres} m × ₹{example.rate}/m = ₹{example.earnings}</p></>)}
            </aside>
        </>}
    </div>
}
