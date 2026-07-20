export default function LandingBackground() {
    // The exact polygon shape used in the hero component
    const blobPolygon = 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)';

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white dark:bg-zinc-950">
            {/* The same grid from the hero, but spanning the entire absolute container height. 
                Using a mask that fades at the very bottom of the page, not halfway. */}
            <svg
                className="absolute inset-0 h-full w-full stroke-gray-200/50 [mask-image:linear-gradient(to_bottom,white_0%,white_90%,transparent_100%)] dark:stroke-zinc-800/50"
                aria-hidden="true"
            >
                <defs>
                    <pattern id="grid-pattern-global" width={40} height={40} x="50%" y={-1} patternUnits="userSpaceOnUse">
                        <path d="M40 40V.5M.5 .5H40" fill="none" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-global)" />
            </svg>

            {/* Blob 1: Top (Original Hero Blob) */}
            <div className="absolute inset-x-0 -top-40 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
                <div
                    className="animate-blob-drift-1 relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#f59e0b] to-[#c2410c] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem] will-change-transform dark:opacity-40"
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            {/* Blob 2: Features Section (around 25% down) */}
            <div className="absolute inset-x-0 top-[25%] transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
                <div
                    className="animate-blob-drift-2 relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tl from-[#f59e0b] to-[#c2410c] opacity-30 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem] will-change-transform dark:opacity-40"
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            {/* Blob 3: Pricing Section (around 55% down) */}
            <div className="absolute inset-x-0 top-[55%] transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
                <div
                    className="animate-blob-drift-3 relative left-[calc(50%-15rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#c2410c] to-[#f59e0b] opacity-30 sm:left-[calc(50%-25rem)] sm:w-[72.1875rem] will-change-transform dark:opacity-40"
                    style={{ clipPath: blobPolygon }}
                />
            </div>

            {/* Blob 4: FAQ / Pre-footer Section (Bottom) */}
            <div className="absolute inset-x-0 bottom-[5%] transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
                <div
                    className="animate-blob-drift-4 relative left-[calc(50%+5rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#f59e0b] to-[#ea580c] opacity-30 sm:left-[calc(50%+30rem)] sm:w-[72.1875rem] will-change-transform dark:opacity-40"
                    style={{ clipPath: blobPolygon }}
                />
            </div>
        </div>
    )
}
