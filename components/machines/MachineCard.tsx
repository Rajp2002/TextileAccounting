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
  onEdit: (machine: BaseProductionMachineWithReadiness) => void
}

export function MachineCard({ machine, onEdit }: MachineCardProps) {
  const { tx } = useTranslation()
  const readiness = getMachineReadiness(machine)
  const displayName = machine.custom_label || machine.name
  const formattedType = machine.machine_type ? machine.machine_type.replaceAll('_', ' ') : ''

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
                readiness.isActive
                  ? 'border-hairline/80 bg-surface-soft/80 text-subtle'
                  : 'border-hairline/50 bg-muted/15 text-subtle/60'
              )}
              aria-hidden="true"
            >
              <Cog className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                data-i18n-skip="true"
                className="truncate text-base sm:text-lg font-semibold tracking-tight text-ink"
              >
                {displayName}
              </h3>
              {formattedType && (
                <p className="truncate text-xs sm:text-[13px] capitalize text-subtle">
                  {tx(formattedType)}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 pt-0.5">
            <MachineStatusBadge status={readiness.status} />
          </div>
        </div>

        {/* B. Operational Configuration Details */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-hairline/60 bg-surface-soft/30 p-3.5">
          {/* Worker */}
          <div className="min-w-0 space-y-1">
            <span className="text-xs font-medium text-subtle uppercase tracking-wider">
              {tx('Worker')}
            </span>
            <p
              data-i18n-skip={readiness.hasWorker ? 'true' : undefined}
              className={cn(
                'truncate text-sm font-medium',
                readiness.hasWorker ? 'text-ink' : 'text-subtle/70 font-normal italic'
              )}
            >
              {readiness.hasWorker && readiness.workerName
                ? readiness.workerName
                : tx('Not assigned')}
            </p>
          </div>

          {/* Costing */}
          <div className="min-w-0 space-y-1">
            <span className="text-xs font-medium text-subtle uppercase tracking-wider">
              {tx('Costing')}
            </span>
            <p
              data-i18n-skip={readiness.hasCosting ? 'true' : undefined}
              className={cn(
                'truncate text-sm font-medium',
                readiness.hasCosting ? 'text-ink' : 'text-subtle/70 font-normal italic'
              )}
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
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline/60 pt-4">
        {/* Primary Action: View Assignment */}
        <NavigationLink
          href={`/owner/assignments?machine=${machine.id}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface px-3.5 text-xs sm:text-sm font-medium text-ink shadow-2xs transition-all hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          aria-label={`${tx('View assignment for')} ${displayName}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-saffron-deep" aria-hidden="true" />
          <span>{tx('View assignment')}</span>
        </NavigationLink>

        {/* Secondary Action: Edit */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(machine)}
          className="min-h-10 rounded-xl px-3 text-xs sm:text-sm font-medium text-subtle hover:bg-surface-soft hover:text-ink focus-visible:ring-saffron"
          aria-label={`${tx('Edit')} ${displayName}`}
        >
          <Edit3 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          <span>{tx('Edit')}</span>
        </Button>
      </div>
    </article>
  )
}
