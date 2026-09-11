'use client'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useSearchParams } from 'next/navigation'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import type { BaseProductionMachine } from '@/lib/base-production-core'
import MachineEditor from './MachineEditor'

export default function MachinesRegister({ machines, today }: { machines: BaseProductionMachine[]; today: string }) {
 const params = useSearchParams()
 const { tx } = useTranslation()
 useLocalizedPageTitle(`${tx('Machines')} | Weavly`)
 const search = params.get('search') ?? ''
 const inactive = params.get('inactive') === '1'
 const returnTo = safeBaseReturnPath(params.get('returnTo'))
 const update = (key: string, value: string) => {
   const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key)
   window.history.replaceState(null, '', `/owner/machines${next.size ? `?${next}` : ''}`)
 }
 const visible = machines.filter(machine => (inactive || machine.is_active) && `${machine.name} ${machine.custom_label ?? ''} ${machine.machine_type.replaceAll('_', ' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
 return <MachineEditor today={today} initialOpen={params.get('add') === 'machine'} returnTo={returnTo}>{({ add, edit }) => <section className="space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{tx('Machines')}</h1><p className="mt-2 text-sm text-body">{tx("Manage your factory's machines.")}</p></div><Button onClick={add}>{tx('Add machine')}</Button></header>
  {returnTo && <NavigationLink className="inline-flex min-h-11 items-center text-saffron-deep underline" href={returnTo}>{tx(managementReturnLabel(returnTo))}</NavigationLink>}
  <div className="flex flex-wrap items-center gap-3"><Input className="w-full sm:max-w-xs" aria-label={tx('Search machines')} placeholder={tx('Search machines')} value={search} onChange={event => update('search', event.target.value)} /><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={inactive} onChange={event => update('inactive', event.target.checked ? '1' : '')} />{tx('Show inactive')}</label></div>
  <div className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">{visible.map(machine => <div key={machine.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p data-i18n-skip="true" className="font-semibold">{machine.custom_label || machine.name}</p>{!machine.is_active && <Badge variant="secondary">{tx('Inactive')}</Badge>}<p className="mt-1 text-sm capitalize text-body">{tx(machine.machine_type.replaceAll('_', ' '))}</p></div><div className="flex flex-wrap items-center gap-2"><NavigationLink className="inline-flex min-h-11 items-center text-sm text-saffron-deep underline" href={`/owner/assignments?machine=${machine.id}`}>{tx('View worker assignments')}</NavigationLink><Button variant="outline" onClick={() => edit(machine)} aria-label={`${tx('Edit')} ${machine.custom_label || machine.name}`}>{tx('Edit')}</Button></div></div>)}{!visible.length && <div className="space-y-3 p-8 text-center"><p>{tx(machines.length ? 'No machines match this view' : 'Add your first machine')}</p>{!machines.length && <Button onClick={add}>{tx('Add machine')}</Button>}</div>}</div>
 </section>}</MachineEditor>
}
