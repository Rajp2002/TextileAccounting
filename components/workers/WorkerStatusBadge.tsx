'use client'

import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface WorkerStatusBadgeProps {
  isActive: boolean
  className?: string
}

export function WorkerStatusBadge({ isActive, className }: WorkerStatusBadgeProps) {
  const { tx } = useTranslation()

  return (
    <Badge
      variant={isActive ? 'success' : 'secondary'}
      className={cn('gap-1.5 px-2.5 py-1 text-xs font-medium', className)}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-success' : 'bg-subtle/60'
        )}
        aria-hidden="true"
      />
      <span>{isActive ? tx('Active') : tx('Inactive')}</span>
    </Badge>
  )
}
