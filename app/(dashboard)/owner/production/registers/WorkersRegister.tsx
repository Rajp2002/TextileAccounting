'use client'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useSearchParams } from 'next/navigation'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/context'
import { currentBaseMonthlySalary } from '@/lib/base-salary'
import { formatINR } from '@/lib/finance'
import { managementReturnLabel } from '@/lib/management-navigation'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import WorkerEditor from './WorkerEditor'

export default function WorkersRegister({ workers, today }: { workers: BaseProductionWorker[]; today: string }) {
 const params = useSearchParams()
 const { tx } = useTranslation()
 useLocalizedPageTitle(`${tx('Workers')} | Weavly`)
 const search = params.get('search') ?? ''
 const payType = params.get('payType') ?? 'all'
 const inactive = params.get('inactive') === '1'
 const focus = params.get('worker')
 const returnTo = safeBaseReturnPath(params.get('returnTo'))
 const update = (key: string, value: string) => {
   const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key)
   window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
 }
 const visible = workers.filter(worker => (!focus || worker.id === focus) && (inactive || focus || worker.is_active) && (payType === 'all' || worker.pay_type === payType) && `${worker.name} ${worker.role ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
 return <WorkerEditor today={today} initialOpen={params.get('add') === 'worker'} returnTo={returnTo}>{({ add, edit }) => <section className="space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{tx('Workers')}</h1><p className="mt-2 text-sm text-body">{tx('Manage piece-rate and fixed-salary workers.')}</p></div><Button onClick={add}>{tx('Add worker')}</Button></header>
  {returnTo && <NavigationLink className="inline-flex min-h-11 items-center text-saffron-deep underline" href={returnTo}>{tx(managementReturnLabel(returnTo))}</NavigationLink>}
  {focus && <p role="status">{tx(workers.some(worker => worker.id === focus) ? 'Worker filter active' : 'This record is unavailable.')} <Button variant="outline" onClick={() => update('worker', '')}>{tx('Clear filter')}</Button></p>}
  <div className="flex flex-wrap items-center gap-3"><Input className="w-full sm:max-w-xs" aria-label={tx('Search workers')} placeholder={tx('Search workers')} value={search} onChange={event => update('search', event.target.value)} /><label>{tx('Pay type')} <select className="min-h-11 rounded border bg-surface p-2" value={payType} onChange={event => update('payType', event.target.value)}><option value="all">{tx('All')}</option><option value="piece_rate">{tx('Piece-rate')}</option><option value="fixed_monthly">{tx('Fixed salary')}</option></select></label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={inactive} onChange={event => update('inactive', event.target.checked ? '1' : '')} />{tx('Show inactive')}</label></div>
  <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">{visible.map(worker => <div key={worker.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p data-i18n-skip="true" className="font-semibold">{worker.name}</p>{!worker.is_active && <Badge variant="secondary">{tx('Inactive')}</Badge>}<p className="mt-1 text-sm text-body">{worker.pay_type === 'fixed_monthly' ? <>{tx('Fixed salary')} · <span data-i18n-skip="true">{worker.role} · {formatINR(currentBaseMonthlySalary(worker, today))}</span></> : tx(worker.shift_availability === 'both' ? 'Day & night' : worker.shift_availability === 'day' ? 'Day shift' : 'Night shift')}</p></div><div className="flex flex-wrap items-center gap-2">{worker.pay_type !== 'fixed_monthly' && <NavigationLink className="inline-flex min-h-11 items-center text-sm text-saffron-deep underline" href={`/owner/assignments?worker=${worker.id}`}>{tx('View machine assignments')}</NavigationLink>}<Button variant="outline" onClick={() => edit(worker)} aria-label={`${tx('Edit')} ${worker.name}`}>{tx('Edit')}</Button></div></div>)}{!visible.length && <div className="space-y-3 p-8 text-center"><p>{tx(workers.length ? 'No workers match this view' : 'Add your first worker')}</p>{!workers.length && <Button onClick={add}>{tx('Add worker')}</Button>}</div>}</div>
 </section>}</WorkerEditor>
}
