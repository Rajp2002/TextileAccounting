import { useId, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_TRANSITION_ROUND_MS } from './auth-transition-timing'
import {
    clothRows,
    LOOM_FELL,
    LOOM_HALO,
    LOOM_PASS,
    LOOM_PICKS,
    LOOM_REED_Y,
    LOOM_ROW,
    LOOM_SHUTTLE_HEIGHT,
    LOOM_SHUTTLE_WIDTH,
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
    SPOOL_BARREL_RX,
    SPOOL_BARREL_RY,
    SPOOL_BOTTOM_Y,
    SPOOL_CX,
    SPOOL_FLANGE_RX,
    SPOOL_FLANGE_RY,
    SPOOL_HOLE_ORBIT,
    SPOOL_HOLE_R,
    SPOOL_HOLES,
    SPOOL_LAY_CUT_REACH,
    SPOOL_LAY_Y,
    SPOOL_RIM_DEPTH,
    SPOOL_SPIN_DROP,
    SPOOL_TOP_Y,
    SPOOL_VIEW_SIZE,
    SPOOL_VIEW_X,
    SPOOL_VIEW_Y,
    SPOOL_WRAP_SPACING,
    SPOOL_WRAP_WIDTH,
    woundWraps,
    wrapPath,
} from './spool-geometry'

/*
 * Brand marks for the moments an account crosses the sign-in boundary, animated
 * by the `wv-loom-*` / `wv-spool-*` rules in app/globals.css with no JavaScript
 * per frame. The drawing is SVG, but every part that moves is an HTML layer
 * animated only by transform or opacity, which browsers run off the main
 * thread: the marks keep moving while the next page loads and hydrates behind
 * them (dash or SVG-part animations freeze then, in Safari entirely). Under
 * reduced motion they hold still.
 */

/** React ids contain characters that are awkward inside url(#…). */
function useSvgId() {
    return useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

const percent = (value: number, of: number) => `${+((value / of) * 100).toFixed(4)}%`

type Box = { x: number; y: number; width: number; height: number }

/** Places a box drawn in `frame`'s units inside an element covering `frame`. */
function place(box: Box, frame: Box): CSSProperties {
    return {
        left: percent(box.x - frame.x, frame.width),
        top: percent(box.y - frame.y, frame.height),
        width: percent(box.width, frame.width),
        height: percent(box.height, frame.height),
    }
}

/** A still part of the drawing, covering the whole mark. */
function Layer({ viewBox, className, children }: { viewBox: string; className?: string; children: ReactNode }) {
    return (
        <div className={cn('wv-mark-layer', className)}>
            <svg viewBox={viewBox} fill="none" focusable="false">{children}</svg>
        </div>
    )
}

const LOOM_FRAME: Box = { x: 0, y: 0, width: LOOM_VIEWBOX, height: LOOM_VIEWBOX }
const LOOM_VIEW = `0 0 ${LOOM_VIEWBOX} ${LOOM_VIEWBOX}`

function Weft({ row }: { row: LoomRow | LoomPick }) {
    const d = pickPath(row)
    return (
        <>
            <path d={d} className="wv-loom-gap" strokeWidth={LOOM_WEFT_WIDTH + 2 * LOOM_HALO} strokeLinecap="round" />
            <path d={d} className="wv-loom-weft" strokeWidth={LOOM_WEFT_WIDTH} strokeLinecap="round" />
        </>
    )
}

/** The warp ends that float over a row, each with a gap where it crosses the weft. */
function Floats({ row }: { row: LoomRow | LoomPick }) {
    const half = LOOM_ROW / 2
    return warpsOver(row.parity).map((x) => {
        const float = `M${x} ${row.y - half}V${row.y + half}`
        return (
            <g key={x}>
                <path d={float} className="wv-loom-gap" strokeWidth={LOOM_WARP_WIDTH + 2 * LOOM_HALO} />
                <path d={float} className="wv-loom-warp" strokeWidth={LOOM_WARP_WIDTH} />
            </g>
        )
    })
}

/**
 * A pick being laid: a bar slides its own width into a clip shaped like the
 * finished pick (round ends included), so what shows is exactly the pick laid
 * so far. Its moving end always stays under the shuttle.
 */
function PassBand({ pick, thickness, tone }: { pick: LoomPick; thickness: number; tone: 'gap' | 'weft' }) {
    const box = { x: LOOM_WEFT_START - thickness / 2, y: pick.y - thickness / 2, width: LOOM_PASS + thickness, height: thickness }
    return (
        <div className="wv-loom-pass" style={place(box, LOOM_FRAME)}>
            <div className={`wv-loom-pass-bar wv-loom-pass-${tone} wv-loom-pass-${pick.direction}`} />
        </div>
    )
}

/** Saffron weft woven through indigo warp: signing in and creating an account. */
export function LoomMark({ className }: { className?: string }) {
    const size = LOOM_VIEWBOX
    return (
        <div className={cn('wv-loom', className)} aria-hidden="true">
            <div className="wv-loom-stage">
                <Layer viewBox={LOOM_VIEW}>
                    {LOOM_WARPS.map((x) => (
                        <path key={x} d={`M${x} 0V${size}`} className="wv-loom-warp" strokeWidth={LOOM_WARP_WIDTH} />
                    ))}
                </Layer>
                <div className="wv-mark-layer wv-loom-cloth">
                    <Layer viewBox={LOOM_VIEW}>
                        {clothRows().map((row) => (
                            <g key={row.y}>
                                <Weft row={row} />
                                <Floats row={row} />
                            </g>
                        ))}
                    </Layer>
                    {LOOM_PICKS.map((pick) => (
                        <div key={pick.direction} className="wv-mark-layer">
                            <PassBand pick={pick} thickness={LOOM_WEFT_WIDTH + 2 * LOOM_HALO} tone="gap" />
                            <PassBand pick={pick} thickness={LOOM_WEFT_WIDTH} tone="weft" />
                            <Layer viewBox={LOOM_VIEW}><Floats row={pick} /></Layer>
                        </div>
                    ))}
                </div>
                <Layer viewBox={LOOM_VIEW} className="wv-loom-beat">
                    <path d={`M10 ${LOOM_REED_Y}H${size - 10}`} className="wv-loom-reed" strokeWidth={2} strokeLinecap="round" />
                </Layer>
                <Layer viewBox={LOOM_VIEW} className="wv-loom-run">
                    <rect
                        x={LOOM_WEFT_START - LOOM_SHUTTLE_WIDTH / 2}
                        y={LOOM_FELL - LOOM_SHUTTLE_HEIGHT / 2}
                        width={LOOM_SHUTTLE_WIDTH}
                        height={LOOM_SHUTTLE_HEIGHT}
                        rx={LOOM_SHUTTLE_HEIGHT / 2}
                        className="wv-loom-shuttle"
                        strokeWidth={1.5}
                    />
                </Layer>
            </div>
        </div>
    )
}

const SPOOL_FRAME: Box = { x: SPOOL_VIEW_X, y: SPOOL_VIEW_Y, width: SPOOL_VIEW_SIZE, height: SPOOL_VIEW_SIZE }
const SPOOL_VIEW = `${SPOOL_VIEW_X} ${SPOOL_VIEW_Y} ${SPOOL_VIEW_SIZE} ${SPOOL_VIEW_SIZE}`
const BARREL: Box = {
    x: SPOOL_CX - SPOOL_BARREL_RX,
    y: SPOOL_TOP_Y,
    width: SPOOL_BARREL_RX * 2,
    height: SPOOL_BOTTOM_Y - SPOOL_TOP_Y + SPOOL_BARREL_RY,
}
/** The half-plane that uncovers the newest wrap; its edge starts through the wrap's centre. */
const LAY_CUT: Box = {
    x: SPOOL_CX - SPOOL_LAY_CUT_REACH,
    y: SPOOL_LAY_Y - SPOOL_LAY_CUT_REACH,
    width: SPOOL_LAY_CUT_REACH * 2,
    height: SPOOL_LAY_CUT_REACH,
}
const LAY_END: Box = {
    x: SPOOL_CX + SPOOL_BARREL_RX - SPOOL_WRAP_WIDTH / 2,
    y: SPOOL_LAY_Y - SPOOL_WRAP_WIDTH / 2,
    width: SPOOL_WRAP_WIDTH,
    height: SPOOL_WRAP_WIDTH,
}
const HOLES_REACH = 16
const HOLES: Box = {
    x: SPOOL_CX - HOLES_REACH,
    y: SPOOL_TOP_Y - SPOOL_RIM_DEPTH - HOLES_REACH,
    width: HOLES_REACH * 2,
    height: HOLES_REACH * 2,
}
/** The twist steps along the thread in this many phases per dash period. */
const TWIST_PHASES = 8
const TWIST_DASH = 1.5
const TWIST_CYCLE_MS = AUTH_TRANSITION_ROUND_MS / 8

function Wrap({ y, cap = 'round' }: { y: number; cap?: 'round' | 'butt' }) {
    const d = wrapPath(y)
    return (
        <g>
            <path d={d} className="wv-spool-band" strokeWidth={SPOOL_WRAP_SPACING} />
            <path d={d} className="wv-spool-wrap" strokeWidth={SPOOL_WRAP_WIDTH} strokeLinecap={cap} />
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
        <div className={cn('wv-spool', className)} aria-hidden="true">
            <Layer viewBox={SPOOL_VIEW}><Flange y={SPOOL_BOTTOM_Y} /></Layer>

            {/* The barrel: straight sides and a front arc where it meets the bottom flange. */}
            <div
                className="wv-spool-barrel"
                style={{
                    ...place(BARREL, SPOOL_FRAME),
                    borderRadius: `0 0 50% 50% / 0 0 ${percent(SPOOL_BARREL_RY, BARREL.height)} ${percent(SPOOL_BARREL_RY, BARREL.height)}`,
                }}
            >
                <div className="wv-mark-layer" style={place(SPOOL_FRAME, BARREL)}>
                    <Layer viewBox={SPOOL_VIEW}>
                        <rect x={BARREL.x} y={BARREL.y} width={BARREL.width} height={BARREL.height} className="wv-spool-core" />
                    </Layer>
                    <div className="wv-mark-layer wv-spool-stack">
                        <Layer viewBox={SPOOL_VIEW}>{woundWraps().map((y) => <Wrap key={y} y={y} />)}</Layer>
                        {/* The newest wrap, uncovered by a cut that rides the thread's end; the
                            contents undo the cut's move so the wrap itself stays put. */}
                        <div className="wv-spool-lay-cut" style={place(LAY_CUT, SPOOL_FRAME)}>
                            <div
                                className="wv-spool-lay-uncut"
                                style={{
                                    ...place(SPOOL_FRAME, LAY_CUT),
                                    transformOrigin: `${percent(SPOOL_CX - SPOOL_VIEW_X, SPOOL_VIEW_SIZE)} ${percent(SPOOL_LAY_Y - SPOOL_VIEW_Y, SPOOL_VIEW_SIZE)}`,
                                }}
                            >
                                <svg viewBox={SPOOL_VIEW} fill="none" focusable="false"><Wrap y={SPOOL_LAY_Y} cap="butt" /></svg>
                            </div>
                        </div>
                        {/* Its round ends: where it starts, and its leading end as it is laid. */}
                        <div className="wv-spool-end" style={place(LAY_END, SPOOL_FRAME)} />
                        <div className="wv-spool-end wv-spool-lay-end" style={place(LAY_END, SPOOL_FRAME)} />
                    </div>
                    <Layer viewBox={SPOOL_VIEW}>
                        <defs>
                            <linearGradient id={`${id}-shade`} x1={BARREL.x} y1="0" x2={BARREL.x + BARREL.width} y2="0" gradientUnits="userSpaceOnUse">
                                <stop offset="0" style={{ stopColor: 'var(--wv-neel-950)', stopOpacity: 0.28 }} />
                                <stop offset="0.3" style={{ stopColor: '#fff', stopOpacity: 0.2 }} />
                                <stop offset="0.6" style={{ stopColor: '#fff', stopOpacity: 0 }} />
                                <stop offset="1" style={{ stopColor: 'var(--wv-neel-950)', stopOpacity: 0.32 }} />
                            </linearGradient>
                        </defs>
                        <rect x={BARREL.x} y={BARREL.y} width={BARREL.width} height={BARREL.height} fill={`url(#${id}-shade)`} />
                    </Layer>
                </div>
            </div>

            <Layer viewBox={SPOOL_VIEW}><Flange y={SPOOL_TOP_Y - SPOOL_RIM_DEPTH} /></Layer>
            {/* Flange holes orbit as it turns; the squash puts the orbit in perspective. */}
            <div className="wv-spool-holes" style={{ ...place(HOLES, SPOOL_FRAME), transform: `scaleY(${SPOOL_FLANGE_RY / SPOOL_FLANGE_RX})` }}>
                <div className="wv-mark-layer wv-spool-spin" style={{ transformOrigin: `50% ${percent(HOLES_REACH + SPOOL_SPIN_DROP, HOLES.height)}` }}>
                    <svg viewBox={`${-HOLES_REACH} ${-HOLES_REACH} ${HOLES.width} ${HOLES.height}`} fill="none" focusable="false">
                        {SPOOL_HOLES.map((angle) => (
                            <circle
                                key={angle}
                                cx={SPOOL_HOLE_ORBIT * Math.sin((angle * Math.PI) / 180)}
                                cy={SPOOL_HOLE_ORBIT * Math.cos((angle * Math.PI) / 180)}
                                r={SPOOL_HOLE_R}
                                className="wv-spool-hole"
                            />
                        ))}
                    </svg>
                </div>
                <Layer viewBox={`${-HOLES_REACH} ${-HOLES_REACH} ${HOLES.width} ${HOLES.height}`}>
                    <circle r={4} className="wv-spool-hole" />
                </Layer>
            </div>

            {/* The incoming thread, flowing in from beyond the frame: it sways about where it
                meets the barrel, and its twist steps along it one phase at a time. */}
            <div
                className="wv-mark-layer wv-spool-lead"
                style={{ transformOrigin: `${percent(attachX - SPOOL_VIEW_X, SPOOL_VIEW_SIZE)} ${percent(SPOOL_LAY_Y - SPOOL_VIEW_Y, SPOOL_VIEW_SIZE)}` }}
            >
                <Layer viewBox={SPOOL_VIEW}>
                    <path d={thread} className="wv-spool-strand" strokeWidth={2.5} strokeLinecap="round" />
                </Layer>
                <div className="wv-mark-layer wv-spool-twist-phases">
                    {Array.from({ length: TWIST_PHASES }, (_, phase) => (
                        <div
                            key={phase}
                            className="wv-mark-layer wv-spool-twist-phase"
                            style={{ animationDelay: `${(phase * TWIST_CYCLE_MS) / TWIST_PHASES - TWIST_CYCLE_MS}ms` }}
                        >
                            <svg viewBox={SPOOL_VIEW} fill="none" focusable="false">
                                <path
                                    d={thread}
                                    className="wv-spool-twist"
                                    strokeWidth={2.5}
                                    strokeDasharray={`${TWIST_DASH} ${TWIST_DASH}`}
                                    strokeDashoffset={(phase * 2 * TWIST_DASH) / TWIST_PHASES}
                                />
                            </svg>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
