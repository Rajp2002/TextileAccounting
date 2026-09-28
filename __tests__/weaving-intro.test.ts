import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildIntroPrePaintScript, INTRO_ATTRIBUTE, INTRO_LEAVING_ATTRIBUTE } from '../lib/intro/intro-policy'
import { containedImageRect, inkRect, parseObjectPosition } from '../lib/intro/target-geometry'
import { BINDING, buildWeaveMask, FIGURE, LOGO_INK_BOX, LOGO_SOURCE } from '../lib/intro/weave-mask'
import {
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
    search?: string
    hash?: string
    referrer?: string
    media?: string[]
    webgl2?: boolean
    saveData?: boolean
    navType?: string
    iosStandalone?: boolean
}

function runPolicy(surface: IntroSurface, env: PolicyEnv = {}) {
    const attrs = new Map<string, string>()
    const storageTouched: string[] = []
    const listeners = new Set<string>()
    const timers: Array<() => void> = []
    const win: Record<string, unknown> = {
        matchMedia: (query: string) => ({ matches: (env.media ?? []).includes(query) }),
        localStorage: {
            getItem: (k: string) => { storageTouched.push(k); return null },
            setItem: (k: string) => { storageTouched.push(k) },
        },
        performance: { getEntriesByType: () => (env.navType ? [{ type: env.navType }] : []) },
        addEventListener: (type: string) => listeners.add(type),
        removeEventListener: (type: string) => listeners.delete(type),
    }
    if (env.webgl2 !== false) win.WebGL2RenderingContext = function WebGL2RenderingContext() {}
    const context = vm.createContext({
        window: win,
        document: {
            documentElement: {
                setAttribute: (k: string, v: string) => attrs.set(k, v),
                removeAttribute: (k: string) => attrs.delete(k),
            },
            referrer: env.referrer ?? '',
            createElement: () => ({}),
            head: { appendChild: () => undefined },
        },
        location: { search: env.search ?? '', hash: env.hash ?? '', origin: 'https://weavly.example' },
        navigator: { connection: env.saveData ? { saveData: true } : undefined, standalone: env.iosStandalone },
        setTimeout: (fn: () => void) => { timers.push(fn); return timers.length },
        clearTimeout: () => undefined,
    })
    vm.runInContext(buildIntroPrePaintScript(surface), context)
    const handle = win.__weavlyIntro as { state: string; abort: () => void } | undefined
    return { attrs, storageTouched, listeners, timers, handle, plays: attrs.get(INTRO_ATTRIBUTE) === surface }
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

    it('plays on every launch of the installed app, but not in a browser tab or after moving inside the app', () => {
        expect(runPolicy('app-login').plays).toBe(false)
        expect(runPolicy('app-login', { media: STANDALONE }).plays).toBe(true)
        expect(runPolicy('app-login', { media: STANDALONE, navType: 'reload' }).plays).toBe(true)
        expect(runPolicy('app-login', { iosStandalone: true }).plays).toBe(true)
        expect(runPolicy('app-login', { media: STANDALONE, referrer: 'https://weavly.example/owner/estimator' }).plays).toBe(false)
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

describe('woven intro integration contracts', () => {
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
})
