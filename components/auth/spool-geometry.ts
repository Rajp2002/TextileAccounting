/**
 * Geometry for the spool shown while an account logs out
 * (SpoolMark in components/auth/thread-marks.tsx).
 *
 * The upright spool from the logo, seen slightly from above. Each wind lays
 * one wrap across the front of the barrel (right to left, following its
 * curve) while the spool turns half a revolution, then the wound thread
 * steps down one wrap. Every wrap is identical, so after one step the new
 * wrap sits exactly where the first wound wrap began and the reset is
 * invisible. Two winds make one round.
 *
 * Units are SVG user units in a 96 x 96 viewBox, of which the mark shows the
 * 84 x 84 square at (6, 8). The step distance in app/globals.css
 * (`wv-spool-*` keyframes) must match SPOOL_WRAP_SPACING.
 */

/** The part of the 96 x 96 drawing the mark shows. */
export const SPOOL_VIEW_X = 6
export const SPOOL_VIEW_Y = 8
export const SPOOL_VIEW_SIZE = 84

export const SPOOL_CX = 44
/** Flanges: the face ellipse, and the rim's visible depth below it. */
export const SPOOL_FLANGE_RX = 20
export const SPOOL_FLANGE_RY = 6
export const SPOOL_RIM_DEPTH = 3
export const SPOOL_TOP_Y = 22
export const SPOOL_BOTTOM_Y = 74
/** Barrel radius, and its foreshortened depth at the same viewing angle as the flanges. */
export const SPOOL_BARREL_RX = 14
export const SPOOL_BARREL_RY = (SPOOL_FLANGE_RY * SPOOL_BARREL_RX) / SPOOL_FLANGE_RX
/** Where the newest wrap is laid, just below the top flange. */
export const SPOOL_LAY_Y = 27
export const SPOOL_WRAP_SPACING = 5
export const SPOOL_WRAP_WIDTH = 3.6
/** Holes in the top flange, orbiting as the spool turns. */
export const SPOOL_HOLE_ORBIT = 12.5
export const SPOOL_HOLE_R = 2.6
export const SPOOL_HOLES = [0, 120, 240] as const
/**
 * The holes turn about this point below the hub: the centre of the box around
 * the orbit and the bottom hole, where the mark has always turned them.
 */
export const SPOOL_SPIN_DROP = SPOOL_HOLE_R / 2

/**
 * How far the cut that uncovers the newest wrap reaches from its edge: far
 * enough to cover the whole wrap from any point along it.
 */
export const SPOOL_LAY_CUT_REACH = 40
/** The newest wrap is laid over the first half of each wind, with this easing. */
const LAY_EASING = [0.45, 0, 0.35, 1] as const

export type SpoolLayFrame = {
    /** When, in percent of a wind. */
    offset: number
    /** Where the thread's leading end is on the front of the barrel. */
    x: number
    y: number
    /** Direction of the cut's edge in degrees, square to the thread at (x, y). */
    turn: number
}

/**
 * Samples of the newest wrap being laid, for the `wv-spool-lay-*` keyframes in
 * app/globals.css (straight lines between samples). Each gives the thread's
 * leading end, moving right to left along the wrap at the eased pace a dash
 * drawn along it would have, and the cut that uncovers the wrap up to there.
 */
export function spoolLayFrames(samples = 24): SpoolLayFrame[] {
    const along = arcLengthTable()
    return Array.from({ length: samples + 1 }, (_, index) => {
        const offset = (index / samples) * 50
        if (index === 0) return { offset, x: SPOOL_CX + SPOOL_BARREL_RX, y: SPOOL_LAY_Y, turn: 0 }
        if (index === samples) return { offset, x: SPOOL_CX - SPOOL_BARREL_RX, y: SPOOL_LAY_Y, turn: 180 }
        const angle = along(easeLay(index / samples))
        return {
            offset,
            x: SPOOL_CX + SPOOL_BARREL_RX * Math.cos(angle),
            y: SPOOL_LAY_Y + SPOOL_BARREL_RY * Math.sin(angle),
            turn: (Math.atan2(SPOOL_BARREL_RX * Math.sin(angle), SPOOL_BARREL_RY * Math.cos(angle)) * 180) / Math.PI,
        }
    })
}

function easeLay(time: number): number {
    const [x1, y1, x2, y2] = LAY_EASING
    const curve = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
    let low = 0
    let high = 1
    for (let step = 0; step < 50; step++) {
        const mid = (low + high) / 2
        if (curve(x1, x2, mid) < time) low = mid
        else high = mid
    }
    return curve(y1, y2, (low + high) / 2)
}

/** Maps a share of the wrap's length, from its right end, to the angle around the barrel there. */
function arcLengthTable(steps = 2000): (share: number) => number {
    const lengths = [0]
    for (let step = 1; step <= steps; step++) {
        const a = (Math.PI * step) / steps
        const b = (Math.PI * (step - 1)) / steps
        lengths.push(lengths[step - 1] + Math.hypot(SPOOL_BARREL_RX * (Math.cos(a) - Math.cos(b)), SPOOL_BARREL_RY * (Math.sin(a) - Math.sin(b))))
    }
    const total = lengths[steps]
    return (share) => {
        const target = share * total
        const after = lengths.findIndex((length) => length >= target)
        if (after <= 0) return 0
        const within = (target - lengths[after - 1]) / (lengths[after] - lengths[after - 1])
        return (Math.PI * (after - 1 + within)) / steps
    }
}

/** The front half of a wrap at height y, drawn right to left as the spool turns. */
export function wrapPath(y: number): string {
    const right = SPOOL_CX + SPOOL_BARREL_RX
    const left = SPOOL_CX - SPOOL_BARREL_RX
    return `M${right} ${y}A${SPOOL_BARREL_RX} ${SPOOL_BARREL_RY} 0 0 1 ${left} ${y}`
}

/** Wraps already wound below the newest one. */
export function woundWraps(count = 10): number[] {
    return Array.from({ length: count }, (_, index) => SPOOL_LAY_Y + (index + 1) * SPOOL_WRAP_SPACING)
}

/** Barrel outline: straight sides, and the front arc where it meets the bottom flange. */
export function barrelPath(): string {
    const right = SPOOL_CX + SPOOL_BARREL_RX
    const left = SPOOL_CX - SPOOL_BARREL_RX
    return `M${left} ${SPOOL_TOP_Y}V${SPOOL_BOTTOM_Y}A${SPOOL_BARREL_RX} ${SPOOL_BARREL_RY} 0 0 0 ${right} ${SPOOL_BOTTOM_Y}V${SPOOL_TOP_Y}Z`
}
