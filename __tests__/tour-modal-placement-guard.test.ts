import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { placeTourPanel } from '@/lib/tours/placement'

/**
 * RULE: a guided tour never moves or resizes an app modal where the tour card fits beside it.
 *
 * The same bug kept returning in a new tour each time (Estimator steps 8-9, Saved Costings steps 2-6, the editor
 * previews): a hand-written CSS rule pinned the modal into a permanent "reading column" at every desktop width, so
 * on a wide screen it sat far left of where it normally opens and ran under the sidebar. The card is the thing that
 * adapts. The placer (lib/tours/placement.ts) puts it right of the modal, else left of it, even over the sidebar.
 *
 * There is exactly one rule that may move a dialog, the generic `[data-tour-surface]` rule in globals.css, which
 * gives way by the least amount only when the card fits on neither side. This file evaluates that rule's real CSS
 * for every regular dialog geometry in the app, and fails any other rule that moves a tour modal, including rules
 * added for tours that do not exist yet.
 */

const CARD = 360
const GAP = 16
const MARGIN = 16
const ROOT = 14 // app/globals.css: html { font-size: 14px }
const PHONE_MAX_WIDTH = 767.98

const TOUR_MODAL_SELECTOR = /data-[a-z-]*tour-(?:preview|dialog)|data-tour-surface|data-configuration-picker-preview|mobile-live-estimate-panel/
const GENERIC_SELECTOR = /^\[data-tour-surface="true"\]\[data-slot="dialog-content"\](?:\[data-costing-tour-dialog="true"\])?$/
// Bottom sheet that is full width in regular use (a card cannot sit beside it), and the Live cost sheet, which moves by
// a clamp() that only leaves centre when it must and has its own numeric test (estimator-tour-live-sheet-centering).
const EXEMPT_SELECTOR = /data-configuration-picker-preview|mobile-live-estimate-panel/
const POSITIONAL = /(?:^|[;\s{])(?:left|right|top|bottom|inset(?:-[a-z]+)*|width|min-width|max-width|translate|transform|margin(?:-[a-z]+)*|--tw-translate-[xy]|--tour-preview-translate|--tour-cx)\s*:/

type Rule = { selector: string; body: string; media: string[] }

function parseCss(css: string): Rule[] {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const rules: Rule[] = []
    const walk = (text: string, media: string[]) => {
        let index = 0
        while (index < text.length) {
            const open = text.indexOf('{', index)
            if (open < 0) break
            const prelude = text.slice(index, open).split(';').pop()!.trim()
            let depth = 1
            let close = open + 1
            while (close < text.length && depth) { if (text[close] === '{') depth++; else if (text[close] === '}') depth--; close++ }
            const body = text.slice(open + 1, close - 1)
            if (prelude.startsWith('@media')) walk(body, [...media, prelude.slice(6).trim()])
            else if (prelude.startsWith('@layer') || prelude.startsWith('@supports')) walk(body, media)
            else if (!prelude.startsWith('@') && prelude) rules.push({ selector: prelude, body, media })
            index = close
        }
    }
    walk(source, [])
    return rules
}

/** Widest viewport a rule applies to on a non-phone device. -Infinity when it is phone or touch-landscape only. */
function desktopUpperBound(media: string[]): number {
    let bound = Infinity
    for (const condition of media) {
        const level = Math.max(...condition.split(',').map(branch => {
            if (/pointer:\s*coarse/.test(branch)) return -Infinity
            const max = branch.match(/max-width:\s*([\d.]+)px/)
            return max ? (Number(max[1]) <= PHONE_MAX_WIDTH ? -Infinity : Number(max[1])) : Infinity
        }))
        bound = Math.min(bound, level)
    }
    return bound
}

const repositionsTourModal = (rule: Rule) => TOUR_MODAL_SELECTOR.test(rule.selector) && POSITIONAL.test(rule.body)

function declaration(rule: Rule, property: string): string {
    const match = rule.body.match(new RegExp(`(?:^|[;\\s{])${property.replace(/-/g, '\\-')}:\\s*([^;]+?)\\s*(?:!important)?\\s*(?:;|$)`))
    expect(match, `${rule.selector} declares ${property}`).not.toBeNull()
    return match![1]
}

/** Evaluates the CSS math subset the rule uses (calc, min, max, clamp, px, rem, vw, %, var). `%` is of the dialog's own width. */
function evaluate(expression: string, vars: Record<string, string>, vw: number, ownWidth: number): number {
    let source = expression
    for (let pass = 0; pass < 6 && /var\(/.test(source); pass++) source = source.replace(/var\((--[\w-]+)\)/g, (_, name: string) => `(${vars[name] ?? 'NaN'})`)
    const js = source
        .replace(/calc\(/g, '(').replace(/\bmin\(/g, 'Math.min(').replace(/\bmax\(/g, 'Math.max(').replace(/\bclamp\(/g, 'clampCss(')
        .replace(/(-?[\d.]+)vw\b/g, (_, n: string) => `(${n} * VW / 100)`)
        .replace(/(-?[\d.]+)rem\b/g, (_, n: string) => `(${n} * ${ROOT})`)
        .replace(/(-?[\d.]+)px\b/g, '$1')
        .replace(/(-?[\d.]+)%/g, (_, n: string) => `(${n} * OWN / 100)`)
    return new Function('VW', 'OWN', 'clampCss', `return ${js}`)(vw, ownWidth, (min: number, value: number, max: number) => Math.max(min, Math.min(value, max)))
}

function walkFiles(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) walkFiles(full, found)
        else if (full.endsWith('.tsx')) found.push(full)
    }
    return found
}

describe('Tour modal placement rule: the modal stays where it opens, the card adapts', () => {
    const globals = readFileSync('app/globals.css', 'utf8')
    const rules = parseCss(globals).filter(repositionsTourModal)
    const desktopRules = rules.filter(rule => desktopUpperBound(rule.media) !== -Infinity)

    it('finds the tour modal rules it is meant to police (the parser is not silently matching nothing)', () => {
        const selectors = rules.map(rule => rule.selector).join('\n')
        expect(selectors).toMatch(/data-tour-surface/)
        expect(selectors).toMatch(/data-configuration-picker-preview/)
    })

    it('allows only the generic tour-surface rule to move a dialog on a desktop or tablet', () => {
        const offenders = desktopRules.filter(rule => !EXEMPT_SELECTOR.test(rule.selector) && !GENERIC_SELECTOR.test(rule.selector)).map(rule => rule.selector)
        expect(offenders, 'a per-tour rule moves a modal; use tourSurfaceProps so the generic rule covers it').toEqual([])
    })

    it('does not reposition a tour modal from any other style block in the app', () => {
        const offenders: string[] = []
        for (const file of [...walkFiles('components'), ...walkFiles('app')]) {
            const source = readFileSync(file, 'utf8')
            if (!/tour/i.test(source)) continue
            for (const [, block] of source.matchAll(/<style>\{([\s\S]*?)\}<\/style>/g)) {
                for (const rule of parseCss(block.replace(/^[`'"]|[`'"]$/g, '')).filter(repositionsTourModal)) {
                    if (!EXEMPT_SELECTOR.test(rule.selector)) offenders.push(`${file}: ${rule.selector}`)
                }
            }
        }
        expect(offenders).toEqual([])
    })

    describe('the generic rule, evaluated for every regular dialog in the app', () => {
        const generic = desktopRules.find(rule => rule.selector === '[data-tour-surface="true"][data-slot="dialog-content"]')!
        const sidebarAware = desktopRules.find(rule => rule.selector.includes('data-costing-tour-dialog'))!
        const base = (name: string) => declaration(generic, name)
        const vars = { '--tour-cx': base('--tour-cx') }

        // Regular geometry of each dialog, cross-checked against the dialogs themselves below.
        const dialogs = [
            { name: 'editor / confirm (sm:max-w-lg)', maxWidth: 32 * ROOT, centre: (vw: number) => vw / 2, gutter: 16, vars },
            { name: 'Worker review (sm:max-w-3xl)', maxWidth: 48 * ROOT, centre: (vw: number) => vw / 2, gutter: 16, vars },
            { name: 'Saved Costings comparison (sm:max-w-4xl)', maxWidth: 56 * ROOT, centre: (vw: number) => vw / 2, gutter: 16, vars },
            { name: 'Saved Costings export (sm:max-w-6xl)', maxWidth: 72 * ROOT, centre: (vw: number) => vw / 2, gutter: 16, vars },
            {
                name: 'Saved Costings library (1180px, beside the sidebar)', maxWidth: 1180, gutter: 32,
                centre: (vw: number) => vw / 2 + Math.max(0, Math.min((vw - 1212) / 2, 124)),
                vars: { '--tour-cx': declaration(sidebarAware, '--tour-cx') },
            },
        ]
        const widths = [768, 900, 1024, 1152, 1280, 1366, 1440, 1536, 1600, 1716, 1792, 1920, 2200, 2560]

        function geometry(dialog: typeof dialogs[number], vw: number) {
            const regularWidth = Math.min(dialog.maxWidth, vw - dialog.gutter)
            const regularCentre = dialog.centre(vw)
            const width = Math.min(dialog.maxWidth, vw - dialog.gutter, evaluate(base('width'), dialog.vars, vw, 0))
            // The rule's translate includes the regular -50%; what moves the dialog is the rest of it.
            const shift = evaluate(base('--tw-translate-x'), dialog.vars, vw, width) + width / 2
            const left = regularCentre - width / 2 + shift
            return { regular: { left: regularCentre - regularWidth / 2, right: regularCentre + regularWidth / 2 }, tour: { left, right: left + width } }
        }
        const fitsBeside = ({ left, right }: { left: number; right: number }, vw: number) =>
            right + GAP + CARD + MARGIN <= vw + 0.01 || left - GAP - CARD >= MARGIN - 0.01

        it.each(dialogs.map(dialog => [dialog.name, dialog] as const))('%s: always on screen with the card beside it, from 768px up', (_name, dialog) => {
            for (const vw of widths) {
                const { tour } = geometry(dialog, vw)
                expect(tour.left, `${dialog.name} at ${vw}px runs off the left edge`).toBeGreaterThanOrEqual(MARGIN - 0.01)
                expect(tour.right, `${dialog.name} at ${vw}px runs off the right edge`).toBeLessThanOrEqual(vw + 0.01)
                expect(fitsBeside(tour, vw), `${dialog.name} at ${vw}px leaves no room for the tour card`).toBe(true)
            }
        })

        it.each(dialogs.map(dialog => [dialog.name, dialog] as const))('%s: exactly where it opens whenever the card already fits beside it', (_name, dialog) => {
            let regularFits = 0
            for (const vw of widths) {
                const { regular, tour } = geometry(dialog, vw)
                if (!fitsBeside(regular, vw)) continue
                regularFits++
                expect(tour.left, `${dialog.name} at ${vw}px was moved although the card fits beside it`).toBeCloseTo(regular.left, 1)
                expect(tour.right, `${dialog.name} at ${vw}px was resized although the card fits beside it`).toBeCloseTo(regular.right, 1)
            }
            expect(regularFits, 'the dialog should keep its regular place on at least the widest screens').toBeGreaterThanOrEqual(3)
        })

        it.each(dialogs.map(dialog => [dialog.name, dialog] as const))('%s: the real placer docks the card beside the dialog, never on it', (_name, dialog) => {
            for (const vw of widths) {
                const { tour } = geometry(dialog, vw)
                const height = 900
                const context = { left: tour.left, right: tour.right, top: 16, bottom: height - 16, width: tour.right - tour.left, height: height - 32 }
                const target = { left: tour.left + 24, right: tour.right - 24, top: 300, bottom: 420, width: context.width - 48, height: 120 }
                const placement = placeTourPanel({ target, context, panel: { width: CARD, height: 280 }, viewport: { width: vw, height } })
                expect(['right', 'left'], `${dialog.name} at ${vw}px: card ${placement.side}`).toContain(placement.side)
                expect(placement.left < tour.right && placement.left + CARD > tour.left, `${dialog.name} at ${vw}px: card lands on the dialog`).toBe(false)
            }
        })

        it('keeps the Saved Costings centre in step with the page it mirrors', () => {
            expect(readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')).toContain("left: 'calc(50% + clamp(0px, calc((100vw - 1212px) / 2), 124px))'")
            expect(declaration(sidebarAware, '--tour-cx')).toContain('clamp(0px, calc((100vw - 1212px) / 2), 124px)')
        })

        it('reads the regular dialog widths from the dialogs themselves', () => {
            expect(readFileSync('components/ui/dialog.tsx', 'utf8')).toContain('sm:max-w-lg')
            expect(readFileSync('components/estimator/CostingExportDialog.tsx', 'utf8')).toContain('sm:max-w-6xl')
            const quotes = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')
            expect(quotes).toContain('className="sm:max-w-4xl"')
            expect(quotes).toContain('sm:max-w-[1180px]')
            expect(globals).toMatch(/font-size: 14px;/)
        })
    })
})
