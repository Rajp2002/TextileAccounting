import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/settings" title="Settings">
            <div className="grid gap-6 xl:grid-cols-2">
                <div className="h-56 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                <div className="h-44 ui-skeleton rounded-2xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
