import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { placeTourPanel } from '@/lib/tours/placement'

// Steps 8 and 9 open the Live cost sheet. Its normal desktop position is centred in the viewport
// (`md:inset-x-0 md:mx-auto`). The tour runtime used to pin it to `left: 16px` at every width from 768px,
// which on a wide screen dragged it across the sidebar to the far left. It must stay centred whenever the
// 360px tour card still fits beside it, and only slide left by the amount needed to make room.
const runtime = readFileSync('components/estimator/CostEstimateTourRuntime.tsx', 'utf8')

// app/globals.css sets html { font-size: 14px }, so 38rem is 532px, not 608px.
const ROOT_FONT_PX = 14
const PANEL = { width: 360, height: 280 }
const GAP = 16
const MARGIN = 16

function mediaBlock(query: string): string {
    const start = runtime.indexOf(`@media ${query} {`)
    expect(start, `runtime declares @media ${query}`).toBeGreaterThanOrEqual(0)
    let depth = 0
    for (let index = runtime.indexOf('{', start); index < runtime.length; index++) {
        if (runtime[index] === '{') depth++
        if (runtime[index] === '}' && --depth === 0) return runtime.slice(start, index + 1)
    }
    throw new Error('unbalanced media block')
}

function declaration(block: string, property: string): string {
    const match = block.match(new RegExp(`(?:^|[\\s;{])${property}:\\s*([^;]+?)\\s*(?:!important)?\\s*;`))
    expect(match, `sheet rule declares ${property}`).not.toBeNull()
    return match![1]
}

/** Evaluates the small CSS math subset the sheet rule uses (calc, min, max, clamp, px, rem, vw, one var). */
function evaluate(expression: string, vars: Record<string, string>, viewportWidth: number): number {
    let source = expression
    for (let pass = 0; pass < 5 && /var\(/.test(source); pass++) {
        source = source.replace(/var\((--[\w-]+)\)/g, (_, name: string) => `(${vars[name] ?? 'NaN'})`)
    }
    const js = source
        .replace(/calc\(/g, '(').replace(/\bmin\(/g, 'Math.min(').replace(/\bmax\(/g, 'Math.max(')
        .replace(/\bclamp\(/g, 'clampCss(')
        .replace(/(-?[\d.]+)vw\b/g, (_, n: string) => `(${n} * vw / 100)`)
        .replace(/(-?[\d.]+)rem\b/g, (_, n: string) => `(${n} * ROOT_FONT_PX)`)
        .replace(/(-?[\d.]+)px\b/g, '$1')
    return new Function('vw', 'ROOT_FONT_PX', 'clampCss', `return ${js}`)(viewportWidth, ROOT_FONT_PX, (min: number, value: number, max: number) => Math.max(min, Math.min(value, max)))
}

function sheetGeometry(viewportWidth: number) {
    const block = mediaBlock('(min-width: 768px)')
    const vars: Record<string, string> = {}
    for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+?);/g)) vars[name] = value
    const width = evaluate(declaration(block, 'width'), vars, viewportWidth)
    const left = evaluate(declaration(block, 'left'), vars, viewportWidth)
    return { left, width, right: left + width }
}

// 1024px and wider: the tablet column rule (768-1023px) has its own test and overrides this one.
const WIDTHS = [1024, 1152, 1280, 1316, 1366, 1440, 1536, 1728, 1920, 2200, 2560]

describe('Estimator tour, Live cost sheet position at steps 8 and 9', () => {
    it('no longer pins the sheet to a fixed 16px left edge on desktop', () => {
        const block = mediaBlock('(min-width: 768px)')
        expect(declaration(block, 'left')).not.toBe('16px')
    })

    it.each(WIDTHS)('keeps the tour card clear of the sheet at %ipx wide', viewportWidth => {
        const sheet = sheetGeometry(viewportWidth)
        expect(sheet.left).toBeGreaterThanOrEqual(MARGIN)
        expect(sheet.right + GAP + PANEL.width + MARGIN).toBeLessThanOrEqual(viewportWidth + 0.5)
    })

    it.each(WIDTHS.filter(width => width >= 1316))('leaves the sheet exactly where the regular modal opens at %ipx wide', viewportWidth => {
        const sheet = sheetGeometry(viewportWidth)
        expect(sheet.left + sheet.width / 2).toBeCloseTo(viewportWidth / 2, 1)
    })

    it.each(WIDTHS)('lets the real placer dock the tour card to the right of the sheet at %ipx wide', viewportWidth => {
        const sheet = sheetGeometry(viewportWidth)
        const viewportHeight = 900
        const context = { left: sheet.left, right: sheet.right, top: 24, bottom: viewportHeight - 24, width: sheet.width, height: viewportHeight - 48 }
        const metrics = { left: sheet.left + 20, right: sheet.right - 20, top: 230, bottom: 380, width: sheet.width - 40, height: 150 }
        const placement = placeTourPanel({ target: metrics, context, panel: PANEL, viewport: { width: viewportWidth, height: viewportHeight } })
        expect(placement.side).toBe('right')
        expect(placement.left).toBeGreaterThanOrEqual(sheet.right)
    })

    it('stays tour-owned and leaves the tablet column rule as the later override', () => {
        expect(runtime).toMatch(/<style>\{`[\s\S]*#mobile-live-estimate-panel[\s\S]*`\}<\/style>/)
        expect(runtime.indexOf('@media (min-width: 768px) and (max-width: 1023.98px) {')).toBeGreaterThan(runtime.indexOf('@media (min-width: 768px) {'))
        expect(readFileSync('app/globals.css', 'utf8')).not.toMatch(/#mobile-live-estimate-panel/)
    })
})
