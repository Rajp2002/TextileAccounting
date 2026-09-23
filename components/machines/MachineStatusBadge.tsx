'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { MachineReadinessStatus } from '@/lib/machine-readiness'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface MachineStatusBadgeProps {
  status: MachineReadinessStatus
  className?: string
}

export function MachineStatusBadge({ status, className }: MachineStatusBadgeProps) {
  const { tx } = useTranslation()
  const isActive = status === 'active'

  return (
    <Badge
      variant={isActive ? 'success' : 'warning'}
      className={cn(
        'gap-1.5 px-2.5 py-0.5 text-xs font-medium',
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
    </Badge>
  )
}
