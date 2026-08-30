import { RouteMilestones } from '@/components/performance/route-milestones'
import { PageHeader } from '@/components/ui/page-header'

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
            <PageHeader
                title={title}
                description={<div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />}
            />
            {children}
        </div>
    )
}
