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

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:min-h-12 sm:grid-cols-[1fr_auto_1fr]">
        <div className="min-w-0 sm:col-start-2 sm:row-start-1 sm:text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {tx('Machines')}
          </h1>
          <p className="mt-1 text-sm text-subtle">
            {tx('Add and manage the machines in your factory.')}
          </p>
        </div>

        <div className="shrink-0 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
          <Button
            onClick={onAdd}
            className="h-10 rounded-xl px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{tx('Add machine')}</span>
          </Button>
        </div>
      </header>
    </div>
  )
}
