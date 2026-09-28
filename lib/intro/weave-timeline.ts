/**
 * Weavly brand intro: the woven-logo timeline.
 *
 * Pure math shared by the WebGL runtime and the tests. Every visual quantity
 * (camera, pass progress, stage rect, fades) is a function of time, the
 * measured target geometry, and an optional skip, so any frame can be
 * reproduced exactly and the end state is identical however it is reached.
 *
 * Coordinates are viewport CSS px. "World" is the page at rest (z = 1); the
 * camera maps world -> screen as `screen = A + z * world`.
 */

export type IntroSurface = 'landing' | 'app-login'

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type Edges = { l: number; t: number; r: number; b: number }

export type IntroGeometry = {
    viewport: { w: number; h: number }
    /** Opaque ink of the logo inside the target image, at rest. */
    ink: Rect
    /** Full drawn image rect (object-fit applied) of the target, at rest. */
    png: Rect
    /** Untransformed layout box of the target <img>, used to place the handoff clone. */
    logoBox: Rect
    /** Landing only: the black navbar panel the stage lands on. */
    panel: Edges | null
    /** Bottom corner radius of the panel, in px. */
    radius: number
}

export type WeaveMaskInfo = { rows: number; cols: number; firstRow: number; firstCol: number }

export type IntroComposition = {
    surface: IntroSurface
    zHold: number
    zStart: number
    /** Screen point the logo centre sits on at the recognition hold. */
    C0: Point
    /** Fixed point of the pull-back zoom (hold -> rest). */
    F: Point
    holdA: Point
    /** World anchor of the first saffron the loom weaves. */
    Q: Point
    Qhold: Point
    Pstart: Point
    /** Panel edges already off-screen at the hold (landing), so no sleeve is needed there. */
    covered: { l: boolean; r: boolean; b: boolean }
}

export type IntroSkip = {
    at: number
    z0: number
    A0: Point
    page0: number
    tex0: number
    beige0: number
    fell0: number
}

export type IntroFrame = {
    /** Camera. */
    z: number
    A: Point
    /** Pass progress: index of the row currently being inserted (rows < fell are woven). */
    fell: number
    carrierX: number
    inDir: number
    carrierA: number
    trail: number
    beat: number
    reed: number
    shed: number
    /** 1 = woven texture, 0 = flat, clean logo. */
    tex: number
    /** 0 = dark cloth, 1 = the app's beige (app-login surface only). */
    beige: number
    exposure: number
    /** Stage rect [l, t, r, b] in screen px, its bottom radius and shadow. */
    stage: [number, number, number, number]
    radius: number
    shadowZ: number
    shadowA: number
    /** Page plane scale (depth parallax), about F. */
    pageS: number
    /** Opacity of the handoff clone of the real logo. */
    imgA: number
    /** Opacity of the shader's own flat logo copy (steps aside under the clone). */
    logoA: number
    /** 0..1 fade of the whole intro group at arrival. */
    fade: number
    done: boolean
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

/** Weft passes across the logo's height; the spool's windings set this density. */
export const WEAVE_PASSES = 150
const LEAD_IN = 1
const TRAIL = 3
const DUR_HEAD = [0.22, 0.17, 0.13, 0.10, 0.075, 0.055, 0.04, 0.03, 0.022, 0.016, 0.012]
const DUR_TAIL = [0.015, 0.025, 0.04, 0.06]
const DUR_MID = 0.013
export const WEAVE_START = 0.25
const HOLD = 0.55
const HANDOFF = 1.1
const ARRIVAL: Record<IntroSurface, number> = { landing: 0.25, 'app-login': 0.35 }
const PAGE_DEPTH = 0.10
const SKIP_DURATION = 0.36

export const PASS_COUNT = LEAD_IN + WEAVE_PASSES + TRAIL

const passDurations: number[] = Array.from({ length: PASS_COUNT }, (_, k) => {
    if (k < DUR_HEAD.length) return DUR_HEAD[k]
    if (k >= PASS_COUNT - DUR_TAIL.length) return DUR_TAIL[k - (PASS_COUNT - DUR_TAIL.length)]
    return DUR_MID
})
const passStarts: number[] = passDurations.reduce<number[]>((acc, d) => {
    acc.push(acc[acc.length - 1] + d)
    return acc
}, [0])

export const WEAVE_LENGTH = passStarts[PASS_COUNT]
export const WEAVE_END = WEAVE_START + WEAVE_LENGTH
export const HANDOFF_START = WEAVE_END + HOLD
export const HANDOFF_END = HANDOFF_START + HANDOFF

export function introDuration(surface: IntroSurface): number {
    return HANDOFF_END + ARRIVAL[surface]
}

/** Time the given logo row starts being woven. */
export function rowStartTime(row: number): number {
    const k = Math.min(PASS_COUNT, Math.max(0, row + LEAD_IN))
    return WEAVE_START + passStarts[k]
}

/** When the name reads fully (the loom passes the baseline, ~62% of the rows). */
export const LEGIBLE_TIME = rowStartTime(Math.round(WEAVE_PASSES * 0.62))

// ─── Easing ──────────────────────────────────────────────────────────────────

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const sx = (t: number) => ((ax * t + bx) * t + cx) * t
    const sy = (t: number) => ((ay * t + by) * t + cy) * t
    const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; i++) {
            const e = sx(t) - x
            const d = dx(t)
            if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break
            t -= e / d
        }
        return sy(clamp(t))
    }
}
const handoffEase = cubicBezier(0.6, 0.0, 0.24, 1.0)

// ─── Composition ──────────────────────────────────────────────────────────────

export function composeIntro(surface: IntroSurface, geo: IntroGeometry, mask: WeaveMaskInfo): IntroComposition {
    const { w: vw, h: vh } = geo.viewport
    const aspect = geo.ink.w / geo.ink.h
    let holdW = vw < vh * 0.9 ? vw * 0.84 : Math.min(vw * 0.56, vh * 0.5 * aspect)
    holdW = Math.min(holdW, 940)
    const zHold = Math.max(1.5, holdW / geo.ink.w)
    const C0 = { x: vw / 2, y: vh * 0.47 }
    const L = { x: geo.ink.x + geo.ink.w / 2, y: geo.ink.y + geo.ink.h / 2 }
    const F = { x: (zHold * L.x - C0.x) / (zHold - 1), y: (zHold * L.y - C0.y) / (zHold - 1) }
    const holdA = { x: F.x * (1 - zHold), y: F.y * (1 - zHold) }
    const cw = geo.ink.w / mask.cols
    const ch = geo.ink.h / mask.rows
    const Q = { x: geo.ink.x + (mask.firstCol + 0.5) * cw, y: geo.ink.y + mask.firstRow * ch }
    const Qhold = { x: holdA.x + zHold * Q.x, y: holdA.y + zHold * Q.y }
    const Pstart = { x: lerp(Qhold.x, C0.x, 0.35), y: vh * 0.4 }
    const p = geo.panel
    const covered = p
        ? { l: holdA.x + zHold * p.l <= 0, r: holdA.x + zHold * p.r >= vw, b: holdA.y + zHold * p.b >= vh }
        : { l: true, r: true, b: true }
    return { surface, zHold, zStart: zHold * 2.4, C0, F, holdA, Q, Qhold, Pstart, covered }
}

// ─── Frame state ──────────────────────────────────────────────────────────────

function weaveAt(tw: number) {
    if (tw <= 0) return { k: 0, f: 0, since: 0 }
    if (tw >= WEAVE_LENGTH) return { k: PASS_COUNT, f: 0, since: tw - WEAVE_LENGTH }
    let lo = 0
    let hi = PASS_COUNT - 1
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (passStarts[mid] <= tw) lo = mid
        else hi = mid - 1
    }
    return { k: lo, f: (tw - passStarts[lo]) / passDurations[lo], since: tw - passStarts[lo] }
}

export function introStateAt(
    t: number,
    comp: IntroComposition,
    geo: IntroGeometry,
    mask: WeaveMaskInfo,
    skip: IntroSkip | null,
): IntroFrame {
    const { w: vw, h: vh } = geo.viewport
    const surface = comp.surface
    const end = introDuration(surface)
    const skipping = skip !== null && t >= skip.at
    const lastRow = PASS_COUNT - LEAD_IN

    // ----- the loom -----
    const w = weaveAt(t - WEAVE_START)
    const woven = w.k >= PASS_COUNT
    let fell = woven ? lastRow : w.k - LEAD_IN
    if (skipping) fell = Math.round(lerp(skip.fell0, lastRow, smooth(0, 0.18, t - skip.at)))
    const prevDur = w.k > 0 ? passDurations[Math.min(w.k, PASS_COUNT) - 1] : 0
    const slowPrev = clamp((prevDur - 0.02) / 0.06)
    const pulse = w.k > 0 ? 1 - smooth(0, Math.min(0.09, prevDur * 0.7), w.since) : 0
    let beat = 0.35 * slowPrev * pulse
    let reed = -0.9 * slowPrev * (w.k > 0 ? Math.sin(Math.PI * clamp(w.since / 0.09)) : 0)
    const curDur = w.k < PASS_COUNT ? passDurations[w.k] : 0
    const shed = woven || skipping ? 0 : clamp((curDur - 0.02) / 0.08)
    const inDir = w.k % 2
    const carrierA = woven || skipping ? 0 : clamp((curDur - 0.018) / 0.03)
    if (skipping) { beat = 0; reed = 0 }
    let exposure = smooth(0.02, 0.38, t)

    // ----- camera -----
    const { zHold, zStart, F, Q, Qhold, Pstart } = comp
    let z: number
    let A: Point
    let pageS = 1 + PAGE_DEPTH
    let tex = 1
    let sleeve = 0
    let imgA = 0
    let fade = 0
    let beige = 0
    const inHandoff = t >= HANDOFF_START || skipping
    if (t < HANDOFF_START) {
        // Main pull-back reaches (almost) the hold framing as the name becomes legible,
        // so it is never cropped on narrow screens, then settles gently.
        const u1 = easeInOutCubic(clamp((t - 0.55) / (LEGIBLE_TIME - 0.55)))
        const u2 = easeOutCubic(clamp((t - LEGIBLE_TIME) / (WEAVE_END + 0.15 - LEGIBLE_TIME)))
        const zMid = zHold * 1.06
        z = t < LEGIBLE_TIME
            ? Math.exp(lerp(Math.log(zStart), Math.log(zMid), u1))
            : Math.exp(lerp(Math.log(zMid), Math.log(zHold), u2))
        const u = t < LEGIBLE_TIME ? u1 * 0.94 : 0.94 + 0.06 * u2
        const P = { x: lerp(Pstart.x, Qhold.x, u), y: lerp(Pstart.y, Qhold.y, u) }
        A = { x: P.x - z * Q.x, y: P.y - z * Q.y }
    } else {
        const u = clamp((t - HANDOFF_START) / HANDOFF)
        const e = handoffEase(u)
        z = u >= 1 ? 1 : Math.exp(Math.log(zHold) * (1 - e))
        A = u >= 1 ? { x: 0, y: 0 } : { x: F.x * (1 - z), y: F.y * (1 - z) }
        pageS = 1 + PAGE_DEPTH * (Math.log(z) / Math.log(zHold))
        tex = smooth(Math.max(1.6, zHold * 0.28), zHold * 0.6, z)
        sleeve = easeInOutCubic(clamp(u / 0.5))
        imgA = 1 - smooth(1.55, 2.3, z)
        fade = smooth(HANDOFF_END - 0.04, end, t)
        beige = surface === 'app-login' ? smooth(0.1, 0.42, u) : 0
    }

    // ----- skip: fast-forward from wherever we are to the same end state -----
    if (skipping) {
        const u = clamp((t - skip.at) / SKIP_DURATION)
        const e = easeOutCubic(u)
        const z0 = skip.z0
        const Fs = Math.abs(1 - z0) > 1e-3 ? { x: skip.A0.x / (1 - z0), y: skip.A0.y / (1 - z0) } : { x: 0, y: 0 }
        z = u >= 1 ? 1 : Math.exp(Math.log(z0) * (1 - e))
        A = u >= 1 ? { x: 0, y: 0 } : { x: Fs.x * (1 - z), y: Fs.y * (1 - z) }
        pageS = lerp(skip.page0, 1, e)
        tex = skip.tex0 * (1 - smooth(0, 0.6, u))
        sleeve = Math.max(0, e)
        imgA = smooth(0.35, 0.8, u)
        fade = smooth(0.36, 0.58, t - skip.at)
        beige = surface === 'app-login' ? Math.max(skip.beige0, e) : 0
        exposure = 1
    }
    if (surface === 'app-login') pageS = 1

    // ----- stage: the navbar magnified (landing), or the whole screen (app-login) -----
    let stage: [number, number, number, number] = [-4, -4, vw + 4, vh + 4]
    let radius = 0
    let shadowA = 0
    if (surface === 'landing' && geo.panel && inHandoff) {
        const p = geo.panel
        const ps = { l: A.x + z * p.l, r: A.x + z * p.r, b: A.y + z * p.b }
        const cov = comp.covered
        const L = cov.l ? ps.l : Math.min(ps.l, lerp(-4, ps.l, sleeve))
        const R = cov.r ? ps.r : Math.max(ps.r, lerp(vw + 4, ps.r, sleeve))
        const B = cov.b ? ps.b : Math.max(ps.b, lerp(vh + 4, ps.b, sleeve))
        stage = [L, -4, R, B]
        radius = geo.radius * z * (cov.l && cov.r && cov.b ? 1 : sleeve)
        // the navbar's own shadow takes over near rest, so it never doubles
        shadowA = smooth(1.0, 1.7, z)
    }

    const carrierSX = lerp(-0.05 * vw, 1.05 * vw, inDir ? 1 - w.f : w.f)
    const cellScreen = z * geo.ink.w / mask.cols
    const trail = curDur > 0 ? clamp((1.1 * vw / curDur) / 60 / cellScreen, 1, 60) : 1
    const done = skipping ? t - skip.at >= 0.58 : t >= end

    return {
        z, A, fell,
        carrierX: (carrierSX - A.x) / z,
        inDir, carrierA, trail, beat, reed, shed,
        tex, beige, exposure,
        stage, radius,
        shadowZ: Math.min(z, 2.5), shadowA,
        pageS,
        imgA,
        logoA: inHandoff && !skipping ? smooth(1.3, 1.5, z) : skipping ? 1 - smooth(0.8, 0.95, imgA) : 1,
        fade,
        done,
    }
}

/** Snapshot the current frame so a skip can fast-forward from exactly here. */
export function skipFrom(t: number, frame: IntroFrame): IntroSkip {
    return { at: t, z0: frame.z, A0: frame.A, page0: frame.pageS, tex0: frame.tex, beige0: frame.beige, fell0: frame.fell }
}
