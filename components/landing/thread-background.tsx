'use client'

const warpThreads = [
    { x: 72, opacity: 0.2 },
    { x: 206, opacity: 0.13 },
    { x: 358, opacity: 0.18 },
    { x: 552, opacity: 0.12 },
    { x: 746, opacity: 0.16 },
    { x: 946, opacity: 0.12 },
    { x: 1128, opacity: 0.18 },
    { x: 1324, opacity: 0.13 },
]

const threadPaths = [
    {
        id: 'upper-sewing-thread',
        d: 'M -160 86 C 56 132, 178 68, 276 138 C 382 214, 238 282, 178 192 C 116 100, 286 54, 430 128 C 598 214, 826 154, 1040 92 C 1198 46, 1326 96, 1604 74',
        baseWidth: 1.65,
        highlightWidth: 2.45,
        delay: '0s',
        duration: '16s',
    },
    {
        id: 'lower-sewing-thread',
        d: 'M -150 812 C 92 716, 274 754, 374 850 C 474 944, 314 990, 266 884 C 218 778, 408 748, 576 840 C 760 940, 932 856, 1098 784 C 1258 714, 1396 790, 1610 706',
        baseWidth: 1.35,
        highlightWidth: 2.1,
        delay: '-7s',
        duration: '19s',
    },
    {
        id: 'right-edge-loop-thread',
        d: 'M 1518 -60 C 1308 74, 1262 224, 1398 320 C 1532 414, 1636 256, 1510 186 C 1368 108, 1194 306, 1290 486 C 1386 668, 1572 612, 1608 832',
        baseWidth: 1.25,
        highlightWidth: 1.95,
        delay: '-12s',
        duration: '21s',
    },
]

export default function LandingThreadBackground() {
    return (
        <div
            className="fixed inset-0 hidden overflow-hidden opacity-80 [contain:paint] [mask-image:linear-gradient(90deg,transparent_0%,white_8%,white_92%,transparent_100%)] md:block"
            aria-hidden="true"
        >
            <svg
                className="h-screen w-screen"
                viewBox="0 0 1440 960"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="thread-base-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#92400e" stopOpacity="0" />
                        <stop offset="18%" stopColor="#92400e" stopOpacity="0.28" />
                        <stop offset="48%" stopColor="#f97316" stopOpacity="0.42" />
                        <stop offset="76%" stopColor="#475569" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#92400e" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="thread-highlight-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#fed7aa" stopOpacity="0" />
                        <stop offset="36%" stopColor="#f59e0b" stopOpacity="0.24" />
                        <stop offset="50%" stopColor="#ea580c" stopOpacity="0.8" />
                        <stop offset="66%" stopColor="#f59e0b" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="#fed7aa" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="thread-warp-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
                        <stop offset="28%" stopColor="#92400e" stopOpacity="0.2" />
                        <stop offset="58%" stopColor="#64748b" stopOpacity="0.13" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                    </linearGradient>
                    <mask id="thread-reading-mask">
                        <rect x="-40" y="-40" width="1520" height="1040" fill="white" />
                        <rect x="168" y="148" width="1104" height="632" rx="88" fill="black" />
                    </mask>
                </defs>

                <g className="landing-thread-warp" mask="url(#thread-reading-mask)">
                    {warpThreads.map((thread) => (
                        <line
                            key={thread.x}
                            x1={thread.x}
                            x2={thread.x}
                            y1="-40"
                            y2="1000"
                            stroke="url(#thread-warp-gradient)"
                            strokeWidth="1"
                            opacity={thread.opacity}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </g>

                <g className="landing-thread-field" mask="url(#thread-reading-mask)">
                    {threadPaths.map((thread) => (
                        <g key={thread.id}>
                            <path
                                d={thread.d}
                                className="landing-thread-base"
                                fill="none"
                                stroke="url(#thread-base-gradient)"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={thread.baseWidth}
                                vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d={thread.d}
                                className="landing-thread-highlight"
                                style={{
                                    animationDelay: thread.delay,
                                    animationDuration: thread.duration,
                                }}
                                fill="none"
                                stroke="url(#thread-highlight-gradient)"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={thread.highlightWidth}
                                vectorEffect="non-scaling-stroke"
                            />
                        </g>
                    ))}
                </g>

                <g className="landing-thread-needle" mask="url(#thread-reading-mask)">
                    <ellipse cx="386" cy="281" rx="4" ry="2.2" fill="#ea580c" opacity="0.2" />
                    <ellipse cx="948" cy="432" rx="4.5" ry="2.4" fill="#f59e0b" opacity="0.18" />
                    <ellipse cx="344" cy="690" rx="4" ry="2.2" fill="#ea580c" opacity="0.18" />
                    <ellipse cx="906" cy="770" rx="4.5" ry="2.4" fill="#f59e0b" opacity="0.16" />
                </g>
            </svg>
        </div>
    )
}
