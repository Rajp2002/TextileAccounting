import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export function BaseWorkspaceLoading({
    route,
    title,
    summaryCards = 3,
}: {
    route: string
    title: string
    summaryCards?: number
}) {
    return (
        <BaseRouteLoading route={route} title={title}>
            <div className="space-y-4" aria-hidden="true">
                {summaryCards > 0 && <div className={`grid gap-3 ${summaryCards === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
                    {Array.from({ length: summaryCards }, (_, index) => (
                        <div key={index} className="h-24 ui-skeleton rounded-xl border border-hairline bg-surface" />
                    ))}
                </div>}
                <div className="h-11 ui-skeleton rounded-xl border border-hairline bg-surface" />
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="h-72 ui-skeleton rounded-xl border border-hairline bg-surface" />
                    <div className="h-72 ui-skeleton rounded-xl border border-hairline bg-surface" />
                </div>
            </div>
        </BaseRouteLoading>
    )
}
