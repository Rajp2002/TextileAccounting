'use client'

import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { railPrimaryAction } from '@/components/ui/rail'
import { PageHeader } from '@/components/ui/page-header'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'
import { cn } from '@/lib/utils'

interface MachinesPageHeaderProps {
  onAdd: () => void
  /** The route's Guide (tour and help), drawn before the primary action. */
  guide?: React.ReactNode
  returnTo?: string
}

export function MachinesPageHeader({ onAdd, guide, returnTo }: MachinesPageHeaderProps) {
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

      <PageHeader
        title={tx('Machines')}
        description={<span className="sr-only">{tx('Add and manage the machines in your factory.')}</span>}
        actions={<>{guide}<MachineAddButton onAdd={onAdd} /></>}
      />
    </div>
  )
}

export function MachineAddButton({ onAdd, className }: { onAdd: () => void; className?: string }) {
  const { tx } = useTranslation()

  return (
    <Button
      data-tour-anchor="machines.add"
      onClick={onAdd}
      className={cn(railPrimaryAction, className)}
    >
      <Plus className="size-4" aria-hidden="true" />
      <span>{tx('Add machine')}</span>
    </Button>
  )
}
