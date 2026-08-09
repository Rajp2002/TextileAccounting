import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/rates" title="Yarn Rate Book">
            <div className="space-y-4">
                <div className="h-24 animate-pulse rounded-xl border border-hairline bg-surface" />
                <div className="h-96 animate-pulse rounded-xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
