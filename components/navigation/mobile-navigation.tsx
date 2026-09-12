'use client'

import { useEffect, useRef, type ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { cn } from '@/lib/utils'

export function MobileNavigation({ children, className, style, ...props }: ComponentProps<'nav'>) {
    const ref = useRef<HTMLElement>(null)
    const keyboardVisible = useMobileKeyboard()

    useEffect(() => {
        const nav = ref.current
        if (!nav) return
        const root = document.documentElement
        const measure = () => {
            const height = nav.getBoundingClientRect().height
            // Preserve clearance during keyboard entry to avoid jumping scroll
            // positions. ResizeObserver also catches translated labels wrapping.
            if (height > 0) root.style.setProperty('--mobile-nav-height', `${Math.ceil(height)}px`)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(nav)
        return () => {
            observer.disconnect()
            root.style.removeProperty('--mobile-nav-height')
        }
    }, [])

    return (
        <nav
            {...props}
            ref={ref}
            data-mobile-navigation="true"
            className={cn('mobile-navigation md:hidden', className)}
            style={{ ...style, ...(keyboardVisible ? { display: 'none' } : {}) }}
        >
            {children}
        </nav>
    )
}

export function MobileNavigationLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <>
            <span className="mobile-navigation-icon"><Icon aria-hidden="true" /></span>
            <span className="mobile-navigation-label">{label}</span>
        </>
    )
}
