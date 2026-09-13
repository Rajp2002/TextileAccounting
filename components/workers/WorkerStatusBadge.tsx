'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

interface WorkerStatusBadgeProps {
  isActive: boolean
  className?: string
}

export function WorkerStatusBadge({ isActive, className }: WorkerStatusBadgeProps) {
  const { tx } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
        isActive
          ? 'border-success/30 bg-success-soft/60 text-success'
          : 'border-hairline bg-muted/20 text-subtle',
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-success' : 'bg-subtle/60'
        )}
        aria-hidden="true"
      />
      <span>{isActive ? tx('Active') : tx('Inactive')}</span>
    </span>
  )
}
