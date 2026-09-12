'use client'

import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import { WorkersPageHeader } from '@/components/workers/WorkersPageHeader'
import { WorkerRegisterPanel } from '@/components/workers/WorkerRegisterPanel'
import WorkerEditor from './WorkerEditor'

export default function WorkersRegister({
  workers,
  today,
}: {
  workers: BaseProductionWorker[]
  today: string
}) {
  const params = useSearchParams()
  const { tx } = useTranslation()
  useLocalizedPageTitle(`${tx('Workers')} | Weavly`)

  const search = params.get('search') ?? ''
  const payType = params.get('payType') ?? 'all'
  const inactive = params.get('inactive') === '1'
  const focus = params.get('worker')
  const returnTo = safeBaseReturnPath(params.get('returnTo'))

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
  }

  const clearFilters = () => {
    const next = new URLSearchParams(params)
    next.delete('search')
    next.delete('payType')
    next.delete('inactive')
    next.delete('worker')
    window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
  }

  const visible = workers.filter(worker =>
    (!focus || worker.id === focus) &&
    (inactive || focus || worker.is_active) &&
    (payType === 'all' || worker.pay_type === payType) &&
    `${worker.name} ${worker.role ?? ''}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  const hasFocusedWorker = Boolean(focus && workers.some(worker => worker.id === focus))

  return (
    <WorkerEditor
      today={today}
      initialOpen={params.get('add') === 'worker'}
      returnTo={returnTo}
    >
      {({ add, edit }) => (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <WorkersPageHeader
            onAdd={add}
            returnTo={returnTo}
            focus={focus}
            hasFocusedWorker={hasFocusedWorker}
            onClearFocus={() => update('worker', '')}
          />

          <WorkerRegisterPanel
            workers={workers}
            visible={visible}
            today={today}
            search={search}
            onSearchChange={val => update('search', val)}
            payType={payType}
            onPayTypeChange={val => update('payType', val)}
            inactive={inactive}
            onInactiveChange={showInactive => update('inactive', showInactive ? '1' : '')}
            onAdd={add}
            onEdit={edit}
            onClearFilters={clearFilters}
          />
        </div>
      )}
    </WorkerEditor>
  )
}
