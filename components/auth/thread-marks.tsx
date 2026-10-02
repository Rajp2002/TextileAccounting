import { useId } from 'react'
import { cn } from '@/lib/utils'
import {
    clothRows,
    LOOM_FELL,
    LOOM_HALO,
    LOOM_PASS,
    LOOM_PICKS,
    LOOM_REED_Y,
    LOOM_ROW,
    LOOM_VIEWBOX,
    LOOM_WARP_WIDTH,
    LOOM_WARPS,
    LOOM_WEFT_START,
    LOOM_WEFT_WIDTH,
    pickPath,
    warpsOver,
    type LoomPick,
    type LoomRow,
} from './loom-geometry'

/*
 * Brand marks for the moments an account crosses the sign-in boundary. Both
 * are pure SVG animated by the `wv-loom-*` / `wv-spool-*` rules in
 * app/globals.css, so they cost no JavaScript per frame and keep running while
 * the browser loads the next document. Under reduced motion they hold still.
 */

/** React ids contain characters that are awkward inside url(#…). */
function useSvgId() {
    return useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

const PASS_DASH = `${LOOM_PASS} ${LOOM_PASS + 2}`

function Pick({ row, passClassName }: { row: LoomRow | LoomPick; passClassName?: string }) {
    const d = pickPath(row)
    const half = LOOM_ROW / 2
    const dash = passClassName ? PASS_DASH : undefined
    return (
        <g>
            <path d={d} className={cn('wv-loom-gap', passClassName)} strokeWidth={LOOM_WEFT_WIDTH + 2 * LOOM_HALO} strokeDasharray={dash} strokeLinecap="round" />
            <path d={d} className={cn('wv-loom-weft', passClassName)} strokeWidth={LOOM_WEFT_WIDTH} strokeDasharray={dash} strokeLinecap="round" />
            {warpsOver(row.parity).map((x) => {
                const float = `M${x} ${row.y - half}V${row.y + half}`
                return (
                    <g key={x}>
                        <path d={float} className="wv-loom-gap" strokeWidth={LOOM_WARP_WIDTH + 2 * LOOM_HALO} />
                        <path d={float} className="wv-loom-warp" strokeWidth={LOOM_WARP_WIDTH} />
                    </g>
                )
            })}
        </g>
    )
}

/** Saffron weft woven through indigo warp: signing in and creating an account. */
export function LoomMark({ className }: { className?: string }) {
    const id = useSvgId()
    const size = LOOM_VIEWBOX
    return (
        <svg viewBox={`0 0 ${size} ${size}`} className={cn('wv-loom', className)} fill="none" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.26" stopColor="#fff" />
                    <stop offset="0.74" stopColor="#fff" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={size} height={size}>
                    <rect width={size} height={size} fill={`url(#${id}-fade)`} />
                </mask>
            </defs>
            <g mask={`url(#${id}-mask)`}>
                {LOOM_WARPS.map((x) => (
                    <path key={x} d={`M${x} 0V${size}`} className="wv-loom-warp" strokeWidth={LOOM_WARP_WIDTH} />
                ))}
                <g className="wv-loom-cloth">
                    {clothRows().map((row) => <Pick key={row.y} row={row} />)}
                    {LOOM_PICKS.map((pick) => (
                        <Pick key={pick.direction} row={pick} passClassName={`wv-loom-pass-${pick.direction}`} />
                    ))}
                </g>
                <path d={`M10 ${LOOM_REED_Y}H${size - 10}`} className="wv-loom-reed" strokeWidth={2} strokeLinecap="round" />
                <rect
                    x={LOOM_WEFT_START - 7}
                    y={LOOM_FELL - 3.25}
                    width={14}
                    height={6.5}
                    rx={3.25}
                    className="wv-loom-shuttle"
                    strokeWidth={1.5}
                />
            </g>
        </svg>
    )
}

const SPOOL_WRAPS = Array.from({ length: 17 }, (_, index) => 14 + index * 4)

/** The logo's spool winding its thread back in: signing out. */
export function SpoolMark({ className }: { className?: string }) {
    const id = useSvgId()
    const thread = 'M56 49C66 49 69 37 80 37S96 45 106 41'
    return (
        <svg viewBox="0 0 96 96" className={cn('wv-spool', className)} fill="none" aria-hidden="true" focusable="false">
            <defs>
                <clipPath id={`${id}-barrel`}>
                    <path d="M31 24V71A13 3.6 0 0 0 57 71V24Z" />
                </clipPath>
                <linearGradient id={`${id}-shade`} x1="31" y1="0" x2="57" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" style={{ stopColor: 'var(--wv-neel-950)', stopOpacity: 0.3 }} />
                    <stop offset="0.32" style={{ stopColor: '#fff', stopOpacity: 0.22 }} />
                    <stop offset="0.6" style={{ stopColor: '#fff', stopOpacity: 0 }} />
                    <stop offset="1" style={{ stopColor: 'var(--wv-neel-950)', stopOpacity: 0.34 }} />
                </linearGradient>
            </defs>

            {/* bottom flange */}
            <ellipse cx="44" cy="74" rx="18" ry="5.5" className="wv-spool-rim" />
            <rect x="26" y="71" width="36" height="3" className="wv-spool-rim" />
            <ellipse cx="44" cy="71" rx="18" ry="5.5" className="wv-spool-face" />

            {/* wound thread; the helical wraps travel as the spool turns */}
            <g clipPath={`url(#${id}-barrel)`}>
                <rect x="30" y="20" width="28" height="56" className="wv-spool-thread" />
                <g className="wv-spool-wraps">
                    {SPOOL_WRAPS.map((y) => (
                        <path key={y} d={`M29 ${y + 2.5}L59 ${y - 2.5}`} className="wv-spool-wrap" strokeWidth={1.25} />
                    ))}
                </g>
                <rect x="30" y="20" width="28" height="56" fill={`url(#${id}-shade)`} />
            </g>

            {/* top flange */}
            <ellipse cx="44" cy="25" rx="18" ry="5.5" className="wv-spool-rim" />
            <rect x="26" y="22" width="36" height="3" className="wv-spool-rim" />
            <ellipse cx="44" cy="22" rx="18" ry="5.5" className="wv-spool-face" />
            <ellipse cx="44" cy="22" rx="4" ry="1.4" className="wv-spool-hole" />

            {/* the free thread, reeled in from beyond the frame */}
            <g className="wv-spool-lead">
                <path d={thread} className="wv-spool-strand" strokeWidth={2.25} strokeLinecap="round" />
                <path d={thread} className="wv-spool-twist" strokeWidth={2.25} strokeDasharray="1.6 2.4" />
            </g>
        </svg>
    )
}
