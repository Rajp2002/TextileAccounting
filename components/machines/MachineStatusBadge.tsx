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
  const isInactive = status === 'inactive'

  return (
    <Badge
      variant={isActive ? 'success' : isInactive ? 'secondary' : 'warning'}
      className={cn(
        'gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold',
        isActive && 'border-success/15',
        status === 'needs_setup' && 'border-warning/20',
        isInactive && 'text-subtle',
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-success' : isInactive ? 'bg-subtle/60' : 'bg-warning'
        )}
        aria-hidden="true"
      />
      <span>{isActive ? tx('Active') : isInactive ? tx('Inactive') : tx('Needs setup')}</span>
    </Badge>
  )
}
