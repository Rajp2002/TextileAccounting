import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthTransition } from '@/components/auth/auth-transition'
import {
    AUTH_TRANSITION_ROUND_MS,
    DEFAULT_PAGE_LOAD_MS,
    expectedPageLoadMs,
    holdForTransitionRound,
    markAuthNavigation,
    rememberPageLoadMs,
    takeAuthNavigationMark,
    transitionHoldMs,
} from '@/components/auth/auth-transition-timing'
import { LoomMark, SpoolMark } from '@/components/auth/thread-marks'
import {
    clothRows,
    LOOM_FELL,
    LOOM_HALO,
    LOOM_PASS,
    LOOM_PICKS,
    LOOM_ROW,
    LOOM_WARPS,
    LOOM_WEFT_END,
    LOOM_WEFT_START,
    LOOM_WEFT_WIDTH,
    warpsOver,
} from '@/components/auth/loom-geometry'
import { SPOOL_BOTTOM_Y, SPOOL_HOLES, SPOOL_LAY_Y, SPOOL_WRAP_SPACING, woundWraps } from '@/components/auth/spool-geometry'
import { en } from '@/lib/i18n/locales/en'
import { gu } from '@/lib/i18n/locales/gu'
import { hi } from '@/lib/i18n/locales/hi'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function fakeStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key),
    }
}

describe('auth transition loom', () => {
    it('loops seamlessly: after the two-row take-up each pick lands on cloth of the same parity', () => {
        const rows = clothRows()
        for (const pick of LOOM_PICKS) {
            const landed = rows.find((row) => row.y === pick.y + 2 * LOOM_ROW)
            expect(landed, `pick ${pick.direction}`).toBeDefined()
            expect(landed?.parity).toBe(pick.parity)
        }
        // The return pick is laid after one row of take-up, so it is laid at the fell too.
        expect(LOOM_PICKS.find((pick) => pick.direction === 'back')!.y + LOOM_ROW).toBe(LOOM_FELL)
    })

    it('weaves a true plain weave: rows alternate and every warp floats on alternate picks', () => {
        const rows = clothRows()
        rows.forEach((row, index) => {
            if (index > 0) expect(row.parity).not.toBe(rows[index - 1].parity)
        })
        const over = [...warpsOver(0), ...warpsOver(1)].sort((a, b) => a - b)
        expect(over).toEqual([...LOOM_WARPS])
        expect(warpsOver(0).some((x) => warpsOver(1).includes(x))).toBe(false)
    })

    it('keeps crossings from colliding and the pick wider than the warp sheet', () => {
        // A warp float spans one row; the next pick's gap must start beyond it.
        expect(LOOM_ROW / 2).toBeLessThanOrEqual(LOOM_ROW - (LOOM_WEFT_WIDTH / 2 + LOOM_HALO))
        expect(LOOM_WEFT_START).toBeLessThan(Math.min(...LOOM_WARPS))
        expect(LOOM_WEFT_END).toBeGreaterThan(Math.max(...LOOM_WARPS))
    })

    it('matches the CSS keyframe distances to the geometry', () => {
        const css = read('app/globals.css')
        expect(css).toContain(`98%, 100% { transform: translateY(${2 * LOOM_ROW}px); }`)
        expect(css).toContain(`48%, 84% { transform: translateY(${LOOM_ROW}px);`)
        expect(css).toContain(`30%, 50% { transform: translateX(${LOOM_PASS}px);`)
        expect(css).toContain(`.wv-loom-pass-back { stroke-dashoffset: ${LOOM_PASS}; }`)
        expect(css).toContain(`stroke-dashoffset: ${LOOM_PASS}; animation-timing-function`)
    })

    it('holds both marks still under reduced motion', () => {
        const css = read('app/globals.css')
        const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.wv-loom-shuttle {\n      transform')))
        expect(reduced).toContain('.wv-loom *')
        expect(reduced).toContain('.wv-spool *')
        expect(reduced).toContain('.auth-transition-mark')
        expect(reduced).toContain('animation: none !important')
    })

    it('renders decorative, hidden-from-assistive-tech marks', () => {
        const loom = renderToStaticMarkup(<LoomMark />)
        expect(loom).toContain('aria-hidden="true"')
        expect(loom.match(/wv-loom-pass-there/g)).toHaveLength(2)
        expect(loom.match(/wv-loom-pass-back/g)).toHaveLength(2)
        expect(loom).toContain(`stroke-dasharray="${LOOM_PASS} ${LOOM_PASS + 2}"`)
        expect(loom).toContain('wv-loom-shuttle')
        expect(loom).toContain('wv-loom-reed')

        const spool = renderToStaticMarkup(<SpoolMark />)
        expect(spool).toContain('aria-hidden="true"')
        expect(spool.match(/wv-spool-lay/g)).toHaveLength(2)
        expect(spool).toContain('wv-spool-stack')
        expect(spool).toContain('wv-spool-spin')
        expect(spool).toContain('wv-spool-twist')
    })
})

describe('auth transition spool', () => {
    it('loops seamlessly: one step down puts the new wrap where the wound wraps begin', () => {
        expect(woundWraps()[0]).toBe(SPOOL_LAY_Y + SPOOL_WRAP_SPACING)
        expect(read('app/globals.css')).toContain(`85%, 100% { transform: translateY(${SPOOL_WRAP_SPACING}px); }`)
    })

    it('keeps the barrel wound to the bottom flange through the step', () => {
        // The stack only moves down, so it is shortest before the step.
        expect(woundWraps().at(-1)!).toBeGreaterThanOrEqual(SPOOL_BOTTOM_Y)
    })

    it('turns the flange holes onto an identical frame every wind', () => {
        const step = 360 / SPOOL_HOLES.length
        SPOOL_HOLES.forEach((angle, index) => expect(angle).toBe(index * step))
    })
})

describe('auth transition round', () => {
    it('holds only for what is left of one round', () => {
        expect(transitionHoldMs(1000, 1000, false)).toBe(AUTH_TRANSITION_ROUND_MS)
        expect(transitionHoldMs(1000, 1500, false)).toBe(AUTH_TRANSITION_ROUND_MS - 500)
        expect(transitionHoldMs(1000, 1000 + AUTH_TRANSITION_ROUND_MS + 900, false)).toBe(0)
        expect(transitionHoldMs(1000, 1000, true)).toBe(0)
    })

    it('resolves at once when the request already outlasted a round', async () => {
        await expect(holdForTransitionRound(performance.now() - AUTH_TRANSITION_ROUND_MS - 1)).resolves.toBe(0)
    })

    it('matches the CSS round, with the spool turns dividing it evenly', () => {
        const css = read('app/globals.css')
        expect(css).toContain(`--auth-round: ${AUTH_TRANSITION_ROUND_MS / 1000}s;`)
        expect(css.match(/var\(--auth-round\) infinite/g)?.length).toBeGreaterThanOrEqual(5)
        // Two winds per round; the spin, the lay and the step share the wind's period.
        expect(css).toContain('wv-spool-take-up calc(var(--auth-round) / 2) infinite')
        expect(css).toContain('wv-spool-lay calc(var(--auth-round) / 2) infinite')
        expect(css).toContain('wv-spool-spin calc(var(--auth-round) / 2) linear infinite')
        expect(css).toContain('wv-spool-reel calc(var(--auth-round) / 8) linear infinite')
        expect(css).toContain('wv-spool-sway var(--auth-round) ease-in-out infinite')
    })
})

describe('auth transition landing', () => {
    it('starts the page change one page load before the round ends', () => {
        expect(transitionHoldMs(1000, 1000, false, 600)).toBe(AUTH_TRANSITION_ROUND_MS - 600)
        expect(transitionHoldMs(1000, 1500, false, 600)).toBe(AUTH_TRANSITION_ROUND_MS - 600 - 500)
        expect(transitionHoldMs(1000, 1000 + AUTH_TRANSITION_ROUND_MS, false, 600)).toBe(0)
        expect(transitionHoldMs(1000, 1000, false, AUTH_TRANSITION_ROUND_MS + 400)).toBe(0)
        expect(transitionHoldMs(1000, 1000, true, 600)).toBe(0)
    })

    it('shows the next page the moment the round ends, and never later than the request allows', () => {
        for (const sessionReadyAt of [150, 600, 1200, 1700, 3000]) {
            for (const pageLoad of [200, 400, 800, 1200]) {
                const hold = transitionHoldMs(0, sessionReadyAt, false, pageLoad)
                const nextPageShownAt = sessionReadyAt + hold + pageLoad
                // No idle tail after the round: only a slow session or page load pushes it later.
                expect(nextPageShownAt).toBe(Math.max(sessionReadyAt + pageLoad, AUTH_TRANSITION_ROUND_MS))
            }
        }
    })

    it('expects a typical page load until this device has measured its own', () => {
        expect(expectedPageLoadMs('sign-in', fakeStorage())).toBe(DEFAULT_PAGE_LOAD_MS['sign-in'])
        expect(expectedPageLoadMs('sign-out', fakeStorage())).toBe(DEFAULT_PAGE_LOAD_MS['sign-out'])
        // Without a browser (server render, tests) it is the typical figure too.
        expect(expectedPageLoadMs('sign-in')).toBe(DEFAULT_PAGE_LOAD_MS['sign-in'])
        expect(expectedPageLoadMs('sign-in', fakeStorage({ 'weavly:auth-page-load-ms': 'not json' })))
            .toBe(DEFAULT_PAGE_LOAD_MS['sign-in'])
    })

    it('learns each destination apart and settles between measurements', () => {
        const storage = fakeStorage()
        rememberPageLoadMs('sign-in', 500, storage)
        expect(expectedPageLoadMs('sign-in', storage)).toBe(500)
        expect(expectedPageLoadMs('sign-out', storage)).toBe(DEFAULT_PAGE_LOAD_MS['sign-out'])

        rememberPageLoadMs('sign-in', 700, storage)
        expect(expectedPageLoadMs('sign-in', storage)).toBe(600)
    })

    it('keeps one cold start or a broken reading from shrinking the round', () => {
        const storage = fakeStorage()
        rememberPageLoadMs('sign-in', 60_000, storage)
        expect(expectedPageLoadMs('sign-in', storage)).toBeLessThanOrEqual(AUTH_TRANSITION_ROUND_MS - 100)

        const untouched = fakeStorage()
        rememberPageLoadMs('sign-out', Number.NaN, untouched)
        rememberPageLoadMs('sign-out', -5, untouched)
        expect(expectedPageLoadMs('sign-out', untouched)).toBeGreaterThan(0)

        const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
        expect(() => rememberPageLoadMs('sign-in', 400, blocked)).not.toThrow()
        expect(expectedPageLoadMs('sign-in', blocked)).toBe(DEFAULT_PAGE_LOAD_MS['sign-in'])
    })

    it('hands the navigation kind to the page it lands on, once, and only while fresh', () => {
        const storage = fakeStorage()
        markAuthNavigation('sign-out', 1_000, storage)
        expect(takeAuthNavigationMark(2_000, storage)).toBe('sign-out')
        expect(takeAuthNavigationMark(2_000, storage)).toBeNull()

        markAuthNavigation('sign-in', 1_000, storage)
        expect(takeAuthNavigationMark(1_000 + 60_000, storage)).toBeNull()

        storage.setItem('weavly:auth-navigation', JSON.stringify({ kind: 'sign-up', at: 1_000 }))
        expect(takeAuthNavigationMark(1_500, storage)).toBeNull()
    })
})

describe('auth transition overlay', () => {
    it('renders nothing on the server, so it is safe in server HTML', () => {
        expect(renderToStaticMarkup(<AuthTransition open mode="sign-in" />)).toBe('')
        expect(renderToStaticMarkup(<AuthTransition open={false} mode="sign-out" />)).toBe('')
    })

    it('has every line in English, Hindi and Gujarati', () => {
        const source = read('components/auth/auth-transition.tsx')
        const keys = [...source.matchAll(/'auth\.transition\.(\w+)'/g)].map((match) => match[1])
        expect(keys.length).toBeGreaterThanOrEqual(8)
        for (const locale of [en, hi, gu]) {
            const transition = locale.auth.transition as Record<string, string>
            expect(Object.keys(transition).sort()).toEqual(Object.keys(en.auth.transition).sort())
            for (const key of keys) expect(transition[key], key).toMatch(/\S/)
        }
    })

    it('covers sign-in, account creation and both log out buttons', () => {
        const login = read('app/(auth)/login/login-form.tsx')
        expect(login).toContain('open={loading || isRedirecting}')
        expect(login).toContain('mode="sign-in"')
        expect(login).toContain("stage={isRedirecting ? 'done' : 'working'}")

        expect(read('app/(auth)/signup/page.tsx')).toContain('<AuthTransition open={loading} mode="sign-up" />')

        const logout = read('components/auth/logout-button.tsx')
        expect(logout.match(/<AuthTransition open=\{isLoggingOut\} mode="sign-out" \/>/g)).toHaveLength(2)
        expect(logout).not.toContain('LoadingModal')
    })

    it('lets sign-in finish one loom round only after the session exists', () => {
        const login = read('app/(auth)/login/login-form.tsx')
        const success = login.slice(login.indexOf('setIsRedirecting(true)'))
        expect(login.indexOf("if (result && 'error' in result)")).toBeLessThan(login.indexOf('setIsRedirecting(true)'))
        // The page change starts one measured page load before the round ends.
        expect(success.indexOf("await holdForTransitionRound(transitionStartedAt, expectedPageLoadMs('sign-in'))"))
            .toBeLessThan(success.indexOf('window.location.replace(result.redirectTo)'))
        expect(success.indexOf("markAuthNavigation('sign-in')"))
            .toBeLessThan(success.indexOf('window.location.replace(result.redirectTo)'))
        expect(success).toContain('transitionHoldMs,')
    })

    it('ends the session at once on log out and only holds the page change', () => {
        const logout = read('components/auth/logout-button.tsx')
        const flow = logout.slice(logout.indexOf('const signOutBehindTransition'), logout.indexOf('const handleLogout'))
        // The round starts counting before the request, and the request is not delayed by it.
        expect(flow.indexOf("holdForTransitionRound(transitionStartedAt, expectedPageLoadMs('sign-out'))"))
            .toBeLessThan(flow.indexOf('await fetch(form.action'))
        expect(flow).toContain("method: 'POST'")
        expect(flow).toContain('body: new FormData(form)')
        expect(flow).toContain("redirect: 'manual'")
        expect(flow).toContain("signedOut = response.type === 'opaqueredirect'")
        expect(flow.indexOf('await roundFinished')).toBeGreaterThan(flow.indexOf('await fetch(form.action'))
        expect(flow.indexOf('await roundFinished')).toBeLessThan(flow.indexOf("window.location.replace('/login')"))
        expect(flow.indexOf("markAuthNavigation('sign-out')")).toBeLessThan(flow.indexOf("window.location.replace('/login')"))
        // Anything unexpected falls back to the native form post.
        expect(flow.lastIndexOf('formRef.current?.submit()')).toBeGreaterThan(flow.indexOf("window.location.replace('/login')"))
    })

    it('reports the hold apart from route timing', () => {
        const reporter = read('components/telemetry/sign-in-timing-reporter.tsx')
        expect(reporter).toContain('const navigationStartedAt = trace.actionCompletedAt + transitionHoldMs')
        expect(reporter).toContain('dashboardReadyMs: observedAt - navigationStartedAt')
        expect(read('app/api/telemetry/sign-in/route.ts')).toContain('transition_hold_ms: sanitizeTimingMs(body.transitionHoldMs)')
    })

    it('measures how long the page it lands on takes to paint, on every page', () => {
        const layout = read('app/layout.tsx')
        expect(layout).toContain('<AuthPageLoadRecorder />')
        const recorder = read('components/auth/auth-page-load-recorder.tsx')
        expect(recorder).toContain('first-contentful-paint')
        expect(recorder).toContain('rememberPageLoadMs(')
        expect(recorder).toContain('takeAuthNavigationMark(')
    })

    it('keeps toasts from covering the handoff', () => {
        expect(read('app/globals.css'))
            .toContain('body:has(> .auth-transition[data-state="open"]) [data-sonner-toaster]')
    })

    it('portals to the body so a transformed sidebar or sheet cannot clip it', () => {
        const source = read('components/auth/auth-transition.tsx')
        expect(source).toContain('createPortal(')
        expect(source).toContain('document.body')
        expect(source).toContain('role="status"')
    })
})
