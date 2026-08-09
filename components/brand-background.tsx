import { cn } from '@/lib/utils'

type BrandBackgroundProps = {
    className?: string
    variant?: 'app' | 'auth'
}

export function BrandBackground({ className, variant = 'app' }: BrandBackgroundProps) {
    const isAuth = variant === 'auth'

    return (
        <div
            className={cn(
                'weavly-app-bg pointer-events-none fixed inset-0 z-0 overflow-hidden',
                className
            )}
            aria-hidden="true"
        >
            <div className={cn(
                'absolute inset-0',
                isAuth ? 'bg-[var(--color-app-bg)]/35' : 'bg-[var(--color-app-bg)]/10'
            )} />

        </div>
    )
}
