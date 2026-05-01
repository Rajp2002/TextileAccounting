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
        id: 'hero-loop-thread',
        d: 'M -120 210 C 120 120, 312 172, 392 282 C 468 388, 324 444, 286 346 C 246 244, 418 216, 542 286 C 692 370, 790 486, 948 432 C 1118 374, 1072 210, 930 252 C 806 290, 890 420, 1038 482 C 1194 548, 1344 474, 1588 356',
        baseWidth: 1.65,
        highlightWidth: 2.45,
        delay: '0s',
        duration: '16s',
    },
    {
        id: 'sewing-pass-thread',
        d: 'M -100 650 C 84 544, 248 578, 344 690 C 438 800, 286 850, 246 742 C 208 638, 380 606, 522 704 C 652 794, 768 856, 906 770 C 1038 688, 984 544, 862 590 C 750 632, 836 756, 1012 826 C 1186 896, 1362 818, 1568 680',
        baseWidth: 1.35,
        highlightWidth: 2.1,
        delay: '-7s',
        duration: '19s',
    },
]

export default function LandingThreadBackground() {
    return (
        <div
            className="fixed inset-0 hidden overflow-hidden opacity-95 [contain:paint] [mask-image:linear-gradient(90deg,transparent_0%,white_10%,white_90%,transparent_100%)] md:block"
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
                </defs>

                <g className="landing-thread-warp">
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

                <g className="landing-thread-field">
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

                <g className="landing-thread-needle">
                    <ellipse cx="386" cy="281" rx="4" ry="2.2" fill="#ea580c" opacity="0.2" />
                    <ellipse cx="948" cy="432" rx="4.5" ry="2.4" fill="#f59e0b" opacity="0.18" />
                    <ellipse cx="344" cy="690" rx="4" ry="2.2" fill="#ea580c" opacity="0.18" />
                    <ellipse cx="906" cy="770" rx="4.5" ry="2.4" fill="#f59e0b" opacity="0.16" />
                </g>
            </svg>
        </div>
    )
}
