'use client'

import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'

interface MachinesPageHeaderProps {
  onAdd: () => void
  returnTo?: string
}

export function MachinesPageHeader({ onAdd, returnTo }: MachinesPageHeaderProps) {
  const { tx } = useTranslation()

  return (
    <div className="space-y-3">
      {returnTo && (
        <div>
          <NavigationLink
            className="inline-flex min-h-11 items-center text-sm font-medium text-saffron-deep underline transition-colors hover:text-saffron-deep/80 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            href={returnTo}
          >
            {tx(managementReturnLabel(returnTo))}
          </NavigationLink>
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {tx('Machines')}
          </h1>
          <p className="mt-1 text-sm text-subtle">
            {tx('Add and manage the machines in your factory.')}
          </p>
        </div>

        <div className="shrink-0">
          <Button
            onClick={onAdd}
            className="h-10 w-full sm:w-auto rounded-xl bg-loom px-4 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-saffron"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{tx('Add machine')}</span>
          </Button>
        </div>
      </header>
    </div>
  )
}
