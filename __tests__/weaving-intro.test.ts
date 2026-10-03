import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildAppIntroPrePaintScript, buildIntroPrePaintScript, INTRO_ATTRIBUTE, INTRO_LEAVING_ATTRIBUTE } from '../lib/intro/intro-policy'
import { INTRO_TELEMETRY_PATH } from '../lib/intro/intro-telemetry'
import { readStartupIntroPreference, saveStartupIntroPreference, STARTUP_INTRO_PREFERENCE_KEY, STARTUP_INTRO_SEEN_KEY } from '../lib/intro/startup-preference'
import { containedImageRect, inkRect, parseObjectPosition } from '../lib/intro/target-geometry'
import { BINDING, buildWeaveMask, FIGURE, LOGO_INK_BOX, LOGO_SOURCE } from '../lib/intro/weave-mask'
import {
    ALL_WOVEN,
    composeIntro,
    HANDOFF_END,
    HANDOFF_START,
    introDuration,
    introStateAt,
    LEGIBLE_TIME,
    rowStartTime,
    skipFrom,
    WEAVE_END,
    WEAVE_PASSES,
    WEAVE_START,
    workLightY,
    type IntroGeometry,
    type IntroSurface,
    type WeaveMaskInfo,
} from '../lib/intro/weave-timeline'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

// Geometry measured from the landing header at 1440x900 and 390x844 (14px root font size).
const DESKTOP: IntroGeometry = {
    viewport: { w: 1440, h: 900 },
    ink: { x: 197.124, y: 24.512, w: 74.202, h: 42.698 },
    png: { x: 189, y: 7, w: 92.436, h: 77 },
    logoBox: { x: 189, y: 10.5, w: 196, h: 70 },
    panel: { l: 160, t: 0, r: 1280, b: 92 },
    radius: 10.5,
}
const PHONE: IntroGeometry = {
    viewport: { w: 390, h: 844 },
    ink: { x: 35.499, y: 21.71, w: 59.361, h: 34.158 },
    png: { x: 29, y: 8.2, w: 73.95, h: 61.6 },
    logoBox: { x: 29, y: 10.5, w: 140, h: 56 },
    panel: { l: 14, t: 0, r: 376, b: 78 },
    radius: 10.5,
}
const LOGIN: IntroGeometry = {
    viewport: { w: 1440, h: 900 },
    ink: { x: 673.4, y: 238.9, w: 93.2, h: 53.6 },
    png: { x: 669.5, y: 214.8, w: 100.8, h: 84 },
    logoBox: { x: 650, y: 214.8, w: 140, h: 84 },
    panel: null,
    radius: 0,
}
const MASK: WeaveMaskInfo = { rows: 150, cols: 261, firstRow: 0, firstCol: 22 }

const setup = (surface: IntroSurface, geo: IntroGeometry) => ({ geo, comp: composeIntro(surface, geo, MASK) })

describe('woven intro timeline', () => {
    it('runs about five seconds and weaves every logo row before the hold', () => {
        expect(introDuration('landing')).toBeGreaterThan(4.8)
        expect(introDuration('landing')).toBeLessThan(5.2)
        expect(rowStartTime(0)).toBeLessThan(0.6) // first saffron arrives on an early, slow pass
        expect(LEGIBLE_TIME).toBeLessThan(WEAVE_END)
        expect(rowStartTime(WEAVE_PASSES)).toBeLessThanOrEqual(WEAVE_END)
        expect(HANDOFF_START).toBeGreaterThan(WEAVE_END)
    })

    it('holds the finished logo centred, large, on a stage that covers the whole screen', () => {
        const { geo, comp } = setup('landing', DESKTOP)
        const s = introStateAt((WEAVE_END + HANDOFF_START) / 2, comp, geo, MASK, null)
        expect(s.stage).toEqual([-4, -4, 1444, 904])
        const centre = { x: s.A.x + s.z * (geo.ink.x + geo.ink.w / 2), y: s.A.y + s.z * (geo.ink.y + geo.ink.h / 2) }
        expect(centre.x).toBeCloseTo(720, 0)
        expect(centre.y).toBeCloseTo(900 * 0.47, 0)
        expect(s.z * geo.ink.w).toBeGreaterThan(700)
        expect(s.tex).toBe(1)
    })

    it('weaves the cloth all the way down past the screen before the hold, with no bare warp left in view', () => {
        const SHORT: IntroGeometry = { ...DESKTOP, viewport: { w: 1440, h: 520 } }
        for (const [surface, g] of [['landing', DESKTOP], ['landing', PHONE], ['landing', SHORT], ['app-login', LOGIN]] as const) {
            const { geo, comp } = setup(surface, g)
            const cellH = geo.ink.h / MASK.rows
            const holdScreenY = (row: number) => comp.holdA.y + comp.zHold * (geo.ink.y + row * cellH)
            // the fell only ever moves down, and is past the bottom edge (with the reed) before the cloth completes
            let previous = -Infinity
            let lastRow = -Infinity
            for (let t = WEAVE_START; t < WEAVE_END; t += 1 / 120) {
                const { fell } = introStateAt(t, comp, geo, MASK, null)
                expect(fell).toBeGreaterThanOrEqual(previous)
                previous = fell
                if (fell < ALL_WOVEN) lastRow = fell
            }
            expect(holdScreenY(lastRow)).toBeGreaterThan(geo.viewport.h)
            // from the hold through the whole pull-back, every row is woven cloth
            for (let t = WEAVE_END; t <= introDuration(surface); t += 0.05) {
                expect(introStateAt(t, comp, geo, MASK, null).fell).toBe(ALL_WOVEN)
            }
        }
    })

    it('keeps the loom\'s work-light on a finite, continuous track after the logo, so the cloth never flickers', () => {
        // the shader's work-light gain at the bottom edge of the screen, where the run-out ends
        const bottomGain = (y: number, vh: number, tex: number) => {
            const ly = (vh - y) / vh
            return 1 + tex * (0.55 * Math.exp(-ly * ly * 22) - 0.12)
        }
        for (const [surface, g] of [['landing', DESKTOP], ['landing', PHONE], ['app-login', LOGIN]] as const) {
            const { geo, comp } = setup(surface, g)
            const vh = geo.viewport.h
            // played through: through the run-out, the hold and the pull-back, the light glides
            let previous: { y: number; gain: number } | null = null
            for (let t = WEAVE_END - 0.6; t <= introDuration(surface); t += 1 / 120) {
                const s = introStateAt(t, comp, geo, MASK, null)
                const y = workLightY(s, geo, MASK)
                const gain = bottomGain(y, vh, s.tex)
                if (previous) {
                    expect(Math.abs(y - previous.y)).toBeLessThan(0.05 * vh)
                    expect(Math.abs(gain - previous.gain)).toBeLessThan(0.1)
                }
                previous = { y, gain }
            }
            // skipped: the light rides the loom down to where the run-out rests, never off to infinity
            for (const at of [WEAVE_END - 0.2, WEAVE_END + 0.1, HANDOFF_START + 0.3]) {
                const skip = skipFrom(at, introStateAt(at, comp, geo, MASK, null))
                let row = -Infinity
                for (let t = at; t <= at + 0.6; t += 1 / 120) {
                    const s = introStateAt(t, comp, geo, MASK, skip)
                    expect(Number.isFinite(workLightY(s, geo, MASK))).toBe(true)
                    expect(s.lightRow).toBeGreaterThanOrEqual(row)
                    expect(s.lightRow).toBeLessThanOrEqual(comp.coverRow)
                    row = s.lightRow
                }
                expect(row).toBe(comp.coverRow)
            }
        }
    })

    it('keeps the whole name on screen on a phone when it becomes legible', () => {
        const { geo, comp } = setup('landing', PHONE)
        const s = introStateAt(LEGIBLE_TIME, comp, geo, MASK, null)
        const left = s.A.x + s.z * geo.ink.x
        const right = s.A.x + s.z * (geo.ink.x + geo.ink.w)
        expect(left).toBeGreaterThan(0)
        expect(right).toBeLessThan(390)
    })

    it('pulls back so the black stage lands exactly on the navbar panel and the clone on the logo', () => {
        for (const g of [DESKTOP, PHONE]) {
            const { geo, comp } = setup('landing', g)
            const s = introStateAt(HANDOFF_END, comp, geo, MASK, null)
            expect(s.z).toBe(1)
            expect(s.A).toEqual({ x: 0, y: 0 })
            expect(s.stage[0]).toBeCloseTo(geo.panel!.l, 6)
            expect(s.stage[2]).toBeCloseTo(geo.panel!.r, 6)
            expect(s.stage[3]).toBeCloseTo(geo.panel!.b, 6)
            expect(s.radius).toBeCloseTo(geo.radius, 6)
            expect(s.pageS).toBe(1)
            expect(s.tex).toBe(0)
            expect(s.imgA).toBe(1)
            expect(s.logoA).toBe(0) // the shader copy has stepped aside: no stacked edges under the real logo
            expect(s.shadowA).toBe(0) // the navbar's own shadow takes over
        }
    })

    it('uses one fixed point for the pull-back, so the logo never curves or reverses', () => {
        const { geo, comp } = setup('landing', DESKTOP)
        const L = { x: geo.ink.x + geo.ink.w / 2, y: geo.ink.y + geo.ink.h / 2 }
        let previousZ = Infinity
        for (let t = HANDOFF_START; t <= HANDOFF_END; t += 0.05) {
            const s = introStateAt(t, comp, geo, MASK, null)
            expect(s.z).toBeLessThanOrEqual(previousZ + 1e-9)
            previousZ = s.z
            const screen = { x: s.A.x + s.z * L.x, y: s.A.y + s.z * L.y }
            // screen = F + z (L - F): the logo centre stays on the line through F
            expect(screen.x).toBeCloseTo(comp.F.x + s.z * (L.x - comp.F.x), 6)
            expect(screen.y).toBeCloseTo(comp.F.y + s.z * (L.y - comp.F.y), 6)
        }
    })

    it('ends in the same state whether it plays out or is skipped at any moment', () => {
        const { geo, comp } = setup('landing', DESKTOP)
        const end = introStateAt(introDuration('landing'), comp, geo, MASK, null)
        expect(end.done).toBe(true)
        expect(end.fade).toBe(1)
        for (const at of [0.1, 1.2, 2.8, HANDOFF_START + 0.3]) {
            const skip = skipFrom(at, introStateAt(at, comp, geo, MASK, null))
            const s = introStateAt(at + 0.6, comp, geo, MASK, skip)
            expect(s.done).toBe(true)
            expect(s.z).toBe(1)
            expect(s.A).toEqual({ x: 0, y: 0 })
            expect(s.fade).toBe(1)
            expect(s.pageS).toBeCloseTo(1, 9)
            expect(s.fell).toBe(end.fell) // the loom finishes every row, never pops half a logo
            expect(s.lightRow).toBe(end.lightRow)
        }
    })

    it('turns the black cloth into the app beige for the installed app and lands in the login card', () => {
        const { geo, comp } = setup('app-login', LOGIN)
        const mid = introStateAt((WEAVE_END + HANDOFF_START) / 2, comp, geo, MASK, null)
        expect(mid.beige).toBe(0)
        const s = introStateAt(HANDOFF_END, comp, geo, MASK, null)
        expect(s.beige).toBe(1)
        expect(s.stage).toEqual([-4, -4, 1444, 904]) // no navbar: the whole screen becomes the page background
        expect(s.pageS).toBe(1)
        expect(s.z).toBe(1)
        expect(introDuration('app-login')).toBeGreaterThan(introDuration('landing'))
    })
})

describe('woven intro mask', () => {
    it('turns the alpha into one row per pass with ties on long floats', () => {
        const width = 400
        const height = 100
        const alpha = new Uint8Array(width * height)
        for (let y = 40; y < 60; y++) for (let x = 20; x < 380; x++) alpha[y * width + x] = 255 // a long bar
        const mask = buildWeaveMask(alpha, width, height, 50)
        expect(mask.rows).toBe(50)
        expect(mask.cols).toBe(200)
        expect(mask.firstRow).toBe(20)
        const row = Array.from(mask.data.subarray(25 * mask.cols, 26 * mask.cols))
        expect(row.filter((v) => v === FIGURE).length).toBeGreaterThan(150)
        expect(row.filter((v) => v === BINDING).length).toBeGreaterThan(10)
        expect(row.every((v) => v === 0 || v === FIGURE || v === BINDING)).toBe(true)
        expect(mask.data.subarray(0, 19 * mask.cols).every((v) => v === 0)).toBe(true)
    })

    it('matches the real logo asset bounds', () => {
        expect(LOGO_SOURCE).toEqual({ src: '/images/WeavlyLogo.png', width: 1024, height: 853 })
        expect(LOGO_INK_BOX).toEqual({ x0: 90, y0: 194, x1: 912, y1: 667 })
    })
})

describe('woven intro target geometry', () => {
    it('locates the drawn logo for left- and centre-aligned object-fit: contain', () => {
        expect(parseObjectPosition('0% 50%')).toEqual([0, 0.5])
        expect(parseObjectPosition('50% 50%')).toEqual([0.5, 0.5])
        expect(parseObjectPosition('left center')).toEqual([0, 0.5])
        const nav = containedImageRect({ x: 189, y: 3, w: 215.6, h: 77 }, LOGO_SOURCE, '0% 50%')
        expect(nav.x).toBe(189)
        expect(nav.h).toBeCloseTo(77, 6)
        const card = containedImageRect({ x: 650, y: 214.8, w: 140, h: 84 }, LOGO_SOURCE, '50% 50%')
        expect(card.x + card.w / 2).toBeCloseTo(720, 6)
        const ink = inkRect(nav, LOGO_SOURCE, LOGO_INK_BOX)
        expect(ink.w / ink.h).toBeCloseTo(822 / 473, 6)
    })
})

type PolicyEnv = {
    bootstrap?: boolean
    pathname?: string
    readyState?: string
    bodyAbsent?: boolean
    search?: string
    hash?: string
    referrer?: string
    media?: string[]
    webgl2?: boolean
    saveData?: boolean
    navType?: string
    iosStandalone?: boolean
    storage?: Map<string, string>
    storageReadFails?: boolean
    storageWriteFails?: boolean
}

function runPolicy(surface: IntroSurface, env: PolicyEnv = {}) {
    const attrs = new Map<string, string>()
    const storageTouched: string[] = []
    const stored = env.storage ?? new Map<string, string>()
    const listeners = new Set<string>()
    const timers: Array<() => void> = []
    const documentListeners = new Map<string, () => void>()
    const rootStyle = { backgroundColor: '' }
    const bodyStyle = { backgroundColor: '', transition: '' }
    const preloads: unknown[] = []
    const beacons: Array<{ url: string; body: string }> = []
    let clock = 100
    const win: Record<string, unknown> = {
        matchMedia: (query: string) => ({ matches: (env.media ?? []).includes(query) }),
        localStorage: {
            getItem: (k: string) => { storageTouched.push(k); if (env.storageReadFails) throw new Error('blocked'); return stored.get(k) ?? null },
            setItem: (k: string, value: string) => { storageTouched.push(k); if (env.storageWriteFails) throw new Error('quota'); stored.set(k, value) },
            removeItem: (k: string) => { storageTouched.push(k); stored.delete(k) },
        },
        performance: { getEntriesByType: () => (env.navType ? [{ type: env.navType }] : []), now: () => (clock += 250) },
        addEventListener: (type: string) => listeners.add(type),
        removeEventListener: (type: string) => listeners.delete(type),
    }
    if (env.webgl2 !== false) win.WebGL2RenderingContext = function WebGL2RenderingContext() {}
    const context = vm.createContext({
        window: win,
        document: {
            documentElement: {
                style: rootStyle,
                setAttribute: (k: string, v: string) => attrs.set(k, v),
                removeAttribute: (k: string) => attrs.delete(k),
            },
            body: env.bodyAbsent ? null : { style: bodyStyle },
            readyState: env.readyState ?? 'complete',
            addEventListener: (type: string, fn: () => void) => documentListeners.set(type, fn),
            removeEventListener: (type: string) => documentListeners.delete(type),
            referrer: env.referrer ?? '',
            createElement: () => ({}),
            head: { appendChild: (link: unknown) => preloads.push(link) },
        },
        location: { pathname: env.pathname ?? '/login', search: env.search ?? '', hash: env.hash ?? '', origin: 'https://weavly.example' },
        navigator: {
            connection: env.saveData ? { saveData: true } : undefined,
            standalone: env.iosStandalone,
            sendBeacon: (url: string, body: string) => { beacons.push({ url, body }); return true },
        },
        setTimeout: (fn: () => void) => { timers.push(fn); return timers.length },
        clearTimeout: () => undefined,
    })
    vm.runInContext(env.bootstrap ? buildAppIntroPrePaintScript() : buildIntroPrePaintScript(surface), context)
    const handle = win.__weavlyIntro as {
        state: string
        release: () => void
        abort: (remember?: boolean, reason?: string) => void
        markSeen: () => void
        mark: (step: string) => void
        report: (reason: string, detail?: string) => void
    } | undefined
    const runPageScript = () => vm.runInContext(buildIntroPrePaintScript(surface), context)
    return { attrs, storageTouched, stored, listeners, timers, handle, documentListeners, rootStyle, bodyStyle, preloads, beacons, runPageScript, plays: attrs.get(INTRO_ATTRIBUTE) === surface }
}

describe('woven intro playback policy (pre-paint script)', () => {
    const STANDALONE = ['(display-mode: standalone)']

    it('plays every time the landing page is opened, including reloads, and preloads the logo', () => {
        const r = runPolicy('landing', { referrer: 'https://www.google.com/' })
        expect(r.plays).toBe(true)
        expect(r.handle?.state).toBe('pending')
        expect([...r.listeners].sort()).toEqual(['keydown', 'pointerdown', 'touchstart', 'wheel'])
        expect(r.timers.length).toBe(1)
        expect(runPolicy('landing').plays).toBe(true)
        expect(runPolicy('landing', { navType: 'reload' }).plays).toBe(true)
        // no "already seen" memory: nothing is read from or written to storage
        expect(r.storageTouched).toEqual([])
    })

    it('does not play where it would get in the way', () => {
        expect(runPolicy('landing', { referrer: 'https://weavly.example/login' }).plays).toBe(false)
        expect(runPolicy('landing', { hash: '#pricing' }).plays).toBe(false)
        expect(runPolicy('landing', { navType: 'back_forward' }).plays).toBe(false)
        expect(runPolicy('landing', { saveData: true }).plays).toBe(false)
        expect(runPolicy('landing', { webgl2: false }).plays).toBe(false)
        expect(runPolicy('landing', { search: '?intro=0' }).plays).toBe(false)
    })

    it('always respects reduced motion, even when forced', () => {
        expect(runPolicy('landing', { media: ['(prefers-reduced-motion: reduce)'] }).plays).toBe(false)
        expect(runPolicy('landing', { search: '?intro=1', media: ['(prefers-reduced-motion: reduce)'] }).plays).toBe(false)
    })

    it('can be forced with ?intro=1', () => {
        expect(runPolicy('landing', { search: '?intro=1', hash: '#pricing', navType: 'back_forward' }).plays).toBe(true)
        expect(runPolicy('app-login', { search: '?intro=1' }).plays).toBe(true)
    })

    it('plays on the first eligible launch of the installed app, but not in a browser tab or after moving inside the app', () => {
        expect(runPolicy('app-login').plays).toBe(false)
        expect(runPolicy('app-login', { media: STANDALONE }).plays).toBe(true)
        expect(runPolicy('app-login', { media: STANDALONE, navType: 'reload' }).plays).toBe(true)
        expect(runPolicy('app-login', { iosStandalone: true }).plays).toBe(true)
        expect(runPolicy('app-login', { media: STANDALONE, referrer: 'https://weavly.example/owner/estimator' }).plays).toBe(false)
    })

    it('remembers a completed or explicitly skipped installed intro and goes straight to login next time', () => {
        for (const finish of ['complete', 'skip'] as const) {
            const storage = new Map<string, string>()
            const first = runPolicy('app-login', { media: STANDALONE, storage })
            expect(first.plays).toBe(true)
            expect(storage.has(STARTUP_INTRO_SEEN_KEY)).toBe(false)
            if (finish === 'skip') first.handle?.abort(true)
            else first.handle?.markSeen()
            expect(storage.get(STARTUP_INTRO_SEEN_KEY)).toBe('1')
            const later = runPolicy('app-login', { media: STANDALONE, storage, navType: 'reload' })
            expect(later.plays).toBe(false)
            expect(later.rootStyle.backgroundColor).toBe('')
            expect(later.preloads).toHaveLength(0)
        }
    })

    it('honours an explicit every-launch or off preference while retaining URL overrides', () => {
        const storage = new Map([[STARTUP_INTRO_SEEN_KEY, '1'], [STARTUP_INTRO_PREFERENCE_KEY, 'always']])
        expect(runPolicy('app-login', { media: STANDALONE, storage }).plays).toBe(true)
        storage.set(STARTUP_INTRO_PREFERENCE_KEY, 'never')
        const off = runPolicy('app-login', { media: STANDALONE, storage })
        expect(off.plays).toBe(false)
        expect(off.rootStyle.backgroundColor).toBe('')
        expect(runPolicy('app-login', { storage, search: '?intro=1' }).plays).toBe(true)
        expect(runPolicy('app-login', { storage, search: '?intro=1&intro=0', media: STANDALONE }).plays).toBe(false)
        expect(runPolicy('landing', { storage }).plays).toBe(true)
    })

    it('goes straight to login before painting a stage when device storage is unavailable', () => {
        for (const failure of [{ storageReadFails: true }, { storageWriteFails: true }]) {
            const result = runPolicy('app-login', { media: STANDALONE, ...failure })
            expect(result.plays).toBe(false)
            expect(result.rootStyle.backgroundColor).toBe('')
            expect(result.bodyStyle.backgroundColor).toBe('')
            expect(result.preloads).toHaveLength(0)
            expect(result.timers).toHaveLength(0)
            expect(runPolicy('landing', failure).plays).toBe(true)
        }
    })

    it('does not count a startup failure as a completed intro', () => {
        const result = runPolicy('app-login', { media: STANDALONE })
        result.timers[0]()
        expect(result.stored.has(STARTUP_INTRO_SEEN_KEY)).toBe(false)
    })

    it('paints installed login launches dark from the head, before the body exists', () => {
        const r = runPolicy('app-login', { bootstrap: true, iosStandalone: true, bodyAbsent: true, readyState: 'loading' })
        expect(r.plays).toBe(true)
        expect(r.rootStyle.backgroundColor).toBe('rgb(7,7,6)')
        // A delayed HTML stream must not consume the hydration start budget.
        expect(r.timers).toHaveLength(0)
        r.documentListeners.get('DOMContentLoaded')?.()
        expect(r.timers).toHaveLength(1)
        r.timers[0]()
        expect(r.handle?.state).toBe('done')
        r.timers[1]()
        expect(r.rootStyle.backgroundColor).toBe('')
        expect(r.attrs.has(INTRO_ATTRIBUTE)).toBe(false)
    })

    it('reuses the head decision without restarting the watchdog or a completed intro', () => {
        const r = runPolicy('app-login', { bootstrap: true, media: STANDALONE })
        r.runPageScript()
        expect(r.timers).toHaveLength(1)
        expect(r.preloads).toHaveLength(1)
        r.handle?.abort()
        r.timers[1]()
        r.runPageScript()
        expect(r.handle?.state).toBe('done')
        expect(r.attrs.has(INTRO_ATTRIBUTE)).toBe(false)
        expect(r.rootStyle.backgroundColor).toBe('')
        expect(r.bodyStyle.backgroundColor).toBe('')
        expect(r.bodyStyle.transition).toBe('')
    })

    it('leaves other routes and ineligible launches on their normal backgrounds', () => {
        for (const env of [
            { pathname: '/owner/estimator', iosStandalone: true },
            { pathname: '/', search: '?intro=1', iosStandalone: true },
            {},
            { iosStandalone: true, search: '?intro=0' },
            { iosStandalone: true, media: ['(prefers-reduced-motion: reduce)'] },
            { iosStandalone: true, saveData: true },
            { iosStandalone: true, webgl2: false },
            { iosStandalone: true, referrer: 'https://weavly.example/owner/estimator' },
        ]) {
            const r = runPolicy('app-login', { ...env, bootstrap: true })
            expect(r.plays).toBe(false)
            expect(r.rootStyle.backgroundColor).toBe('')
            expect(r.bodyStyle.backgroundColor).toBe('')
            expect(r.timers).toHaveLength(0)
        }
    })

    it('cancels the deferred watchdog if playback starts or is skipped before parsing finishes', () => {
        const running = runPolicy('app-login', { bootstrap: true, iosStandalone: true, readyState: 'loading' })
        running.handle!.state = 'running'
        running.handle!.release()
        expect(running.documentListeners.size).toBe(0)
        expect(running.timers).toHaveLength(0)

        const skipped = runPolicy('app-login', { bootstrap: true, iosStandalone: true, readyState: 'loading' })
        skipped.handle?.abort()
        expect(skipped.documentListeners.size).toBe(0)
        expect(skipped.handle?.state).toBe('done')
        expect(skipped.timers).toHaveLength(1) // only the exit fade
    })

    it('tells us once why an installed-app intro ended and how far its start-up got', () => {
        const launch = runPolicy('app-login', { media: STANDALONE })
        expect(launch.plays).toBe(true)
        launch.handle!.mark('effect')
        launch.handle!.mark('effect') // only the first time counts
        launch.timers[0]() // the start watchdog fires before the animation started
        expect(launch.beacons).toHaveLength(1)
        expect(launch.beacons[0].url).toBe(INTRO_TELEMETRY_PATH)
        const report = JSON.parse(launch.beacons[0].body)
        expect(report).toMatchObject({ s: 'app-login', reason: 'watchdog', forced: false })
        expect(report.d).toBeLessThan(report.dcl)
        expect(report.dcl).toBeLessThan(report.effect)
        expect(report.effect).toBeLessThan(report.end)
        launch.handle!.report('error', 'late')
        expect(launch.beacons).toHaveLength(1)

        const tapped = runPolicy('app-login', { media: STANDALONE })
        tapped.handle!.abort(true, 'interaction')
        expect(JSON.parse(tapped.beacons[0].body).reason).toBe('interaction')
    })

    it('never reports the landing intro, which every visitor sees', () => {
        const landing = runPolicy('landing')
        landing.timers[0]()
        landing.handle!.report('complete')
        expect(landing.beacons).toHaveLength(0)
    })

    it('removes the stage if the animation has not started in time, or on an early interaction', () => {
        const slow = runPolicy('landing')
        slow.timers[0]() // start watchdog fires while still pending
        expect(slow.handle?.state).toBe('done')
        expect(slow.attrs.has(INTRO_LEAVING_ATTRIBUTE)).toBe(true)
        slow.timers[1]() // the short fade completes
        expect(slow.attrs.has(INTRO_ATTRIBUTE)).toBe(false)
        expect(slow.attrs.has(INTRO_LEAVING_ATTRIBUTE)).toBe(false)
        expect(slow.listeners.size).toBe(0)
    })
})

describe('device startup preference storage', () => {
    it('has a first-launch-only default and stores explicit choices without changing completion history', () => {
        const values = new Map<string, string>([[STARTUP_INTRO_SEEN_KEY, '1']])
        const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
        expect(readStartupIntroPreference(storage)).toBe('first-launch')
        for (const value of ['always', 'never', 'first-launch'] as const) {
            expect(saveStartupIntroPreference(storage, value)).toBe(true)
            expect(readStartupIntroPreference(storage)).toBe(value)
            expect(values.get(STARTUP_INTRO_SEEN_KEY)).toBe('1')
        }
        values.set(STARTUP_INTRO_PREFERENCE_KEY, 'invalid')
        expect(readStartupIntroPreference(storage)).toBe('first-launch')
    })

    it('reports storage failures instead of pretending a preference was saved', () => {
        const storage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('quota') } }
        expect(readStartupIntroPreference(storage)).toBeNull()
        expect(saveStartupIntroPreference(storage, 'never')).toBe(false)
    })
})

describe('woven intro integration contracts', () => {
    it('places the app startup policy in the root head and avoids a competing body transition', () => {
        const layout = read('app/layout.tsx')
        expect(layout.indexOf('<head>')).toBeLessThan(layout.indexOf('<AppIntroPrePaintScript />'))
        expect(layout.indexOf('<AppIntroPrePaintScript />')).toBeLessThan(layout.indexOf('<body'))
        expect(read('app/globals.css')).not.toContain('body.app-ready')
        expect(read('app/manifest.ts')).toContain("background_color: '#000000'")
    })

    it('keeps the stage hidden unless the pre-paint script chose to play it', () => {
        const css = read('app/globals.css')
        expect(css).toMatch(/\.weavly-intro,\s*\.weavly-intro-skip\s*\{\s*display:\s*none;/)
        expect(css).toContain('html[data-weavly-intro="landing"] .weavly-intro[data-surface="landing"]')
        expect(css).toContain('html[data-weavly-intro="app-login"] .weavly-intro[data-surface="app-login"]')
        expect(css).toContain('html[data-weavly-intro] .landing-scroll')
    })

    it('decides before the landing content and keeps the fixed header out of the page plane', () => {
        const page = read('app/page.tsx')
        const script = page.indexOf('<IntroPrePaintScript surface="landing" />')
        const intro = page.indexOf('<WeavingIntro surface="landing" />')
        const header = page.indexOf('<LandingHeader />')
        const plane = page.indexOf('data-weavly-intro-page')
        expect(script).toBeGreaterThan(-1)
        expect(script).toBeLessThan(intro)
        expect(intro).toBeLessThan(header)
        expect(header).toBeLessThan(plane)
        expect(page.indexOf('<LandingHero />')).toBeGreaterThan(plane)
    })

    it('marks the real logos the intro lands on', () => {
        expect(read('components/landing/header.tsx')).toContain('data-weavly-intro-panel')
        expect(read('components/landing/header.tsx')).toContain('data-weavly-intro-target="landing"')
        expect(read('components/auth/auth-layout.tsx')).toContain('data-weavly-intro-target="app-login"')
        const login = read('app/(auth)/login/page.tsx')
        expect(login.indexOf('<IntroPrePaintScript surface="app-login" />')).toBeLessThan(login.indexOf('<LoginForm'))
    })

    it('keeps Safari from focusing a sign-in field (and opening its password popover) until the user does', () => {
        const form = read('app/(auth)/login/login-form.tsx')
        // Safari's streamlined login skips forms whose credential fields have a
        // negative tabIndex; read-only fields are still focused.
        expect(form.match(/tabIndex=\{credentialsArmed \? undefined : -1\}/g)).toHaveLength(2)
        expect(form.match(/onFocus=\{armCredentials\}/g)).toHaveLength(2)
        expect(form).not.toMatch(/readOnly=\{/)
        // keyboard users get the fields back in the tab order on their first Tab
        expect(form).toContain("window.addEventListener('keydown', armOnTab, true)")
        expect(form).toContain('field.tabIndex = 0')
    })

    it('marks each start-up step and reports every way the installed intro can end', () => {
        const runtime = read('components/intro/weaving-intro-runtime.ts')
        for (const step of ['init', 'images', 'gl', 'started', 'frame1']) expect(runtime, step).toContain(`handle.mark?.('${step}')`)
        for (const reason of ['complete', 'skip', 'degrade', 'context_lost', 'pagehide', 'unmount']) {
            expect(runtime, reason).toContain(`handle.report?.('${reason}'`)
        }
        // A failure carries its message, so a broken shader or a missing logo is told apart from slowness.
        expect(runtime).toContain("handle.report?.('error', error instanceof Error ? error.message : String(error))")
        const component = read('components/intro/weaving-intro.tsx')
        expect(component).toContain("handle.mark?.('effect')")
        expect(component).toContain("handle.mark?.('runtime')")
        expect(component).toContain("handle.report?.('runtime_failed')")
    })

    it('loads the WebGL runtime lazily and always restores the page when it ends', () => {
        expect(read('components/intro/weaving-intro.tsx')).toContain("import('./weaving-intro-runtime')")
        const runtime = read('components/intro/weaving-intro-runtime.ts')
        expect(runtime).toContain('root.removeAttribute(INTRO_ATTRIBUTE)')
        expect(runtime).toContain("loseContext()")
        expect(runtime).toContain("listen('pagehide'")
        // the handoff clone is layout-positioned so it renders exactly like the real logo
        expect(runtime).toMatch(/cloneBox\.style\.left = /)
        expect(runtime).not.toMatch(/cloneBox\.style\.transform/)
    })

    it('translates the Skip control', () => {
        const legacy = read('lib/i18n/legacy.ts')
        expect(legacy).toContain('"Skip intro": "इंट्रो छोड़ें"')
        expect(legacy).toContain('"Skip intro": "ઇન્ટ્રો છોડો"')
    })

    it('prefetches the runtime chunk early and paints the iOS bottom strip from the stage colour', () => {
        expect(read('components/intro/weaving-intro.tsx')).toContain('const pending =')
        const runtime = read('components/intro/weaving-intro-runtime.ts')
        expect(runtime).toContain('paintRoot(stripColor(')
        expect(runtime).toContain("paintRoot('')")
        expect(runtime).toContain("body.style.transition = color ? 'none' : ''")
        expect(read('app/globals.css')).not.toContain('--weavly-intro-h')
        expect(read('lib/intro/intro-policy.ts')).not.toContain('--weavly-intro-h')
    })
})
