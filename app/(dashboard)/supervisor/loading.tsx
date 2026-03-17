export default function SupervisorLoading() {
    return (
        <div className="w-full space-y-4 pt-2 pb-8 animate-pulse max-w-5xl mx-auto">
            {/* Page Header Skeleton */}
            <div className="space-y-2">
                <div className="h-7 w-1/3 max-w-[220px] bg-gray-200 rounded-md"></div>
                <div className="h-4 w-1/4 max-w-[180px] bg-gray-100 rounded-md"></div>
            </div>

            {/* Card Skeleton */}
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <div className="h-5 w-1/4 bg-gray-200 rounded-md"></div>
                    <div className="h-8 w-[130px] bg-gray-100 rounded-md"></div>
                </div>

                {/* Shift Toggle Skeleton */}
                <div className="flex rounded-xl bg-gray-100 p-1 w-full">
                    <div className="flex-1 py-2.5 rounded-lg bg-white shadow-sm"></div>
                    <div className="flex-1 py-2.5 rounded-lg"></div>
                </div>
            </div>

            {/* Content Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <div className="h-5 w-24 bg-gray-200 rounded-md"></div>
                                <div className="h-3 w-16 bg-gray-100 rounded-md"></div>
                            </div>
                            <div className="h-6 w-16 bg-gray-100 rounded"></div>
                        </div>
                        <div className="space-y-1">
                            <div className="h-3 w-12 bg-gray-100 rounded-md"></div>
                            <div className="h-4 w-20 bg-gray-100 rounded-md"></div>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <div className="h-12 w-16 bg-gray-100 rounded-md"></div>
                            <div className="h-12 flex-1 bg-gray-100 rounded-md"></div>
                            <div className="h-12 w-16 bg-gray-100 rounded-md"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
