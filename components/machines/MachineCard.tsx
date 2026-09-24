'use client'

import React from 'react'
import { Cog, SlidersHorizontal, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { getMachineReadiness, type BaseProductionMachineWithReadiness } from '@/lib/machine-readiness'
import { MachineStatusBadge } from './MachineStatusBadge'
import { cn } from '@/lib/utils'

interface MachineCardProps {
  machine: BaseProductionMachineWithReadiness
  tourPreview?: boolean
  onEdit: (machine: BaseProductionMachineWithReadiness) => void
}

export function MachineCard({ machine, onEdit, tourPreview = false }: MachineCardProps) {
  const { tx } = useTranslation()
  const readiness = getMachineReadiness(machine)
  const displayName = machine.custom_label || machine.name
  const formattedType = machine.machine_type ? machine.machine_type.replaceAll('_', ' ') : ''

  return (
    <article
      data-machines-tour-id={tourPreview ? machine.id : undefined}
      className={cn(
        'group flex h-full flex-col justify-between overflow-hidden rounded-2xl border bg-surface/95 p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-200 sm:p-[18px]',
        'hover:border-saffron/35 hover:shadow-[var(--shadow-panel)] motion-safe:hover:-translate-y-0.5',
        readiness.isActive ? 'border-hairline/85' : 'border-warning/35'
      )}
    >
      <div className="space-y-4">
        {/* A. Card Header: Identity + Status */}
        <div className="flex items-start justify-between gap-3">
          <div data-machines-tour="identity" className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                readiness.isActive
                  ? 'border-saffron/20 bg-saffron-soft/45 text-saffron-deep'
                  : 'border-warning/20 bg-warning-soft/55 text-warning'
              )}
              aria-hidden="true"
            >
              <Cog className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                data-i18n-skip="true"
                className="truncate text-[15px] font-bold leading-snug tracking-tight text-ink"
              >
                {displayName}
              </h3>
              {formattedType && (
                <p className="mt-0.5 truncate text-xs capitalize text-subtle">
                  {tx(formattedType)}
                </p>
              )}
            </div>
          </div>

          <div data-machines-tour="readiness" className="shrink-0 pt-0.5">
            <MachineStatusBadge status={readiness.status} />
          </div>
        </div>

        {/* B. Operational Configuration Details */}
        <div className="grid grid-cols-2 divide-x divide-hairline/70 rounded-xl border border-hairline/70 bg-surface-soft/45 py-3">
          {/* Worker */}
          <div data-machines-tour="worker" className="min-w-0 space-y-1 px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
              {tx('Worker')}
            </span>
            <p
              data-i18n-skip={readiness.hasWorker ? 'true' : undefined}
              className={cn(
                'truncate text-sm font-semibold',
                readiness.hasWorker ? 'text-ink' : 'text-subtle/70 font-normal italic'
              )}
              title={readiness.workerName ?? undefined}
            >
              {readiness.hasWorker && readiness.workerName
                ? readiness.workerName
                : tx('Not assigned')}
            </p>
          </div>

          {/* Costing */}
          <div data-machines-tour="costing" className="min-w-0 space-y-1 px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
              {tx('Costing')}
            </span>
            <p
              data-i18n-skip={readiness.hasCosting ? 'true' : undefined}
              className={cn(
                'truncate text-sm font-semibold',
                readiness.hasCosting ? 'text-ink' : 'text-subtle/70 font-normal italic'
              )}
              title={readiness.costingLabel ?? undefined}
            >
              {readiness.hasCosting && readiness.costingLabel
                ? readiness.costingLabel
                : readiness.hasCosting
                  ? tx('Assigned')
                  : tx('Not assigned')}
            </p>
          </div>
        </div>
      </div>

      {/* C. Card Actions */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline/70 pt-3">
        {/* Primary Action: View Assignment */}
        <NavigationLink
          data-machines-tour="assignments"
          href={tourPreview ? "#" : `/owner/assignments?machine=${machine.id}`}
          onClick={event => { if (tourPreview) event.preventDefault() }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:border-saffron/45 hover:bg-saffron-soft/45 hover:text-saffron-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
          aria-label={`${tx('View assignment for')} ${displayName}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-saffron-deep" aria-hidden="true" />
          <span>{tx('View assignment')}</span>
        </NavigationLink>

        {/* Secondary Action: Edit */}
        <Button
          variant="ghost"
          size="sm"
          data-machines-tour="edit"
          onClick={() => { if (!tourPreview) onEdit(machine) }}
          className="min-h-10 rounded-xl px-3 text-xs font-semibold text-subtle hover:bg-surface-soft hover:text-ink focus-visible:ring-saffron/40 sm:text-sm"
          aria-label={`${tx('Edit')} ${displayName}`}
        >
          <Edit3 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          <span>{tx('Edit')}</span>
        </Button>
      </div>
    </article>
  )
}
