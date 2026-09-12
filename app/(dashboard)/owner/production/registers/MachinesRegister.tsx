'use client'

import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import type { BaseProductionMachine } from '@/lib/base-production-core'
import { MachinesPageHeader } from '@/components/machines/MachinesPageHeader'
import { MachineRegisterPanel } from '@/components/machines/MachineRegisterPanel'
import MachineEditor from './MachineEditor'

export default function MachinesRegister({
  machines,
  today,
}: {
  machines: BaseProductionMachine[]
  today: string
}) {
  const params = useSearchParams()
  const { tx } = useTranslation()
  useLocalizedPageTitle(`${tx('Machines')} | Weavly`)

  const search = params.get('search') ?? ''
  const inactive = params.get('inactive') === '1'
  const returnTo = safeBaseReturnPath(params.get('returnTo'))

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    window.history.replaceState(null, '', `/owner/machines${next.size ? `?${next}` : ''}`)
  }

  const visible = machines.filter(machine =>
    (inactive || machine.is_active) &&
    `${machine.name} ${machine.custom_label ?? ''} ${machine.machine_type.replaceAll('_', ' ')}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  return (
    <MachineEditor
      today={today}
      initialOpen={params.get('add') === 'machine'}
      returnTo={returnTo}
    >
      {({ add, edit }) => (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <MachinesPageHeader onAdd={add} returnTo={returnTo} />

          <MachineRegisterPanel
            machines={machines}
            visible={visible}
            search={search}
            onSearchChange={val => update('search', val)}
            inactive={inactive}
            onInactiveChange={showInactive => update('inactive', showInactive ? '1' : '')}
            onAdd={add}
            onEdit={edit}
          />
        </div>
      )}
    </MachineEditor>
  )
}
