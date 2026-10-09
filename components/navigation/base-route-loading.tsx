import { RouteMilestones } from '@/components/performance/route-milestones'
import { PageHeader } from '@/components/ui/page-header'
import { pageTitleLayoutClass } from '@/components/navigation/page-title-layout'
import { cn } from '@/lib/utils'

export function BaseRouteLoading({
    route,
    title,
    centeredTitle = false,
    headerClassName,
    children,
}: {
    route: string
    title: string
    centeredTitle?: boolean
    /** The page's own phone header class, so the title does not jump when the page arrives. */
    headerClassName?: string
    children: React.ReactNode
}) {
    return (
        <div className="w-full space-y-6 pt-2 pb-8" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
            <RouteMilestones route={route} shellVisible primaryUsable={false} />
            <PageHeader
                title={title}
                centered={centeredTitle}
                className={cn(pageTitleLayoutClass(route), headerClassName)}
            />
            {children}
        </div>
    )
}
