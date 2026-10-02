import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/settings" title="Settings">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                    <div className="h-56 ui-skeleton rounded-xl border border-hairline bg-surface" />
                    <div className="h-44 ui-skeleton rounded-xl border border-hairline bg-surface" />
                </div>
                <div className="h-72 ui-skeleton rounded-xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
