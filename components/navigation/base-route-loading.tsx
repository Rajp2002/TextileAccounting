import { RouteMilestones } from '@/components/performance/route-milestones'

export function BaseRouteLoading({
    route,
    title,
    children,
}: {
    route: string
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="w-full space-y-6 pt-2 pb-8" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
            <RouteMilestones route={route} shellVisible primaryUsable={false} />
            <div className="space-y-2 border-b border-hairline/80 pb-5">
                <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
                <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-surface-soft" />
            </div>
            {children}
        </div>
    )
}
