'use client'

import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { railPrimaryAction } from '@/components/ui/rail'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'
import { cn } from '@/lib/utils'

interface MachinesPageHeaderProps {
  onAdd: () => void
  returnTo?: string
}

export function MachinesPageHeader({ onAdd, returnTo }: MachinesPageHeaderProps) {
  const { tx } = useTranslation()

  return (
    <div className="space-y-4">
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

      <header className="relative border-b border-hairline/70 pb-5 text-center sm:pb-6">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
          {tx('Machines')}
        </h1>
        <p className="sr-only">{tx('Add and manage the machines in your factory.')}</p>
        <div className="machines-inline-add mt-3 flex justify-end sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <MachineAddButton onAdd={onAdd} />
        </div>
      </header>
    </div>
  )
}

export function MachineAddButton({ onAdd, className }: { onAdd: () => void; className?: string }) {
  const { tx } = useTranslation()

  return (
    <Button
      onClick={onAdd}
      className={cn(railPrimaryAction, className)}
    >
      <Plus className="size-4" aria-hidden="true" />
      <span>{tx('Add machine')}</span>
    </Button>
  )
}
