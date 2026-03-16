export default function OwnerLoading() {
    return (
        <div className="w-full space-y-6 pt-2 pb-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="space-y-2">
                <div className="h-8 w-1/4 max-w-[200px] bg-gray-200 rounded-md"></div>
                <div className="h-4 w-1/3 max-w-[300px] bg-gray-100 rounded-md"></div>
            </div>

            {/* Top Cards Skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between h-[120px]">
                        <div className="h-4 w-1/2 bg-gray-100 rounded-md"></div>
                        <div className="h-8 w-1/3 bg-gray-200 rounded-md mt-4"></div>
                    </div>
                ))}
            </div>

            {/* Main Content Area Skeleton */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <div className="h-6 w-1/4 max-w-[150px] bg-gray-200 rounded-md"></div>
                </div>
                <div className="p-6 space-y-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="h-4 w-1/3 bg-gray-100 rounded-md"></div>
                            <div className="h-4 w-1/4 bg-gray-100 rounded-md"></div>
                            <div className="h-4 w-1/6 bg-gray-200 rounded-md hidden md:block"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
