import { cn } from '@/lib/utils'

const blobPolygon = 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'

type BrandBackgroundProps = {
    className?: string
    variant?: 'app' | 'auth' | 'billing' | 'payroll' | 'machines'
}

export function BrandBackground({ className, variant = 'app' }: BrandBackgroundProps) {
    const isAuth = variant === 'auth'
    const isQuiet = variant === 'billing' || variant === 'payroll' || variant === 'machines'
    const blobOpacity = isQuiet ? 'opacity-20 dark:opacity-10' : 'opacity-40 dark:opacity-35'

    return (
        <div
            className={cn(
                'weavly-app-bg pointer-events-none fixed inset-0 z-0 overflow-hidden',
                variant === 'machines' && 'weavly-app-bg-machines',
                className
            )}
            aria-hidden="true"
        >
            <div className={cn(
                'absolute inset-0',
                isAuth ? 'bg-[var(--color-app-bg)]/35' : 'bg-[var(--color-app-bg)]/10'
            )} />

            {!isAuth && (
                <>
                    <div className={cn(isQuiet ? 'absolute inset-x-0 -top-40 transform-gpu blur-xl sm:-top-80' : 'animate-blob-drift-1 absolute inset-x-0 -top-40 transform-gpu blur-xl will-change-transform sm:-top-80')}>
                        <div
                            className={cn('relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#f97316] to-[#c2410c] sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]', blobOpacity)}
                            style={{ clipPath: blobPolygon }}
                        />
                    </div>

                    <div
                        className={cn(isQuiet ? 'absolute inset-x-0 top-[24%] transform-gpu blur-xl' : 'animate-blob-drift-2 absolute inset-x-0 top-[24%] transform-gpu blur-xl will-change-transform')}
                        style={{ animationDelay: '-5s' }}
                    >
                        <div
                            className={cn('relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 -rotate-[20deg] bg-gradient-to-tl from-[#f97316] to-[#c2410c] sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]', blobOpacity)}
                            style={{ clipPath: blobPolygon }}
                        />
                    </div>

                    <div
                        className={cn(isQuiet ? 'absolute inset-x-0 top-[52%] transform-gpu blur-xl' : 'animate-blob-drift-3 absolute inset-x-0 top-[52%] transform-gpu blur-xl will-change-transform')}
                        style={{ animationDelay: '-11s' }}
                    >
                        <div
                            className={cn('relative left-[calc(50%-15rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[15deg] bg-gradient-to-tr from-[#c2410c] to-[#f97316] sm:left-[calc(50%-25rem)] sm:w-[72.1875rem]', blobOpacity)}
                            style={{ clipPath: blobPolygon }}
                        />
                    </div>

                    <div
                        className={cn(isQuiet ? 'absolute inset-x-0 top-[78%] transform-gpu blur-xl' : 'animate-blob-drift-4 absolute inset-x-0 top-[78%] transform-gpu blur-xl will-change-transform')}
                        style={{ animationDelay: '-17s' }}
                    >
                        <div
                            className={cn('relative left-[calc(50%+15rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[45deg] bg-gradient-to-tr from-[#f97316] to-[#ea580c] sm:left-[calc(50%+25rem)] sm:w-[72.1875rem]', blobOpacity)}
                            style={{ clipPath: blobPolygon }}
                        />
                    </div>

                    {variant === 'billing' && (
                        <div
                            className="absolute inset-0 opacity-70 dark:opacity-20"
                            style={{
                                backgroundImage: 'linear-gradient(to right, rgba(169, 71, 19, 0.065) 1px, transparent 1px), linear-gradient(to bottom, rgba(169, 71, 19, 0.065) 1px, transparent 1px)',
                                backgroundSize: '36px 36px',
                            }}
                        />
                    )}
                </>
            )}
        </div>
    )
}
