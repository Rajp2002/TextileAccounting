'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import type { BaseProductionWorkerWithOperational } from '@/lib/worker-operational'
import { WorkerCard } from './WorkerCard'

interface WorkforceGroupProps {
  title: string
  subtitle: string
  workers: BaseProductionWorkerWithOperational[]
  count?: number
  emptyText: string
  tourPreview?: boolean
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
}: WorkforceGroupProps) {
  const { tx } = useTranslation()

  const resolvedCount = typeof count === 'number' ? count : workers.length
  const countLabel =
    resolvedCount === 1
      ? `1 ${tx('worker')}`
      : `${resolvedCount} ${tx('workers')}`

  return (
    <section className="flex flex-col space-y-3.5">
      {/* Group Header */}
      <div className="flex items-start justify-between gap-3 border-b border-hairline/60 pb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <span className="inline-flex items-center rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-subtle border border-hairline/60">
              {countLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-subtle">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Group Content */}
      {workers.length > 0 ? (
        <ul role="list" className="flex flex-col space-y-3.5">
          {workers.map(worker => (
            <li key={worker.id} role="listitem">
              <WorkerCard worker={worker} onEdit={onEdit} tourPreview={tourPreview} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-hairline/80 bg-surface/50 p-6 text-center">
          <p className="text-sm font-medium text-subtle/80 italic">
            {emptyText}
          </p>
        </div>
      )}
    </section>
  )
}
