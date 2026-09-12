'use client'

import React from 'react'
import { Cog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionMachine } from '@/lib/base-production-core'
import { cn } from '@/lib/utils'

interface MachineRowProps {
  machine: BaseProductionMachine
  onEdit: (machine: BaseProductionMachine) => void
}

export function MachineRow({ machine, onEdit }: MachineRowProps) {
  const { tx } = useTranslation()
  const displayName = machine.custom_label || machine.name
  const formattedType = machine.machine_type ? machine.machine_type.replaceAll('_', ' ') : ''

  return (
    <div className={cn(
      'group flex flex-col gap-3 p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-3.5',
      'hover:bg-surface-soft/35'
    )}>
      {/* Identity + Status (combined on mobile, separate columns on desktop) */}
      <div className="flex items-start justify-between gap-3 sm:flex-1 sm:items-center">
        {/* Left: Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
              machine.is_active
                ? 'border-hairline/80 bg-surface-soft/80 text-subtle'
                : 'border-hairline/50 bg-muted/15 text-subtle/60'
            )}
            aria-hidden="true"
          >
            <Cog className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p data-i18n-skip="true" className="truncate text-[15px] font-semibold text-ink">
              {displayName}
            </p>
            {formattedType && (
              <p className="truncate text-xs sm:text-[13px] capitalize text-subtle">
                {tx(formattedType)}
              </p>
            )}
          </div>
        </div>

        {/* Middle: Status badge (visible here on mobile, positioned in-between on desktop) */}
        <div className="shrink-0 sm:hidden">
          {machine.is_active ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft/60 px-2.5 py-0.5 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {tx('Active')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/20 px-2.5 py-0.5 text-xs font-medium text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-subtle/60" aria-hidden="true" />
              {tx('Inactive')}
            </span>
          )}
        </div>
      </div>

      {/* Status badge on desktop */}
      <div className="hidden shrink-0 sm:flex sm:items-center sm:px-4">
        {machine.is_active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft/60 px-2.5 py-0.5 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {tx('Active')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-muted/20 px-2.5 py-0.5 text-xs font-medium text-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-subtle/60" aria-hidden="true" />
            {tx('Inactive')}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 pt-1 sm:pt-0">
        <NavigationLink
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-saffron-deep transition-colors hover:text-saffron-deep/80 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          href={`/owner/assignments?machine=${machine.id}`}
        >
          {tx('View assignments')}
        </NavigationLink>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 sm:min-h-9 rounded-lg border-hairline px-3.5 text-sm font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:ring-saffron"
          onClick={() => onEdit(machine)}
          aria-label={`${tx('Edit')} ${displayName}`}
        >
          {tx('Edit')}
        </Button>
      </div>
    </div>
  )
}
