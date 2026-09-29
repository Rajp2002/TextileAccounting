'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { productionTutorialCopy } from '@/lib/i18n/production-tutorial'
import { productionTourExample as example, productionTourSurface, type ProductionTourStep, type ProductionTourField } from '@/lib/production-tour'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Display-only sample screens: no live data, business actions, navigation or printing. */
export default function ProductionTourPreview({ step }: { step: ProductionTourStep }) {
    const { tx, language } = useTranslation()
    const copy = productionTutorialCopy[language]
    const surface = productionTourSurface(step)
    const savedState = ['saved', 'correction', 'audit'].includes(step)
    const isDialog = !['overview', 'daily'].includes(surface)
    const target = (id: ProductionTourField, children: ReactNode) => <div data-production-tour={id} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">{children}</div>
    const heading = (label: string) => <h2 className="font-bold text-ink">{tx(label)}</h2>
    const action = (label: string) => <Button type="button" disabled variant="outline">{tx(label)}</Button>
    const field = (label: string, value: string) => <label className="block space-y-1 text-sm font-medium">{tx(label)}<Input disabled readOnly value={value} /></label>
    const names = { en: ['Sample fabric', 'Sample weaver', 'Sample loom'], gu: ['નમૂના કાપડ', 'નમૂના વણકર', 'નમૂના લૂમ'], hi: ['नमूना कपड़ा', 'नमूना बुनकर', 'नमूना लूम'] }[language]
    const [quality, worker, loom] = names
    const loomRow = (number: number, status: string, checked: boolean) => <label className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-3"><span className="flex gap-2"><input type="checkbox" disabled readOnly checked={checked} />{loom} {number}</span><span className="text-xs">{tx(status)}</span></label>
    const dialogBody = surface === 'activate' ? <>
        {target('activate', <>{heading('Activate Quality for Production')}{field('Search saved qualities', quality)}<p className="font-semibold">{quality} · v2</p><p>{tx('Weaver wage')}: ₹{example.rate}/m</p><p>{tx('Production cost')}: ₹40/m</p>{action('Activate')}</>)}
    </> : surface === 'allocate' ? <>
        {target('allocate', <>{heading('Assign Looms')}<p>{quality} · v2</p>{action('Assign 2 Loom(s)')}</>)}
        {target('loomStates', <>{loomRow(1, 'Currently assigned', true)}{loomRow(2, 'Available', true)}{loomRow(3, 'Producing other quality', false)}</>)}
    </> : surface === 'switchQuality' ? target('switchQuality', <>{field('Current Quality', `${quality} · v2`)}{field('Switch to Active Quality', `${quality} B · v1`)}<p className="text-sm">{copy.fields.switchQuality[1]}</p>{action('Switch Quality')}</>)
        : surface === 'deactivate' ? target('deactivate', <><p>{quality} · v2</p><p className="text-sm">{copy.fields.deactivate[1]}</p>{action('Cancel')}{action('Deactivate Quality')}</>)
        : surface === 'incomplete' ? target('incomplete', <><p>{example.date} · {tx('Day shift')} · {example.metres} m</p><p className="text-sm">{copy.fields.incomplete[1]}</p>{action('Keep entering')}{action('Save incomplete shift')}</>)
        : surface === 'correction' ? target('correction', <>{field('Reason for correction', '')}<p className="text-sm">{copy.fields.correction[1]}</p>{action('Keep locked')}{action('Unlock editing')}</>)
        : target('audit', <><div className="rounded-xl border border-hairline p-3"><strong>{tx('Original production saved')}</strong><p>{loom} 1 · {worker} · {example.metres} m · ₹{example.earnings}</p></div><div className="rounded-xl border border-hairline p-3"><strong>{tx('Correction')} 1</strong><p>{tx('Changed by')}: {tx('you')}</p><p>{tx('Reason for correction')}: {tx('Meter reading corrected from the paper shift register')}</p><p>{example.metres} m → {example.correctedMetres} m</p><p>₹{example.rate}/m → ₹{example.rate}/m</p><p>₹{example.earnings} → ₹{example.correctedEarnings}</p></div></>)
    const overview = <>
        {step === 'prerequisites' && target('prerequisites', <div className="space-y-3">{['Cost Estimator → Saved Costings', 'Workers', 'Machines', 'Production → Overview & Looms', 'Machine Assignments'].map(label => <p key={label} className="text-sm font-semibold">{label.split(' → ').map(part => tx(part)).join(' → ')}</p>)}</div>)}
        {target('overview', <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Active Qualities', '1'], ['Machines Running', '2 / 3'], ['Workers Assigned', '1'], ['Looms Available', '1']].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{tx(label)}</p><strong className="text-xl">{value}</strong></div>)}</div>)}
        {target('tabs', <div className="flex flex-wrap gap-2">{action('Overview & Looms')}{action('Daily Sheet')}</div>)}
        {target('qualities', <>{heading('Active Qualities')}<p className="font-semibold">{quality} · v2</p><p>{tx('Weaver wage')}: ₹{example.rate}/m · 2 {tx('Looms')}</p>{action('Activate Quality')}{action('Assign Looms')}</>)}
        {target('filters', <>{field('Search by loom or worker', '')}<div className="flex flex-wrap gap-2">{action('All')}{action('Running')}{action('Available')}</div></>)}
        {target('board', <>{heading('Loom Board')}<p>{loom} 1 · {quality} · v2</p><span className="text-sm font-semibold text-[var(--wv-moss-700)]">{tx('Running')}</span><div className="flex flex-wrap gap-2">{action('Switch Quality')}{action('Manage Workers')}</div></>)}
        {target('operators', <>{heading('Manage Workers')}<p>{loom} 1 · {quality}</p><div className="flex flex-wrap gap-2">{action('Day Shift')}{action('Night Shift')}</div>{field('Assign / Replace Operator', worker)}{action('Assign')}<p>{tx('Day shift')}: {worker}</p><p>{tx('Night shift')}: {tx('Unassigned')}</p></>)}
    </>
    const daily = <>
        {target('daily', <>{heading('Daily machine production')}{action('Overview & Looms')}{action('Daily Sheet')}</>)}
        {target('date', <div className="grid gap-3 sm:grid-cols-2">{field('Date', example.date)}{field('Shift', tx('Day shift'))}</div>)}
        {target('print', action('Print collection sheet'))}
        {target('reading', <>{heading('Machine sheet')}<p>{loom} 1 · {quality} · {worker}</p>{field('Metres', String(example.metres))}<p className="text-xs">{example.metres} m × ₹{example.rate}/m = ₹{example.earnings}</p></>)}
        {target('pending', <>{action('Show pending')}<div className="grid gap-3 sm:grid-cols-2"><div><p>{loom} 2 · {worker}</p>{field('Metres', '')}<span className="text-xs">{tx('Pending')}</span></div><div><p>{loom} 3 · {worker}</p>{field('Metres', '0')}{action('Not running')}</div></div></>)}
        {target('rollup', <>{heading('Worker payroll roll-up')}<p>{worker} · {example.metres} m · ₹{example.earnings}</p></>)}
        {target('workerStatus', <>{field('Status', tx('Produced'))}<p className="text-sm">{tx('Not entered')} · {tx('Zero output')} · {tx('Absent / no production')}</p></>)}
        {!savedState && target('draft', <><p className="text-sm">{tx('Draft saved on this device · not yet submitted')}</p>{action('Discard draft')}</>)}
        {!savedState && target('save', <><p>2/3 {tx('machines accounted for')} · {example.metres} m</p><p className="text-xs">1 {tx('pending')} · 1 {tx('not running')}</p>{action('Save machine production')}<p>{tx('Fabric Stock')}: +{example.metres} m · {tx('Gross earnings')}: +₹{example.earnings}</p></>)}
        {target('history', <>{heading('Recent production')}{field('Find date, worker, machine, or job', '')}<p>{example.date} · {worker} · {loom} 1 · {example.metres} m</p>{action('View log')}</>)}
        {savedState && target('saved', <>{heading('Saved shift')}{action('Edit production log')}<p className="text-sm">{tx('Paid · protected')}</p></>)}
        {step === 'finish' && target('finish', <>{heading('Production')}<div className="flex flex-wrap gap-2">{action('Overview & Looms')}{action('Daily Sheet')}{action('Fabric Stock')}{action('Payroll')}</div></>)}
    </>
    return <div className="mx-auto max-w-6xl space-y-5" data-production-sample="true" data-i18n-skip="true" lang={language}>
        <header><h1 className="text-2xl font-bold">{tx('Production')}</h1><p className="mt-1 text-xs font-semibold text-saffron-deep">{copy.sample}</p></header>
        {surface === 'overview' || ['activate', 'allocate', 'switchQuality', 'deactivate'].includes(surface) ? overview : daily}
        {isDialog && <Dialog open modal={false}><DialogContent data-production-tour-preview="true" onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} showCloseButton={false} className="max-w-lg">
            <DialogHeader><DialogTitle>{copy.fields[step][0]}</DialogTitle><DialogDescription>{copy.sample}</DialogDescription></DialogHeader>
            <div className="space-y-3">{dialogBody}</div>
        </DialogContent></Dialog>}
    </div>
}
