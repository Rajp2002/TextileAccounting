'use client'

import React from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { railPrimaryAction } from '@/components/ui/rail'
import { PageHeader } from '@/components/ui/page-header'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'
import { cn } from '@/lib/utils'

interface WorkersPageHeaderProps {
  onAdd: () => void
  /** The route's Guide (tour and help), drawn before the primary action. */
  guide?: React.ReactNode
  returnTo?: string
  focus?: string | null
  hasFocusedWorker?: boolean
  onClearFocus?: () => void
}

export function WorkersPageHeader({
  onAdd,
  guide,
  returnTo,
  focus,
  hasFocusedWorker,
  onClearFocus,
}: WorkersPageHeaderProps) {
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

      {focus && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-soft/60 px-4 py-3 text-sm text-ink"
        >
          <span>
            {tx(hasFocusedWorker ? 'Worker filter active' : 'This record is unavailable.')}
          </span>
          {onClearFocus && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFocus}
              className="rounded-lg border-hairline font-medium text-ink hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"
            >
              {tx('Clear filter')}
            </Button>
          )}
        </div>
      )}

      <PageHeader
        title={tx('Workers')}
        description={<span className="sr-only">{tx('Add and manage your factory workforce.')}</span>}
        actions={<>{guide}<WorkerAddButton onAdd={onAdd} /></>}
      />
    </div>
  )
}

export function WorkerAddButton({ onAdd, className }: { onAdd: () => void; className?: string }) {
  const { t } = useTranslation()

  return (
    <Button
      data-tour-anchor="workers.add"
      onClick={onAdd}
      className={cn(railPrimaryAction, className)}
    >
      <UserPlus className="size-4" aria-hidden="true" />
      <span>{t('workers.addWorker')}</span>
    </Button>
  )
}
