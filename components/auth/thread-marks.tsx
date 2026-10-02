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
import {
    barrelPath,
    SPOOL_BARREL_RX,
    SPOOL_BARREL_RY,
    SPOOL_BOTTOM_Y,
    SPOOL_CX,
    SPOOL_FLANGE_RX,
    SPOOL_FLANGE_RY,
    SPOOL_HOLE_ORBIT,
    SPOOL_HOLES,
    SPOOL_LAY_Y,
    SPOOL_RIM_DEPTH,
    SPOOL_TOP_Y,
    SPOOL_WRAP_SPACING,
    SPOOL_WRAP_WIDTH,
    woundWraps,
    wrapPath,
} from './spool-geometry'

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

const LAY_DASH = '100 101'

function Wrap({ y, className }: { y: number; className?: string }) {
    const d = wrapPath(y)
    const dash = className ? LAY_DASH : undefined
    return (
        <g>
            <path d={d} pathLength={className ? 100 : undefined} className={cn('wv-spool-band', className)} strokeWidth={SPOOL_WRAP_SPACING} strokeDasharray={dash} />
            <path d={d} pathLength={className ? 100 : undefined} className={cn('wv-spool-wrap', className)} strokeWidth={SPOOL_WRAP_WIDTH} strokeDasharray={dash} strokeLinecap="round" />
        </g>
    )
}

function Flange({ y }: { y: number }) {
    return (
        <>
            <ellipse cx={SPOOL_CX} cy={y + SPOOL_RIM_DEPTH} rx={SPOOL_FLANGE_RX} ry={SPOOL_FLANGE_RY} className="wv-spool-rim" />
            <rect x={SPOOL_CX - SPOOL_FLANGE_RX} y={y} width={SPOOL_FLANGE_RX * 2} height={SPOOL_RIM_DEPTH} className="wv-spool-rim" />
            <ellipse cx={SPOOL_CX} cy={y} rx={SPOOL_FLANGE_RX} ry={SPOOL_FLANGE_RY} className="wv-spool-face" />
        </>
    )
}

/** The logo's spool winding its thread in: logging out. */
export function SpoolMark({ className }: { className?: string }) {
    const id = useSvgId()
    const attachX = SPOOL_CX + SPOOL_BARREL_RX
    const thread = `M${attachX} ${SPOOL_LAY_Y}C${attachX + 10} ${SPOOL_LAY_Y} ${attachX + 13} ${SPOOL_LAY_Y + 12} ${attachX + 24} ${SPOOL_LAY_Y + 12}S${attachX + 40} ${SPOOL_LAY_Y + 6} ${attachX + 48} ${SPOOL_LAY_Y + 8}`
    return (
        <svg viewBox="6 8 84 84" className={cn('wv-spool', className)} fill="none" aria-hidden="true" focusable="false">
            <defs>
                <clipPath id={`${id}-barrel`}>
                    <path d={barrelPath()} />
                </clipPath>
                <linearGradient id={`${id}-shade`} x1={SPOOL_CX - SPOOL_BARREL_RX} y1="0" x2={SPOOL_CX + SPOOL_BARREL_RX} y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" style={{ stopColor: 'var(--wv-neel-950)', stopOpacity: 0.28 }} />
                    <stop offset="0.3" style={{ stopColor: '#fff', stopOpacity: 0.2 }} />
                    <stop offset="0.6" style={{ stopColor: '#fff', stopOpacity: 0 }} />
                    <stop offset="1" style={{ stopColor: 'var(--wv-neel-950)', stopOpacity: 0.32 }} />
                </linearGradient>
            </defs>

            <Flange y={SPOOL_BOTTOM_Y} />

            <g clipPath={`url(#${id}-barrel)`}>
                <rect x={SPOOL_CX - SPOOL_BARREL_RX} y={SPOOL_TOP_Y} width={SPOOL_BARREL_RX * 2} height={SPOOL_BOTTOM_Y - SPOOL_TOP_Y + SPOOL_BARREL_RY} className="wv-spool-core" />
                <g className="wv-spool-stack">
                    {woundWraps().map((y) => <Wrap key={y} y={y} />)}
                    <Wrap y={SPOOL_LAY_Y} className="wv-spool-lay" />
                </g>
                <rect x={SPOOL_CX - SPOOL_BARREL_RX} y={SPOOL_TOP_Y} width={SPOOL_BARREL_RX * 2} height={SPOOL_BOTTOM_Y - SPOOL_TOP_Y + SPOOL_BARREL_RY} fill={`url(#${id}-shade)`} />
            </g>

            <Flange y={SPOOL_TOP_Y - SPOOL_RIM_DEPTH} />
            {/* flange holes orbit as it turns; the squash puts the orbit in perspective */}
            <g transform={`translate(${SPOOL_CX} ${SPOOL_TOP_Y - SPOOL_RIM_DEPTH}) scale(1 ${SPOOL_FLANGE_RY / SPOOL_FLANGE_RX})`}>
                <g className="wv-spool-spin">
                    <circle r={SPOOL_HOLE_ORBIT} fill="none" />
                    {SPOOL_HOLES.map((angle) => (
                        <circle
                            key={angle}
                            cx={SPOOL_HOLE_ORBIT * Math.sin((angle * Math.PI) / 180)}
                            cy={SPOOL_HOLE_ORBIT * Math.cos((angle * Math.PI) / 180)}
                            r={2.6}
                            className="wv-spool-hole"
                        />
                    ))}
                </g>
                <circle r={4} className="wv-spool-hole" />
            </g>

            {/* the incoming thread, flowing in from beyond the frame */}
            <g className="wv-spool-lead">
                <path d={thread} className="wv-spool-strand" strokeWidth={2.5} strokeLinecap="round" />
                <path d={thread} className="wv-spool-twist" strokeWidth={2.5} strokeDasharray="1.5 1.5" />
            </g>
        </svg>
    )
}
