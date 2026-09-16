'use client'

import React from 'react'
import { User, SlidersHorizontal, Edit3, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import {
  getWorkerOperationalSummary,
  type BaseProductionWorkerWithOperational,
} from '@/lib/worker-operational'
import { WorkerStatusBadge } from './WorkerStatusBadge'
import { cn } from '@/lib/utils'
import { workersTutorialCopy } from '@/lib/i18n/workers-tutorial'
import { WorkerPayBasis } from './WorkerPayBasis'

interface WorkerCardProps {
  worker: BaseProductionWorkerWithOperational
  tourPreview?: boolean
  onEdit: (worker: BaseProductionWorker) => void
}

export function WorkerCard({ worker, onEdit, tourPreview = false }: WorkerCardProps) {
  const { tx, language = 'en' } = useTranslation()
  const copy = workersTutorialCopy[language]
  const summary = getWorkerOperationalSummary(worker)

  const shiftLabel = tx(
    worker.shift_availability === 'both'
      ? 'Day & night'
      : worker.shift_availability === 'day'
        ? 'Day shift'
        : 'Night shift'
  )

  const subtitle = summary.isFixedSalary
    ? worker.role
      ? `${worker.role} · ${shiftLabel}`
      : `${tx('Staff')} · ${shiftLabel}`
    : shiftLabel

  return (
    <article
      className={cn(
        'group flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 shadow-xs transition-all duration-150',
        'hover:border-hairline-strong hover:shadow-sm motion-safe:hover:-translate-y-0.5'
      )}
    >
      <div className="space-y-4">
        {/* A. Card Header: Identity + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                worker.is_active
                  ? 'border-hairline/80 bg-surface-soft/80 text-subtle'
                  : 'border-hairline/50 bg-muted/15 text-subtle/60'
              )}
              aria-hidden="true"
            >
              <User className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                data-i18n-skip="true"
                className="truncate text-base sm:text-lg font-semibold tracking-tight text-ink"
              >
                {worker.name}
              </h3>
              <p className="truncate text-xs sm:text-[13px] text-subtle">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="shrink-0 pt-0.5">
            <WorkerStatusBadge isActive={worker.is_active} />
          </div>
        </div>

        {/* B. Operational Configuration Details */}
        <div data-workers-tour="readiness" className="grid grid-cols-2 gap-3 rounded-xl border border-hairline/60 bg-surface-soft/30 p-3.5">
          {summary.isPieceRate ? (
            <>
              {/* Piece-Rate Col 1: Machines */}
              <div className="min-w-0 space-y-1">
                <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                  {tx('Machines')}
                </span>
                <p
                  className={cn(
                    'truncate text-sm font-medium',
                    summary.assignedMachineCount > 0 ? 'text-ink' : 'text-subtle/70 font-normal italic'
                  )}
                >
                  {summary.assignedMachineCount > 0
                    ? `${summary.assignedMachineCount} ${tx('assigned')}`
                    : tx('Not assigned')}
                </p>
              </div>

              {/* Piece-Rate Col 2: Authoritative wage source */}
              <div className="min-w-0 space-y-1">
                <span data-i18n-skip="true" lang={language} className="text-xs font-medium text-subtle uppercase tracking-wider">
                  {copy.wageLabel}
                </span>
                <p className="text-sm font-medium text-ink" data-i18n-skip="true" lang={language}>
                  <WorkerPayBasis worker={worker} />
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Fixed-Salary Col 1: Salary configuration (amounts kept private) */}
              <div className="min-w-0 space-y-1">
                <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                  {tx('Salary')}
                </span>
                <p
                  className={cn(
                    'truncate text-sm font-medium',
                    summary.hasSalaryConfigured ? 'text-ink' : 'text-subtle/70 font-normal italic'
                  )}
                >
                  {tx(summary.salaryStatusLabel)}
                </p>
              </div>

              {/* Fixed-Salary Col 2: Machines (if assigned) or Payroll */}
              <div className="min-w-0 space-y-1">
                {summary.assignedMachineCount > 0 ? (
                  <>
                    <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                      {tx('Machines')}
                    </span>
                    <p className="truncate text-sm font-medium text-ink">
                      {summary.assignedMachineCount} {tx('assigned')}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-medium text-subtle uppercase tracking-wider">
                      {tx('Payroll')}
                    </span>
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        summary.payrollStatusLabel === 'Ready' ? 'text-ink' : 'text-subtle/70 font-normal italic'
                      )}
                    >
                      {tx(summary.payrollStatusLabel)}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* C. Card Actions */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline/60 pt-4">
        {/* Primary Contextual Action */}
        {summary.isPieceRate || summary.assignedMachineCount > 0 ? (
          <NavigationLink
            data-workers-tour="assignments"
            href={tourPreview ? "#" : `/owner/assignments?worker=${worker.id}`}
            onClick={event => { if (tourPreview) event.preventDefault() }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface px-3.5 text-xs sm:text-sm font-medium text-ink shadow-2xs transition-all hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            aria-label={`${tx('View machine assignments for')} ${worker.name}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-saffron-deep" aria-hidden="true" />
            <span>{tx('View assignments')}</span>
          </NavigationLink>
        ) : (
          <NavigationLink
            data-workers-tour="payroll"
            href={tourPreview ? "#" : "/owner/payroll"}
            onClick={event => { if (tourPreview) event.preventDefault() }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface px-3.5 text-xs sm:text-sm font-medium text-ink shadow-2xs transition-all hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            aria-label={`${tx('View payroll for')} ${worker.name}`}
          >
            <FileText className="h-3.5 w-3.5 text-saffron-deep" aria-hidden="true" />
            <span>{tx('View payroll')}</span>
          </NavigationLink>
        )}

        {/* Secondary Action: Edit */}
        <Button
          variant="ghost"
          size="sm"
          data-workers-tour="edit"
          onClick={() => { if (!tourPreview) onEdit(worker) }}
          className="min-h-10 rounded-xl px-3 text-xs sm:text-sm font-medium text-subtle hover:bg-surface-soft hover:text-ink focus-visible:ring-saffron"
          aria-label={`${tx('Edit')} ${worker.name}`}
        >
          <Edit3 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          <span>{tx('Edit')}</span>
        </Button>
      </div>
    </article>
  )
}
