import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthTransition } from '@/components/auth/auth-transition'
import { AUTH_TRANSITION_LEAVE_MS, AUTH_TRANSITION_ROUND_MS } from '@/components/auth/auth-transition-timing'
import {
    AUTH_HANDOFF_HOST_TAG,
    AUTH_HANDOFF_STORAGE_KEY,
    buildAuthHandoffScript,
    captureAuthHandoff,
} from '@/components/auth/auth-handoff'
import { LoomMark, SpoolMark } from '@/components/auth/thread-marks'
import {
    clothRows,
    LOOM_FELL,
    LOOM_HALO,
    LOOM_PASS,
    LOOM_PICKS,
    LOOM_ROW,
    LOOM_SHUTTLE_WIDTH,
    LOOM_VIEWBOX,
    LOOM_WARPS,
    LOOM_WEFT_END,
    LOOM_WEFT_START,
    LOOM_WEFT_WIDTH,
    warpsOver,
} from '@/components/auth/loom-geometry'
import {
    SPOOL_BARREL_RX,
    SPOOL_BARREL_RY,
    SPOOL_BOTTOM_Y,
    SPOOL_CX,
    SPOOL_HOLES,
    SPOOL_LAY_CUT_REACH,
    SPOOL_LAY_Y,
    SPOOL_VIEW_SIZE,
    SPOOL_WRAP_SPACING,
    SPOOL_WRAP_WIDTH,
    spoolLayFrames,
    woundWraps,
} from '@/components/auth/spool-geometry'
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
        const units = (n: number) => `calc(100% * ${n} / ${LOOM_VIEWBOX})`
        expect(css).toContain(`98%, 100% { transform: translateY(${units(2 * LOOM_ROW)}); }`)
        expect(css).toContain(`48%, 84% { transform: translateY(${units(LOOM_ROW)});`)
        expect(css).toContain(`30%, 50% { transform: translateX(${units(LOOM_PASS)});`)
    })

    it('lays each pick behind the shuttle: a bar slides its own width into a clip shaped like the finished pick', () => {
        const css = read('app/globals.css')
        // The bars move with the shuttle's timing, so their leading edge travels with it.
        expect(keyframes(css, 'wv-loom-there')).toContain('0% { transform: translateX(-100%); animation-timing-function: cubic-bezier(0.55, 0, 0.3, 1); }')
        expect(keyframes(css, 'wv-loom-there')).toContain('30%, 100% { transform: translateX(0); }')
        expect(keyframes(css, 'wv-loom-back')).toContain('0%, 50% { transform: translateX(100%); animation-timing-function: cubic-bezier(0.55, 0, 0.3, 1); }')
        expect(keyframes(css, 'wv-loom-back')).toContain('80%, 100% { transform: translateX(0); }')
        expect(keyframes(css, 'wv-loom-shuttle')).toContain('0% { transform: translateX(0); animation-timing-function: cubic-bezier(0.55, 0, 0.3, 1); }')
        // The return pick waits, unwoven, outside its clip.
        expect(css).toContain('.wv-loom-pass-back {\n    transform: translateX(100%);')

        // A bar of thickness t travels the pick plus t, so its round front runs at most t/2 ahead
        // of or behind the shuttle's centre: always under the shuttle, never a square end in view.
        for (const thickness of [LOOM_WEFT_WIDTH + 2 * LOOM_HALO, LOOM_WEFT_WIDTH]) {
            for (let progress = 0; progress <= 1; progress += 0.05) {
                const front = LOOM_WEFT_END + thickness / 2 - (LOOM_PASS + thickness) * (1 - progress)
                const shuttle = LOOM_WEFT_START + LOOM_PASS * progress
                expect(Math.abs(front - shuttle)).toBeLessThan(LOOM_SHUTTLE_WIDTH / 2)
            }
        }
        const loom = renderToStaticMarkup(<LoomMark />)
        const clips = [...loom.matchAll(/class="wv-loom-pass" style="([^"]*)"/g)].map((match) => match[1])
        expect(clips).toHaveLength(4)
        const percent = (n: number) => `${+((n / LOOM_VIEWBOX) * 100).toFixed(4)}%`
        for (const pick of LOOM_PICKS) {
            const halo = LOOM_WEFT_WIDTH + 2 * LOOM_HALO
            expect(clips).toContain(`left:${percent(LOOM_WEFT_START - halo / 2)};top:${percent(pick.y - halo / 2)};width:${percent(LOOM_PASS + halo)};height:${percent(halo)}`)
        }
    })

    it('holds both marks still under reduced motion', () => {
        const css = read('app/globals.css')
        const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.wv-loom-run {\n      transform')))
        expect(reduced).toContain('.wv-loom *')
        expect(reduced).toContain('.wv-spool *')
        expect(reduced).toContain('.auth-transition-mark')
        expect(reduced).toContain('animation: none !important')
    })

    it('renders decorative, hidden-from-assistive-tech marks', () => {
        const loom = renderToStaticMarkup(<LoomMark />)
        expect(loom.startsWith('<div class="wv-loom" aria-hidden="true">')).toBe(true)
        // A halo bar and a weft bar for each pick.
        expect(loom.match(/wv-loom-pass-there/g)).toHaveLength(2)
        expect(loom.match(/wv-loom-pass-back/g)).toHaveLength(2)
        expect(loom).toContain('wv-loom-run')
        expect(loom).toContain('wv-loom-beat')
        expect(loom).toContain('wv-loom-cloth')

        const spool = renderToStaticMarkup(<SpoolMark />)
        expect(spool.startsWith('<div class="wv-spool" aria-hidden="true">')).toBe(true)
        expect(spool).toContain('wv-spool-stack')
        expect(spool).toContain('wv-spool-lay-cut')
        expect(spool).toContain('wv-spool-spin')
        expect(spool).toContain('wv-spool-lead')
    })
})

describe('auth transition spool', () => {
    it('loops seamlessly: one step down puts the new wrap where the wound wraps begin', () => {
        expect(woundWraps()[0]).toBe(SPOOL_LAY_Y + SPOOL_WRAP_SPACING)
        expect(read('app/globals.css')).toContain(`85%, 100% { transform: translateY(calc(100% * ${SPOOL_WRAP_SPACING} / ${SPOOL_VIEW_SIZE})); }`)
    })

    it('lays the new wrap with a cut that rides the thread\'s end, square to the thread', () => {
        const frames = spoolLayFrames()
        const right = SPOOL_CX + SPOOL_BARREL_RX
        const left = SPOOL_CX - SPOOL_BARREL_RX
        // Starts at the right end with nothing laid, ends at the left end with the wrap laid,
        // within the first half of the wind like the dash it replaces.
        expect(frames[0]).toMatchObject({ offset: 0, turn: 0 })
        expect(frames[0].x).toBeCloseTo(right, 9)
        expect(frames[0].y).toBeCloseTo(SPOOL_LAY_Y, 9)
        expect(frames.at(-1)).toMatchObject({ offset: 50, turn: 180 })
        expect(frames.at(-1)!.x).toBeCloseTo(left, 9)
        expect(frames.at(-1)!.y).toBeCloseTo(SPOOL_LAY_Y, 9)
        // Sampled densely enough that straight lines between samples stay on the curve.
        expect(frames.length).toBeGreaterThanOrEqual(17)

        frames.forEach((frame, index) => {
            const dx = (frame.x - SPOOL_CX) / SPOOL_BARREL_RX
            const dy = (frame.y - SPOOL_LAY_Y) / SPOOL_BARREL_RY
            // On the front half of the wrap's ellipse...
            expect(dx * dx + dy * dy, `frame ${index}`).toBeCloseTo(1, 9)
            expect(frame.y).toBeGreaterThanOrEqual(SPOOL_LAY_Y - 1e-9)
            // ...with the cut's edge along the ellipse's normal there, i.e. square to the thread.
            const normal = [(frame.x - SPOOL_CX) / SPOOL_BARREL_RX ** 2, (frame.y - SPOOL_LAY_Y) / SPOOL_BARREL_RY ** 2]
            const edge = [Math.cos((frame.turn * Math.PI) / 180), Math.sin((frame.turn * Math.PI) / 180)]
            expect(edge[0] * normal[1] - edge[1] * normal[0], `frame ${index}`).toBeCloseTo(0, 9)
            if (index > 0) {
                const previous = frames[index - 1]
                expect(frame.offset).toBeGreaterThan(previous.offset)
                expect(frame.x).toBeLessThan(previous.x)
                expect(frame.turn).toBeGreaterThan(previous.turn)
            }
        })

        // globals.css carries these frames; regenerate the blocks below if the geometry changes.
        const css = read('app/globals.css')
        for (const block of spoolLayKeyframes(frames)) {
            expect(css, `app/globals.css must contain:\n${block}`).toContain(block)
        }
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

describe('auth transition marks keep moving while the page behind them is busy', () => {
    // Loading and hydrating the next page keeps the main thread busy for a few hundred ms mid-round.
    // Browsers can animate transform and opacity of HTML elements without it; anything else (stroke
    // dashes, SVG parts in Safari) waits for the main thread and freezes.
    const css = read('app/globals.css')
    const markKeyframes = [...css.matchAll(/@keyframes (wv-(?:loom|spool)-[\w-]+) \{/g)].map((match) => match[1])
    const animatedClasses = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((rule) => /\banimation:\s*wv-/.test(rule[2]))
        .flatMap((rule) => [...rule[1].matchAll(/\.(wv-[\w-]+)/g)].map((match) => match[1]))

    it('animates only transform and opacity', () => {
        expect(markKeyframes.length).toBeGreaterThanOrEqual(12)
        for (const name of markKeyframes) {
            const properties = new Set([...keyframes(css, name).matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]))
            properties.delete('animation-timing-function')
            expect([...properties].filter((p) => p !== 'transform' && p !== 'opacity'), name).toEqual([])
        }
    })

    it('puts every moving part on an HTML layer, never on a part of an SVG drawing', () => {
        const markup = renderToStaticMarkup(<><LoomMark /><SpoolMark /></>)
        expect(animatedClasses.length).toBeGreaterThanOrEqual(12)
        for (const name of animatedClasses) {
            const tags = [...markup.matchAll(/<([a-zA-Z]+)\b[^>]*\bclass="([^"]*)"/g)]
                .filter((match) => match[2].split(/\s+/).includes(name))
                .map((match) => match[1])
            expect(tags.length, `.${name} is used`).toBeGreaterThan(0)
            expect(new Set(tags), `.${name}`).toEqual(new Set(['div']))
        }
    })

    it('always shows exactly one or two twist phases, so the incoming thread never loses its twist', () => {
        const markup = renderToStaticMarkup(<SpoolMark />)
        const phases = [...markup.matchAll(/class="wv-mark-layer wv-spool-twist-phase" style="animation-delay:(-?[\d.]+)ms"[^]*?stroke-dashoffset="([\d.]+)"/g)]
            .map((match) => ({ delay: Number(match[1]), dashOffset: Number(match[2]) }))
        expect(phases).toHaveLength(8)
        const cycle = AUTH_TRANSITION_ROUND_MS / 8
        const opacityAt = opacityCurve(keyframes(css, 'wv-spool-twist'))
        const opacity = (phase: { delay: number }, time: number) =>
            opacityAt(((((time - phase.delay) % cycle) + cycle) % cycle) / cycle * 100)
        // Browsers may put a frame that lands on a phase's loop point at the end of one loop or the
        // start of the next, so a phase only counts if it shows just before and just after.
        const shown = (phase: { delay: number }, time: number) =>
            opacity(phase, time - 0.01) > 0.5 && opacity(phase, time + 0.01) > 0.5
        // Every quarter millisecond, including the exact moments one phase hands over to the next.
        for (let time = 0; time <= 2 * cycle; time += 0.25) {
            const count = phases.filter((phase) => shown(phase, time)).length
            expect(count, `t=${time}ms`).toBeGreaterThanOrEqual(1)
            expect(count, `t=${time}ms`).toBeLessThanOrEqual(2)
        }
        // In time order the dashes step along the thread towards the spool, one period per cycle.
        const ordered = [...phases].sort((a, b) => ((a.delay % cycle) + cycle) % cycle - ((b.delay % cycle) + cycle) % cycle)
        ordered.forEach((phase, index) => expect(phase.dashOffset).toBeCloseTo((3 * index) / 8, 9))
    })

    it('still fits through the handoff to the next page', () => {
        for (const [mode, mark] of [['sign-in', <LoomMark key="loom" className="h-full w-full" />], ['sign-out', <SpoolMark key="spool" className="h-full w-full" />]] as const) {
            const html = `<div class="auth-transition" data-state="open" data-stage="done" data-mode="${mode}"><div class="auth-transition-mark">${renderToStaticMarkup(mark)}</div><div role="status" aria-live="polite" aria-atomic="true" class="auth-transition-copy"><div class="ui-content-swap"><p class="text-base font-semibold text-ink">Signed in</p><p class="mt-1 text-sm text-muted-foreground">Opening your workspace…</p></div></div></div>`
            const writes = new Map<string, string>()
            const storage = {
                getItem: (key: string) => writes.get(key) ?? null,
                setItem: (key: string, value: string) => void writes.set(key, value),
                removeItem: (key: string) => void writes.delete(key),
            }
            expect(captureAuthHandoff(1_000, { overlay: { outerHTML: html } as Element, now: 1_300, epoch: 50_000, reducedMotion: false, storage }), mode).toBe(true)
            const { inserted, template } = resumeOnNewPage({ stored: writes.get(AUTH_HANDOFF_STORAGE_KEY)!, now: 50_000 })
            expect(inserted, mode).toHaveLength(1)
            expect(template.html).toBe(html)
        }
    })
})

/** One `@keyframes` block from the stylesheet, braces balanced. */
function keyframes(css: string, name: string): string {
    const start = css.indexOf(`@keyframes ${name} {`)
    if (start < 0) return ''
    let depth = 0
    for (let index = css.indexOf('{', start); index < css.length; index++) {
        if (css[index] === '{') depth++
        if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1)
    }
    return ''
}

/** Opacity of a linear-timed keyframes block at a progress in percent. */
function opacityCurve(block: string) {
    const points = [...block.matchAll(/([\d.%, ]+)\{\s*opacity:\s*([\d.]+);\s*\}/g)].flatMap((match) =>
        match[1].split(',').map((offset) => [Number.parseFloat(offset), Number(match[2])] as const))
    points.sort((a, b) => a[0] - b[0])
    return (progress: number) => {
        const after = points.findIndex(([offset]) => offset >= progress)
        if (after <= 0) return points[Math.max(after, 0)][1]
        const [o1, v1] = points[after - 1]
        const [o2, v2] = points[after]
        return o2 === o1 ? v2 : v1 + ((v2 - v1) * (progress - o1)) / (o2 - o1)
    }
}

/** The CSS for the spool's lay, as globals.css must carry it, built from the sampled frames. */
function spoolLayKeyframes(frames: ReturnType<typeof spoolLayFrames>): string[] {
    const n = (value: number, digits = 3) => `${+value.toFixed(digits)}`
    const at = (offset: number) => (offset === 50 ? '50%, 100%' : `${n(offset, 4)}%`)
    const reach = SPOOL_LAY_CUT_REACH
    const block = (name: string, frame: (f: (typeof frames)[number]) => string) =>
        `  @keyframes ${name} {\n${frames.map((f) => `    ${at(f.offset)} { transform: ${frame(f)}; }`).join('\n')}\n  }`
    return [
        block('wv-spool-lay-cut', (f) =>
            `translate(${n(((f.x - SPOOL_CX) / (2 * reach)) * 100)}%, ${n(((f.y - SPOOL_LAY_Y) / reach) * 100)}%) rotate(${n(f.turn, 2)}deg)`),
        block('wv-spool-lay-uncut', (f) =>
            `rotate(${n(-f.turn, 2)}deg) translate(${n((-(f.x - SPOOL_CX) / SPOOL_VIEW_SIZE) * 100)}%, ${n((-(f.y - SPOOL_LAY_Y) / SPOOL_VIEW_SIZE) * 100)}%)`),
        block('wv-spool-lay-end', (f) =>
            `translate(${n(((f.x - (SPOOL_CX + SPOOL_BARREL_RX)) / SPOOL_WRAP_WIDTH) * 100)}%, ${n(((f.y - SPOOL_LAY_Y) / SPOOL_WRAP_WIDTH) * 100)}%)`),
    ]
}


describe('auth transition round', () => {
    it('matches the CSS round, with the spool turns dividing it evenly', () => {
        const css = read('app/globals.css')
        expect(css).toContain(`--auth-round: ${AUTH_TRANSITION_ROUND_MS / 1000}s;`)
        expect(css.match(/var\(--auth-round\) infinite/g)?.length).toBeGreaterThanOrEqual(5)
        // Two winds per round; the spin, the lay and the step share the wind's period.
        expect(css).toContain('wv-spool-take-up calc(var(--auth-round) / 2) infinite')
        expect(css).toContain('wv-spool-lay-cut calc(var(--auth-round) / 2) linear infinite')
        expect(css).toContain('wv-spool-lay-uncut calc(var(--auth-round) / 2) linear infinite')
        expect(css).toContain('wv-spool-lay-end calc(var(--auth-round) / 2) linear infinite')
        expect(css).toContain('wv-spool-spin calc(var(--auth-round) / 2) linear infinite')
        expect(css).toContain('wv-spool-twist calc(var(--auth-round) / 8) linear infinite')
        expect(css).toContain('wv-spool-sway var(--auth-round) ease-in-out infinite')
    })
})


const OVERLAY_HTML = '<div class="auth-transition" data-state="open" data-stage="done" data-mode="sign-in"><div class="auth-transition-mark"></div></div>'

/** Runs the pre-paint script the way a freshly loaded page would, against stand-ins for the browser. */
function resumeOnNewPage({ stored, now }: { stored: string | null; now: number }) {
    const data = new Map<string, string>(stored === null ? [] : [[AUTH_HANDOFF_STORAGE_KEY, stored]])
    const timers: Array<{ run: () => void; ms: number }> = []
    const infinite = { currentTime: 0, finish: vi.fn(), effect: { getComputedTiming: () => ({ iterations: Infinity }) } }
    const finite = { currentTime: 0, finish: vi.fn(), effect: { getComputedTiming: () => ({ iterations: 1 }) } }
    const overlay = {
        attributes: {} as Record<string, string>,
        setAttribute(name: string, value: string) { this.attributes[name] = value },
        getAnimations: vi.fn(() => [infinite, finite]),
        remove: vi.fn(),
    }
    const inserted: unknown[] = []
    const host = {
        tag: '',
        style: {} as Record<string, string>,
        children: [] as unknown[],
        appendChild(node: unknown) { this.children.push(node) },
        remove: vi.fn(),
    }
    const template = {
        content: { firstElementChild: overlay as unknown },
        set innerHTML(html: string) { this.html = html },
        html: '',
    }
    const fakeDocument = {
        body: { firstChild: { id: 'first' }, insertBefore: (node: unknown, before: unknown) => inserted.push([node, before]) },
        createElement: (tag: string) => {
            if (tag === 'template') return template
            host.tag = tag
            return host
        },
    }
    const fakeWindow = {
        sessionStorage: {
            getItem: (key: string) => data.get(key) ?? null,
            removeItem: (key: string) => void data.delete(key),
        },
    }
    new Function('window', 'document', 'Date', 'setTimeout', buildAuthHandoffScript())(
        fakeWindow,
        fakeDocument,
        { now: () => now },
        (run: () => void, ms: number) => void timers.push({ run, ms }),
    )
    return { data, timers, overlay, inserted, infinite, finite, template, host }
}

describe('auth transition handoff', () => {
    it('keeps the round going on the next page, from the frame the old page was on', () => {
        const startedAt = 10_000
        const stored = JSON.stringify({ html: OVERLAY_HTML, startedAt })
        const { inserted, overlay, infinite, finite, timers, data, template, host } = resumeOnNewPage({ stored, now: startedAt + 700 })

        expect(template.html).toBe(OVERLAY_HTML)
        // Inside a tag React does not know, so hydrating the page's own <div>s never claims it.
        expect(host.tag).toBe(AUTH_HANDOFF_HOST_TAG)
        expect(host.style.display).toBe('contents')
        expect(host.children).toEqual([overlay])
        expect(inserted).toHaveLength(1)
        expect(inserted[0]).toEqual([host, { id: 'first' }])
        expect(overlay.attributes['data-resumed']).toBe('')
        // The loops carry on from where they were; one-time entrances are already over.
        expect(infinite.currentTime).toBe(700)
        expect(finite.finish).toHaveBeenCalledTimes(1)
        expect(infinite.finish).not.toHaveBeenCalled()

        // It closes exactly when the round ends, then leaves the page and the storage clean.
        expect(timers).toHaveLength(1)
        expect(timers[0].ms).toBe(AUTH_TRANSITION_ROUND_MS - 700)
        timers[0].run()
        expect(overlay.attributes['data-state']).toBe('closed')
        expect(timers).toHaveLength(2)
        expect(timers[1].ms).toBe(AUTH_TRANSITION_LEAVE_MS)
        timers[1].run()
        expect(host.remove).toHaveBeenCalledTimes(1)
        expect(data.has(AUTH_HANDOFF_STORAGE_KEY)).toBe(false)
    })

    it('does nothing on an ordinary page load', () => {
        const { inserted, timers } = resumeOnNewPage({ stored: null, now: 5_000 })
        expect(inserted).toHaveLength(0)
        expect(timers).toHaveLength(0)
    })

    it('does not show a round that has already ended, or one from the future, and clears it', () => {
        for (const startedAt of [10_000 - AUTH_TRANSITION_ROUND_MS - 5_000, 10_000 - AUTH_TRANSITION_ROUND_MS + 60, 10_000 + 5_000]) {
            const { inserted, timers, data } = resumeOnNewPage({
                stored: JSON.stringify({ html: OVERLAY_HTML, startedAt }),
                now: 10_000,
            })
            expect(inserted, `startedAt ${startedAt}`).toHaveLength(0)
            expect(timers).toHaveLength(0)
            expect(data.has(AUTH_HANDOFF_STORAGE_KEY)).toBe(false)
        }
    })

    it('only ever rebuilds the overlay it wrote itself', () => {
        const bad = [
            '{not json',
            'null',
            JSON.stringify({ html: 42, startedAt: 9_900 }),
            JSON.stringify({ html: OVERLAY_HTML, startedAt: 'now' }),
            JSON.stringify({ html: '<div class="other">x</div>', startedAt: 9_900 }),
            JSON.stringify({ html: OVERLAY_HTML.replace('</div></div>', '<script>alert(1)</script></div></div>'), startedAt: 9_900 }),
            JSON.stringify({ html: OVERLAY_HTML.replace('<div class="auth-transition-mark">', '<img src=x onerror=alert(1)><div class="auth-transition-mark">'), startedAt: 9_900 }),
            JSON.stringify({ html: OVERLAY_HTML + 'x'.repeat(50_000), startedAt: 9_900 }),
        ]
        for (const stored of bad) {
            const { inserted, timers } = resumeOnNewPage({ stored, now: 10_000 })
            expect(inserted, stored.slice(0, 40)).toHaveLength(0)
            expect(timers).toHaveLength(0)
        }
    })

    it('captures the overlay the page is showing, with when the round began', () => {
        const writes = new Map<string, string>()
        const storage = {
            getItem: (key: string) => writes.get(key) ?? null,
            setItem: (key: string, value: string) => void writes.set(key, value),
            removeItem: (key: string) => void writes.delete(key),
        }
        const overlay = { outerHTML: OVERLAY_HTML }

        // Clicked at performance time 1_000, now 1_650 ms later, on the epoch clock at 50_000.
        expect(captureAuthHandoff(1_000, { overlay: overlay as Element, now: 1_650, epoch: 50_000, reducedMotion: false, storage })).toBe(true)
        expect(JSON.parse(writes.get(AUTH_HANDOFF_STORAGE_KEY)!)).toEqual({ html: OVERLAY_HTML, startedAt: 50_000 - 650 })
    })

    it('has nothing to carry over when motion is reduced, the round is over, or nothing is showing', () => {
        const writes = new Map<string, string>([[AUTH_HANDOFF_STORAGE_KEY, 'stale']])
        const storage = {
            getItem: (key: string) => writes.get(key) ?? null,
            setItem: (key: string, value: string) => void writes.set(key, value),
            removeItem: (key: string) => void writes.delete(key),
        }
        const overlay = { outerHTML: OVERLAY_HTML } as Element
        const base = { overlay, now: 1_100, epoch: 50_000, reducedMotion: false, storage }

        expect(captureAuthHandoff(1_000, { ...base, reducedMotion: true })).toBe(false)
        expect(writes.has(AUTH_HANDOFF_STORAGE_KEY)).toBe(false)
        expect(captureAuthHandoff(1_000, { ...base, now: 1_000 + AUTH_TRANSITION_ROUND_MS })).toBe(false)
        expect(captureAuthHandoff(1_000, { ...base, overlay: null })).toBe(false)
        expect(writes.has(AUTH_HANDOFF_STORAGE_KEY)).toBe(false)

        const blocked = { getItem: () => null, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
        expect(() => captureAuthHandoff(1_000, { ...base, storage: blocked })).not.toThrow()
        expect(() => captureAuthHandoff(1_000, { ...base, storage: null })).not.toThrow()
    })

    it('leaves with the same fade the overlay uses everywhere', () => {
        expect(read('app/globals.css')).toContain(`animation: auth-transition-leave ${AUTH_TRANSITION_LEAVE_MS}ms ease-in forwards;`)
    })

    it('runs before anything paints, on every page', () => {
        const layout = read('app/layout.tsx')
        expect(layout).toContain('<AuthHandoffScript />')
        expect(layout.indexOf('<AuthHandoffScript />')).toBeLessThan(layout.indexOf('<Providers>'))
        const script = read('components/auth/auth-handoff-script.tsx')
        expect(script).toContain('dangerouslySetInnerHTML')
        expect(script).not.toContain("'use client'")
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

    it('opens the workspace the moment the session exists and hands the loom to it', () => {
        const login = read('app/(auth)/login/login-form.tsx')
        const success = login.slice(login.indexOf('flushSync(() => setIsRedirecting(true))'))
        expect(login.indexOf("if (result && 'error' in result)")).toBeLessThan(login.indexOf('flushSync(() => setIsRedirecting(true))'))
        // The copy has changed to "signed in" before the overlay is captured, and nothing waits for the round.
        expect(success.indexOf('captureAuthHandoff(transitionStartedAt)'))
            .toBeLessThan(success.indexOf('window.location.replace(result.redirectTo)'))
        const handler = login.slice(login.indexOf('const handleLogin'), login.indexOf('return (\n        <AuthLayout'))
        expect(login).not.toContain('holdForTransitionRound')
        expect(handler).not.toContain('setTimeout')
    })

    it('ends the session at once on log out and hands the spool to /login', () => {
        const logout = read('components/auth/logout-button.tsx')
        const flow = logout.slice(logout.indexOf('const signOutBehindTransition'), logout.indexOf('const handleLogout'))
        expect(flow).toContain("method: 'POST'")
        expect(flow).toContain('body: new FormData(form)')
        expect(flow).toContain("redirect: 'manual'")
        expect(flow).toContain("signedOut = response.type === 'opaqueredirect'")
        // Only once the session has ended, and without waiting for the round.
        expect(flow.indexOf('captureAuthHandoff(transitionStartedAt)')).toBeGreaterThan(flow.indexOf('await fetch(form.action'))
        expect(flow.indexOf('captureAuthHandoff(transitionStartedAt)')).toBeLessThan(flow.indexOf("window.location.replace('/login')"))
        expect(logout).not.toContain('holdForTransitionRound')
        expect(flow).not.toContain('setTimeout')
        // Anything unexpected falls back to the native form post.
        expect(flow.lastIndexOf('formRef.current?.submit()')).toBeGreaterThan(flow.indexOf("window.location.replace('/login')"))
    })

    it('hides the workspace hydrating behind a handed-over sign-in, and leaves log out as it was', () => {
        const css = read('app/globals.css')
        const start = css.indexOf('.auth-transition[data-resumed][data-mode="sign-in"] {')
        expect(start).toBeGreaterThan(-1)
        const rule = css.slice(start, css.indexOf('}', start))
        // Solid canvas, no per-frame backdrop blur over a page that keeps changing, and an
        // opacity fade that does not wait for the main thread.
        expect(rule).toContain('background: var(--wv-bg-canvas);')
        expect(rule).toContain('backdrop-filter: none;')
        expect(rule).toContain('will-change: opacity;')
        // Log out lands on the light /login page, so it keeps the see-through, blurred look.
        expect(css).not.toContain('[data-mode="sign-out"] {\n    background: var(--wv-bg-canvas)')
    })

    it('keeps toasts from covering the handoff, on the page it leaves and the one it lands on', () => {
        const css = read('app/globals.css')
        expect(css).toContain('body:has(> .auth-transition[data-state="open"]) [data-sonner-toaster]')
        expect(css).toContain(`body:has(> ${AUTH_HANDOFF_HOST_TAG} > .auth-transition[data-state="open"]) [data-sonner-toaster]`)
    })

    it('portals to the body so a transformed sidebar or sheet cannot clip it', () => {
        const source = read('components/auth/auth-transition.tsx')
        expect(source).toContain('createPortal(')
        expect(source).toContain('document.body')
        expect(source).toContain('role="status"')
    })
})
