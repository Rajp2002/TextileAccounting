import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/quotes" title="Saved Costings">
            <div className="space-y-4">
                <div className="h-16 animate-pulse rounded-xl border border-hairline bg-surface" />
                <div className="h-96 animate-pulse rounded-xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
