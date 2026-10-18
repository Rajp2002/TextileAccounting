import type { ReactNode } from 'react'
import { CalendarClock } from 'lucide-react'

import { cn } from '@/lib/utils'

/** One quiet line telling the owner or supervisor what waits for go-live. */
export function GoLiveNotice({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div role="status" data-go-live-notice className={cn('flex items-start gap-2 rounded-xl border border-hairline bg-surface-soft px-4 py-3 text-sm text-body', className)}>
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0">{children}</p>
        </div>
    )
}
