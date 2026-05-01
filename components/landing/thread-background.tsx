'use client'

const warpThreads = [
    { x: 6, opacity: 0.22 },
    { x: 14, opacity: 0.14 },
    { x: 24, opacity: 0.18 },
    { x: 37, opacity: 0.12 },
    { x: 51, opacity: 0.18 },
    { x: 66, opacity: 0.13 },
    { x: 78, opacity: 0.2 },
    { x: 91, opacity: 0.12 },
]

const weftThreads = [
    {
        d: 'M -80 150 C 180 114, 280 206, 500 162 S 840 84, 1120 136 S 1470 252, 1620 182',
        className: 'animate-thread-draw-slow',
        width: 1.4,
        delay: '0s',
    },
    {
        d: 'M -120 330 C 120 288, 340 386, 560 316 S 880 212, 1130 292 S 1390 390, 1620 302',
        className: 'animate-thread-draw-medium',
        width: 1.1,
        delay: '-5s',
    },
    {
        d: 'M -90 530 C 160 600, 318 474, 540 546 S 860 690, 1080 572 S 1350 452, 1620 556',
        className: 'animate-thread-draw-slow',
        width: 1.2,
        delay: '-11s',
    },
    {
        d: 'M -80 760 C 210 700, 356 816, 610 746 S 930 612, 1184 708 S 1420 846, 1620 742',
        className: 'animate-thread-draw-medium',
        width: 0.95,
        delay: '-14s',
    },
]

export default function LandingThreadBackground() {
    return (
        <div
            className="absolute inset-0 hidden overflow-hidden opacity-80 mix-blend-multiply [mask-image:linear-gradient(90deg,transparent_0%,white_12%,white_88%,transparent_100%)] dark:mix-blend-screen md:block"
            aria-hidden="true"
        >
            <svg className="h-full w-full" viewBox="0 0 1440 960" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="thread-warm-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#475569" stopOpacity="0" />
                        <stop offset="28%" stopColor="#64748b" stopOpacity="0.24" />
                        <stop offset="52%" stopColor="#f59e0b" stopOpacity="0.5" />
                        <stop offset="78%" stopColor="#c2410c" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#475569" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="thread-warp-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                        <stop offset="16%" stopColor="#a16207" stopOpacity="0.16" />
                        <stop offset="54%" stopColor="#475569" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                    </linearGradient>
                    <filter id="thread-soften">
                        <feGaussianBlur stdDeviation="0.25" />
                    </filter>
                </defs>

                <g className="landing-thread-static">
                    {warpThreads.map((thread) => (
                        <line
                            key={thread.x}
                            x1={`${thread.x}%`}
                            x2={`${thread.x}%`}
                            y1="0"
                            y2="960"
                            stroke="url(#thread-warp-gradient)"
                            strokeWidth="1"
                            opacity={thread.opacity}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </g>

                <g filter="url(#thread-soften)">
                    {weftThreads.map((thread) => (
                        <path
                            key={thread.d}
                            d={thread.d}
                            className={`landing-thread-path ${thread.className}`}
                            style={{ animationDelay: thread.delay }}
                            fill="none"
                            stroke="url(#thread-warm-gradient)"
                            strokeLinecap="round"
                            strokeWidth={thread.width}
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </g>

                <g className="landing-thread-glints">
                    <circle cx="517" cy="163" r="2.2" fill="#f59e0b" opacity="0.22" />
                    <circle cx="772" cy="252" r="1.6" fill="#c2410c" opacity="0.18" />
                    <circle cx="1074" cy="573" r="2" fill="#f59e0b" opacity="0.2" />
                    <circle cx="1190" cy="707" r="1.7" fill="#c2410c" opacity="0.16" />
                </g>
            </svg>
        </div>
    )
}
