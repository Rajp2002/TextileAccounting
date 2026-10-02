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
 * Units are SVG user units in a 96 x 96 viewBox. The step distance in
 * app/globals.css (`wv-spool-*` keyframes) must match SPOOL_WRAP_SPACING.
 */

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
export const SPOOL_HOLES = [0, 120, 240] as const

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
