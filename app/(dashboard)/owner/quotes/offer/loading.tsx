import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/quotes" title="Check an offer">
            <div className="space-y-4">
                <div className="h-96 ui-skeleton rounded-2xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
