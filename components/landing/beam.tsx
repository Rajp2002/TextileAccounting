import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import s from './landing.module.css'

type Tone = 'paper' | 'deep' | 'loom'

/**
 * One band of the page. The inner box has the same width and outer gutters as
 * the navbar panel, and its edges are drawn as the two warp hairlines, so the
 * navbar reads as the top of the beam every section hangs from.
 */
export function Beam({
    id,
    tone = 'paper',
    labelledBy,
    className,
    innerClassName,
    children,
}: {
    id?: string
    tone?: Tone
    labelledBy?: string
    className?: string
    innerClassName?: string
    children: ReactNode
}) {
    return (
        <section
            id={id}
            aria-labelledby={labelledBy}
            className={cn(tone === 'loom' && s.onLoom, tone === 'deep' && s.onDeep, 'px-3 xs:px-4 sm:px-6 lg:px-8', className)}
        >
            <div className={cn(s.warp, 'mx-auto max-w-7xl')}>
                <div className={cn('px-4 xs:px-5 md:px-8 lg:px-10', innerClassName)}>{children}</div>
            </div>
        </section>
    )
}

export function Eyebrow({ children, tone = 'paper', className }: { children: ReactNode; tone?: Tone; className?: string }) {
    return (
        <p className={cn(s.label, 'flex items-center gap-3', tone === 'loom' ? 'text-[color:var(--lp-on-loom-muted)]' : 'text-[color:var(--lp-muted)]', className)}>
            <span className="h-[2px] w-6 flex-none bg-[color:var(--lp-saffron)]" aria-hidden="true" />
            {children}
        </p>
    )
}
