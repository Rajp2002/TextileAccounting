import { cn } from '@/lib/utils'

type BrandBackgroundProps = {
    className?: string
    variant?: 'app' | 'auth'
}

const blobPolygon = 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'

export function BrandBackground({ className, variant = 'app' }: BrandBackgroundProps) {
    const isAuth = variant === 'auth'

    return (
        <div
            className={cn(
                'pointer-events-none absolute inset-0 z-0 overflow-hidden bg-background',
                className
            )}
            aria-hidden="true"
        >
            <div className="absolute inset-0 bg-grid-pattern [mask-image:linear-gradient(to_bottom,white_0%,white_88%,transparent_100%)]" />

            <div className={cn(
                'absolute inset-x-0 -top-48 transform-gpu overflow-hidden blur-3xl sm:-top-72',
                isAuth ? 'opacity-100' : 'opacity-100'
            )}>
                <div
                    className={cn(
                        'relative aspect-[1155/678] w-[42rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#f59e0b] via-[#ea580c] to-[#c2410c] sm:w-[84rem]',
                        isAuth
                            ? 'left-[calc(50%-12rem)] opacity-20 dark:opacity-[0.24] sm:left-[calc(50%-28rem)]'
                            : 'left-[calc(50%-2rem)] opacity-[0.46] dark:opacity-[0.30] sm:left-[calc(50%-12rem)]'
                    )}
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            <div className={cn(
                'absolute inset-x-0 top-[16%] transform-gpu overflow-hidden blur-3xl',
                isAuth ? 'opacity-90' : 'opacity-100'
            )}>
                <div
                    className={cn(
                        'relative aspect-[1155/678] w-[38rem] -translate-x-1/2 -rotate-[18deg] bg-gradient-to-tl from-[#f59e0b] to-[#ea580c] sm:w-[72rem]',
                        isAuth
                            ? 'left-[calc(50%+10rem)] opacity-[0.16] dark:opacity-[0.22] sm:left-[calc(50%+26rem)]'
                            : 'left-[calc(50%+20rem)] opacity-[0.32] dark:opacity-[0.24] sm:left-[calc(50%+28rem)]'
                    )}
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            <div className={cn(
                'absolute inset-0',
                isAuth ? 'bg-background/60 dark:bg-background/72' : 'bg-background/18 dark:bg-background/55'
            )} />
        </div>
    )
}
