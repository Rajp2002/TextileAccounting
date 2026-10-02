'use client'

import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Keep Next's partial prefetching and interruptible navigation in one place. */
export function NavigationLink({ children, className, ...props }: ComponentProps<typeof Link>) {
    return (
        <Link {...props} className={cn('mobile-touch-target relative', className)}>
            {children}
            <NavigationPending />
        </Link>
    )
}

function NavigationPending() {
    const { pending } = useLinkStatus()

    return pending ? (
        <span
            aria-hidden="true"
            data-navigation-pending="true"
            className="navigation-pending pointer-events-none absolute inset-0 rounded-[inherit] border border-current bg-current/10"
        />
    ) : null
}
