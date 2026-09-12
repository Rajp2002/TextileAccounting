'use client'

import React from 'react'
import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { currentBaseMonthlySalary } from '@/lib/base-salary'
import { formatINR } from '@/lib/finance'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import { cn } from '@/lib/utils'

interface WorkerRowProps {
  worker: BaseProductionWorker
  today: string
  onEdit: (worker: BaseProductionWorker) => void
}

export function WorkerRow({ worker, today, onEdit }: WorkerRowProps) {
  const { tx } = useTranslation()

  const isFixed = worker.pay_type === 'fixed_monthly'
  const payTypeLabel = isFixed ? tx('Fixed salary') : tx('Piece rate')

  const shiftOrSalary = isFixed ? (
    <span data-i18n-skip="true">
      {worker.role ? `${worker.role} · ` : ''}
      {formatINR(currentBaseMonthlySalary(worker, today))}
    </span>
  ) : (
    tx(
      worker.shift_availability === 'both'
        ? 'Day & night'
        : worker.shift_availability === 'day'
          ? 'Day shift'
          : 'Night shift'
    )
  )

  return (
    <div
      className={cn(
        'group flex flex-col gap-3 p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-3.5',
        'hover:bg-surface-soft/35'
      )}
    >
      {/* Top section on mobile: Identity (left) + Status badge (right) */}
      <div className="flex items-start justify-between gap-3 sm:flex-1 sm:items-center">
        {/* Left: Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
              worker.is_active
                ? 'border-hairline/80 bg-surface-soft/80 text-subtle'
                : 'border-hairline/50 bg-muted/15 text-subtle/60'
            )}
            aria-hidden="true"
          >
            <User className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p data-i18n-skip="true" className="truncate text-[15px] font-semibold text-ink">
              {worker.name}
            </p>
            <p className="truncate text-xs sm:text-[13px] text-subtle">
              {shiftOrSalary}
            </p>
          </div>
        </div>

        {/* Status badge on mobile */}
        <div className="shrink-0 sm:hidden">
          {worker.is_active ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {tx('Active')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-subtle/60" aria-hidden="true" />
              {tx('Inactive')}
            </span>
          )}
        </div>
      </div>

      {/* Pay type (mobile row or desktop column) */}
      <div className="shrink-0 text-xs sm:text-[13px] font-medium text-ink/80 sm:w-28">
        {payTypeLabel}
      </div>

      {/* Status badge on desktop */}
      <div className="hidden shrink-0 sm:flex sm:items-center sm:w-20">
        {worker.is_active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {tx('Active')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-subtle/60" aria-hidden="true" />
            {tx('Inactive')}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 pt-1 sm:pt-0">
        {!isFixed && (
          <NavigationLink
            className="inline-flex min-h-11 items-center px-2.5 py-1 text-sm font-medium text-ink/80 transition-colors hover:bg-surface-soft/80 hover:text-ink focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron rounded-lg"
            href={`/owner/assignments?worker=${worker.id}`}
            aria-label={tx('View machine assignments')}
          >
            {tx('View assignments')}
          </NavigationLink>
        )}
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 sm:min-h-9 rounded-lg border-hairline px-3.5 text-sm font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:ring-saffron"
          onClick={() => onEdit(worker)}
          aria-label={`${tx('Edit')} ${worker.name}`}
        >
          {tx('Edit')}
        </Button>
      </div>
    </div>
  )
}
