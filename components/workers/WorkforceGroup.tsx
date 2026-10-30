'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import type { BaseProductionWorkerWithOperational } from '@/lib/worker-operational'
import { Badge } from '@/components/ui/badge'
import { WorkerCard } from './WorkerCard'

interface WorkforceGroupProps {
  title: string
  subtitle: string
  workers: BaseProductionWorkerWithOperational[]
  count?: number
  emptyText: string
  tourPreview?: boolean
  /** Workers added since the page opened; their cards play the arrival highlight. */
  arrivedIds?: ReadonlySet<string>
  onEdit: (worker: BaseProductionWorker) => void
}

export function WorkforceGroup({
  title,
  subtitle,
  workers,
  count,
  emptyText,
  onEdit,
  tourPreview = false,
  arrivedIds,
}: WorkforceGroupProps) {
  const { tx } = useTranslation()

  const resolvedCount = typeof count === 'number' ? count : workers.length
  const countLabel =
    resolvedCount === 1
      ? `1 ${tx('worker')}`
      : `${resolvedCount} ${tx('workers')}`

  return (
    <section className="flex min-w-0 flex-col gap-3.5 fit-screen:min-h-0">
      {/* Group Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold leading-[1.3] text-ink sm:text-lg">
              {title}
            </h2>
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-medium text-subtle">
              {countLabel}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-subtle sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Group Content */}
      {workers.length > 0 ? (
        // In a window-high column the list takes what is left and scrolls; the 4px inset keeps shadows and focus rings unclipped.
        <ul role="list" className="flex flex-col gap-3 fit-screen:-mx-1 fit-screen:-mt-1 fit-screen:min-h-0 fit-screen:overflow-y-auto fit-screen:overscroll-contain fit-screen:p-1">
          {workers.map(worker => (
            <li key={worker.id} role="listitem" className={arrivedIds?.has(worker.id) ? 'ui-row-arrive' : undefined}>
              <WorkerCard worker={worker} onEdit={onEdit} tourPreview={tourPreview} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-hairline/80 bg-surface/50 p-6 text-center">
          <p className="text-sm font-medium text-subtle italic">
            {emptyText}
          </p>
        </div>
      )}
    </section>
  )
}
