'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { navigationIntentForClick, startNavigationIntent } from '@/lib/navigation-intent'
import { cn } from '@/lib/utils'

/**
 * Keep Next's partial prefetching and interruptible navigation in one place. A tap
 * records its destination, so tabs and menus select it before the page arrives.
 */
export function NavigationLink({ className, onClick, ...props }: ComponentProps<typeof Link>) {
    const pathname = usePathname()

    return (
        <Link
            {...props}
            onClick={event => {
                onClick?.(event)
                startNavigationIntent(navigationIntentForClick(event, props.href, pathname))
            }}
            className={cn('mobile-touch-target relative', className)}
        />
    )
}
