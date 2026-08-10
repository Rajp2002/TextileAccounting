export function FactoryTodayLoading() {
    return (
        <div
            className="min-w-0 space-y-4 pb-8"
            role="status"
            aria-busy="true"
            aria-label="Loading Factory Today"
        >
            <span className="sr-only">Loading your factory today…</span>

            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-saffron/10" />
                    <div className="h-6 w-32 rounded-md bg-surface-soft" />
                </div>
                <div className="h-12 w-20 rounded-xl bg-surface-soft" />
            </div>

            <div className="h-14 rounded-xl border border-risk/15 bg-risk-soft/70" />

            <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="h-20 rounded-xl border border-hairline bg-surface" />
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="h-44 rounded-2xl border border-hairline bg-surface" />
                ))}
            </div>
        </div>
    )
}
