export default function SupervisorLoading() {
    return (
        <div className="w-full space-y-4 pt-2 pb-8 animate-pulse max-w-5xl mx-auto">
            {/* Page Header Skeleton */}
            <div className="space-y-2">
                <div className="h-7 w-1/3 max-w-[220px] rounded-md bg-surface-muted"></div>
                <div className="h-4 w-1/4 max-w-[180px] rounded-md bg-surface-soft"></div>
            </div>

            {/* Card Skeleton */}
            <div className="space-y-4 rounded-xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="flex justify-between items-center">
                    <div className="h-5 w-1/4 rounded-md bg-surface-muted"></div>
                    <div className="h-8 w-[130px] rounded-md bg-surface-soft"></div>
                </div>

                {/* Shift Toggle Skeleton */}
                <div className="flex w-full rounded-xl bg-surface-soft p-1">
                    <div className="flex-1 rounded-lg bg-surface py-2.5 shadow-sm"></div>
                    <div className="flex-1 py-2.5 rounded-lg"></div>
                </div>
            </div>

            {/* Content Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-3 rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <div className="h-5 w-24 rounded-md bg-surface-muted"></div>
                                <div className="h-3 w-16 rounded-md bg-surface-soft"></div>
                            </div>
                            <div className="h-6 w-16 rounded bg-surface-soft"></div>
                        </div>
                        <div className="space-y-1">
                            <div className="h-3 w-12 rounded-md bg-surface-soft"></div>
                            <div className="h-4 w-20 rounded-md bg-surface-soft"></div>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <div className="h-12 w-16 rounded-md bg-surface-soft"></div>
                            <div className="h-12 flex-1 rounded-md bg-surface-soft"></div>
                            <div className="h-12 w-16 rounded-md bg-surface-soft"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
