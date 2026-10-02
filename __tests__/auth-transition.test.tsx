import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthTransition } from '@/components/auth/auth-transition'
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
import { en } from '@/lib/i18n/locales/en'
import { gu } from '@/lib/i18n/locales/gu'
import { hi } from '@/lib/i18n/locales/hi'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

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
        expect(spool).toContain('wv-spool-wraps')
        expect(spool).toContain('wv-spool-twist')
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

    it('covers sign-in, account creation and both log out buttons, without holding navigation', () => {
        const login = read('app/(auth)/login/login-form.tsx')
        expect(login).toContain('open={loading || isRedirecting}')
        expect(login).toContain('mode="sign-in"')
        expect(login).toContain("stage={isRedirecting ? 'done' : 'working'}")
        // The success path still navigates immediately; nothing waits on the animation.
        expect(login.indexOf('setIsRedirecting(true)')).toBeLessThan(login.indexOf('window.location.replace(result.redirectTo)'))
        expect(login).not.toMatch(/setTimeout\([^)]*location/)

        expect(read('app/(auth)/signup/page.tsx')).toContain('<AuthTransition open={loading} mode="sign-up" />')

        const logout = read('components/auth/logout-button.tsx')
        expect(logout.match(/<AuthTransition open=\{isLoggingOut\} mode="sign-out" \/>/g)).toHaveLength(2)
        expect(logout).not.toContain('LoadingModal')
    })

    it('portals to the body so a transformed sidebar or sheet cannot clip it', () => {
        const source = read('components/auth/auth-transition.tsx')
        expect(source).toContain('createPortal(')
        expect(source).toContain('document.body')
        expect(source).toContain('role="status"')
    })
})
