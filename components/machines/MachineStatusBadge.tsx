'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { MachineReadinessStatus } from '@/lib/machine-readiness'
import { cn } from '@/lib/utils'

interface MachineStatusBadgeProps {
  status: MachineReadinessStatus
  className?: string
}

export function MachineStatusBadge({ status, className }: MachineStatusBadgeProps) {
  const { tx } = useTranslation()
  const isActive = status === 'active'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
        isActive
          ? 'border-success/30 bg-success-soft/60 text-success'
          : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-success' : 'bg-amber-500'
        )}
        aria-hidden="true"
      />
      <span>{isActive ? tx('Active') : tx('Needs setup')}</span>
    </span>
  )
}
