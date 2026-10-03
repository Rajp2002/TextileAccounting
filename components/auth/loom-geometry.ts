/**
 * Geometry for the loom shown while an account signs in or is created
 * (LoomMark in components/auth/thread-marks.tsx).
 *
 * A plain weave seen from the weaver's seat: warp ends run top to bottom, the
 * shuttle lays a saffron pick at the fell, the reed beats it in, and the cloth
 * is taken up by one row. One animation loop is two picks (there and back).
 * Plain weave repeats every two rows, so after the loop's two-row take-up both
 * picks sit exactly on woven rows of the same parity and the reset is invisible.
 *
 * Units are SVG user units in a 96 x 96 viewBox. The take-up and shuttle
 * distances in app/globals.css (`wv-loom-*` keyframes) must match these.
 */

export const LOOM_VIEWBOX = 96
export const LOOM_WARPS = [22, 35, 48, 61, 74] as const
export const LOOM_WEFT_START = 15
export const LOOM_WEFT_END = 81
/** Length of one pick, used as its dash length. */
export const LOOM_PASS = LOOM_WEFT_END - LOOM_WEFT_START
/** Where the newest pick is laid. Woven cloth runs below it, bare warp above. */
export const LOOM_FELL = 44
/** Distance between picks, and the take-up per pick. */
export const LOOM_ROW = 10
export const LOOM_WARP_WIDTH = 4.5
export const LOOM_WEFT_WIDTH = 5.5
/** Gap drawn around a thread where it crosses over another, so the weave reads. */
export const LOOM_HALO = 1.5
/** The reed rests this far above the fell and beats down to touch the pick. */
export const LOOM_REED_Y = LOOM_FELL - 10
/** The shuttle rides the fell, centred on the end of the pick it is laying. */
export const LOOM_SHUTTLE_WIDTH = 14
export const LOOM_SHUTTLE_HEIGHT = 6.5

export type LoomParity = 0 | 1
export type LoomRow = { y: number; parity: LoomParity }
export type LoomPick = LoomRow & { direction: 'there' | 'back' }

/** Warp ends that float over a pick of this parity; the others pass under it. */
export function warpsOver(parity: LoomParity): number[] {
    return LOOM_WARPS.filter((_, index) => index % 2 === parity)
}

/**
 * The two picks woven per loop, in cloth coordinates. "Back" is laid after the
 * cloth has moved down one row, so it is placed one row higher to land on the fell.
 */
export const LOOM_PICKS: readonly LoomPick[] = [
    { y: LOOM_FELL, parity: 0, direction: 'there' },
    { y: LOOM_FELL - LOOM_ROW, parity: 1, direction: 'back' },
]

/** Cloth already woven below the fell. Row k sits k rows down, alternating parity. */
export function clothRows(count = 6): LoomRow[] {
    return Array.from({ length: count }, (_, index) => {
        const k = index + 1
        return { y: LOOM_FELL + k * LOOM_ROW, parity: k % 2 === 1 ? 1 : 0 }
    })
}

/** Path for one pick. "Back" runs right to left so its dash draws from the right. */
export function pickPath(pick: LoomPick | LoomRow): string {
    const back = 'direction' in pick && pick.direction === 'back'
    return back
        ? `M${LOOM_WEFT_END} ${pick.y}H${LOOM_WEFT_START}`
        : `M${LOOM_WEFT_START} ${pick.y}H${LOOM_WEFT_END}`
}
