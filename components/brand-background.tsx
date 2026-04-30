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
                isAuth ? 'opacity-100' : 'opacity-80'
            )}>
                <div
                    className={cn(
                        'relative left-[calc(50%-12rem)] aspect-[1155/678] w-[34rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#f59e0b] to-[#c2410c] sm:left-[calc(50%-28rem)] sm:w-[68rem]',
                        isAuth ? 'opacity-20 dark:opacity-[0.24]' : 'opacity-[0.12] dark:opacity-[0.16]'
                    )}
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            <div className={cn(
                'absolute inset-x-0 top-[18%] transform-gpu overflow-hidden blur-3xl',
                isAuth ? 'opacity-90' : 'opacity-70'
            )}>
                <div
                    className={cn(
                        'relative left-[calc(50%+10rem)] aspect-[1155/678] w-[32rem] -translate-x-1/2 -rotate-[18deg] bg-gradient-to-tl from-[#f59e0b] to-[#ea580c] sm:left-[calc(50%+26rem)] sm:w-[58rem]',
                        isAuth ? 'opacity-[0.16] dark:opacity-[0.22]' : 'opacity-[0.08] dark:opacity-[0.12]'
                    )}
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            <div className="absolute inset-0 bg-background/70 dark:bg-background/80" />
        </div>
    )
}
