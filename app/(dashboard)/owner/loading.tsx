export default function OwnerLoading() {
    return (
        <div className="w-full space-y-6 pt-2 pb-8" role="status" aria-busy="true" aria-label="Loading">
            {/* Header Skeleton */}
            <div className="space-y-2">
                <div className="ui-skeleton h-8 w-1/4 max-w-[200px] rounded-md bg-surface-muted"></div>
                <div className="ui-skeleton h-4 w-1/3 max-w-[300px] rounded-md bg-surface-soft"></div>
            </div>

            {/* Top Cards Skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="ui-skeleton flex h-[120px] flex-col justify-between rounded-xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
                        <div className="h-4 w-1/2 rounded-md bg-surface-soft"></div>
                        <div className="mt-4 h-8 w-1/3 rounded-md bg-surface-muted"></div>
                    </div>
                ))}
            </div>

            {/* Main Content Area Skeleton */}
            <div className="ui-skeleton rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
                <div className="border-b border-hairline p-6">
                    <div className="h-6 w-1/4 max-w-[150px] rounded-md bg-surface-muted"></div>
                </div>
                <div className="p-6 space-y-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="h-4 w-1/3 rounded-md bg-surface-soft"></div>
                            <div className="h-4 w-1/4 rounded-md bg-surface-soft"></div>
                            <div className="hidden h-4 w-1/6 rounded-md bg-surface-muted md:block"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
