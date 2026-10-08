import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const globals = read('app/globals.css')
const mobile = read('app/mobile.css')

/** Every `@media (prefers-reduced-motion: reduce)` block in a stylesheet, concatenated. */
function reducedMotionCss(css: string): string {
    const blocks: string[] = []
    let index = css.indexOf('prefers-reduced-motion: reduce')
    while (index !== -1) {
        const open = css.indexOf('{', index)
        let depth = 0
        let end = open
        for (; end < css.length; end++) {
            if (css[end] === '{') depth++
            if (css[end] === '}' && --depth === 0) break
        }
        blocks.push(css.slice(open, end + 1))
        index = css.indexOf('prefers-reduced-motion: reduce', end)
    }
    return blocks.join('\n')
}

describe('quiet motion system tokens', () => {
    it('defines one shared tempo for product motion', () => {
        for (const token of ['--motion-fast: 120ms', '--motion-base: 180ms', '--motion-slow: 280ms', '--ease-out-soft:', '--ease-sheet:']) {
            expect(globals).toContain(token)
        }
    })

    it('never leaves entry animations holding a transform or opacity after they finish', () => {
        // `both` keeps the last keyframe in effect forever, which turns a page or tab
        // panel into a permanent containing block for its fixed rails.
        expect(globals).not.toMatch(/animation:\s*ui-(route-enter|content-swap)[^;]*\bboth\b/)
        expect(globals).toMatch(/\.ui-route-enter\s*\{\s*animation: ui-route-enter[^;]*backwards;/)
    })
})

describe('page arrivals', () => {
    it('settles every owner and Free page in from the shared main container', () => {
        expect(globals).toMatch(/\.dashboard-main > \*\s*\{\s*animation: ui-page-settle var\(--motion-base\)[^;]*backwards;/)
        // A page that also opts into ui-route-enter must not fade twice.
        expect(globals).toMatch(/\.dashboard-main > \* \.ui-route-enter\s*\{\s*animation: none;/)
        expect(read('app/free/FreeWorkspace.tsx')).toContain('dashboard-main')
        expect(read('app/(dashboard)/owner/layout.tsx')).toContain('dashboard-main')
        expect(reducedMotionCss(globals)).toContain('.dashboard-main > *')
    })
})

describe('expandable panels', () => {
    const panels = [
        'app/(dashboard)/owner/settings/page.tsx',
        'app/(dashboard)/owner/dispatches/ChallanDraftEditor.tsx',
        'app/(dashboard)/owner/dispatches/DispatchDetailDialog.tsx',
        'app/(dashboard)/owner/estimator/EstimatorClient.tsx',
        'app/(dashboard)/owner/production/registers/MachinesRegister.tsx',
        'app/(dashboard)/owner/production/registers/WorkersRegister.tsx',
        'app/(dashboard)/owner/billing/page.tsx',
        'app/(dashboard)/owner/quotes/QuotesClient.tsx',
        'components/estimator/UpgradeBenefitsPreview.tsx',
    ]

    it('slides details content open and closed where the browser supports it', () => {
        expect(globals).toMatch(/details\.ui-details\s*\{[^}]*interpolate-size: allow-keywords;/)
        expect(globals).toMatch(/details\.ui-details::details-content\s*\{[^}]*block-size: 0;[^}]*transition-behavior: allow-discrete;/)
        expect(globals).toMatch(/details\.ui-details\[open\]::details-content\s*\{[^}]*block-size: auto;/)
        expect(reducedMotionCss(globals)).toContain('details.ui-details::details-content')
    })

    it.each(panels)('opts the in-app panels in %s', path => {
        expect(read(path)).toMatch(/<details\b[\s\S]{0,400}?ui-details/)
    })

    it('keeps the saved-costings filter popover out: its menu is positioned, not a panel', () => {
        const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const filterClasses = quotes.match(/<details className="(group relative z-20[^\"]*)">/)?.[1]
        expect(filterClasses).toBeDefined()
        expect(filterClasses).not.toContain('ui-details')
    })
})

describe('overlay primitives', () => {
    it('lets sheets decelerate into place instead of a flat ease-in-out', () => {
        const sheet = read('components/ui/sheet.tsx')
        expect(sheet).not.toContain('ease-in-out')
        expect(sheet).toContain('data-[state=open]:ease-(--ease-sheet)')
        expect(sheet).toContain('data-[state=open]:duration-300')
        expect(sheet).toContain('data-[state=closed]:duration-200')
    })

    it('grows popovers out of their trigger like menus and selects', () => {
        expect(read('components/ui/popover.tsx')).toContain('origin-(--radix-popover-content-transform-origin)')
    })

    it('settles tab panels in when they swap', () => {
        expect(read('components/ui/tabs.tsx')).toMatch(/data-slot="tabs-content"[\s\S]*ui-content-swap/)
    })

    it('leaves the owner-chosen modal spring untouched', () => {
        expect(globals).toContain('animation: modal-spring-in 420ms')
        expect(globals).toContain('from { opacity: 0; scale: var(--modal-enter-scale, 0.6); rotate: var(--modal-enter-rotate, 8deg); }')
    })
})

describe('navigation markers', () => {
    it('grows the saffron sidebar marker in on the newly active destination', () => {
        expect(globals).toMatch(/\.ui-nav-mark::before\s*\{\s*animation: ui-nav-mark/)
        expect(read('components/navigation/owner-sidebar.tsx')).toMatch(/ui-nav-mark [^']*before:absolute/)
        const disclosure = read('components/navigation/navigation-disclosure.tsx')
        expect(disclosure.match(/ui-nav-mark/g)?.length).toBe(2)
        expect(reducedMotionCss(globals)).toContain('.ui-nav-mark::before')
    })

    it('expands the mobile tab pill from its centre instead of flashing it on', () => {
        expect(mobile).toMatch(/\.mobile-navigation-icon::before\s*\{[^}]*scale: 0\.4 1;[^}]*transition:/)
        expect(mobile).toMatch(/\.mobile-navigation-item\[data-active="true"\] \.mobile-navigation-icon::before\s*\{[^}]*scale: 1;/)
        expect(mobile).not.toMatch(/\.mobile-navigation-item\[data-active="true"\] \.mobile-navigation-icon\s*\{\s*background/)
        expect(reducedMotionCss(mobile)).toContain('.mobile-navigation-icon::before')
    })
})

describe('meters', () => {
    it('moves bar fills on one shared curve', () => {
        expect(globals).toMatch(/\.ui-meter-fill\s*\{\s*transition: width/)
        expect(reducedMotionCss(globals)).toContain('.ui-meter-fill')
        expect(read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')).toMatch(/ui-meter-fill \$\{segment\.color\}/)
        for (const path of [
            'app/(dashboard)/owner/production/BasePayrollSettlementWorkspace.tsx',
            'app/(dashboard)/owner/production/BaseProductionClient.tsx',
            'app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx',
        ]) {
            const source = read(path)
            expect(source).toContain('ui-meter-fill')
            expect(source).not.toContain('transition-all duration-500')
        }
    })
})

describe('loading skeletons', () => {
    const loaders = [
        'app/(dashboard)/owner/loading.tsx',
        'app/(dashboard)/owner/settings/loading.tsx',
        'app/(dashboard)/owner/rates/loading.tsx',
        'app/(dashboard)/owner/quotes/loading.tsx',
        'app/(dashboard)/owner/estimator/loading.tsx',
        'app/(dashboard)/owner/machines/loading.tsx',
        'app/(dashboard)/owner/workers/loading.tsx',
        'app/(dashboard)/owner/stock/loading.tsx',
        'app/(dashboard)/owner/billing/loading.tsx',
        'components/navigation/owner-route-loading.tsx',
        'components/production/base-workspace-loading.tsx',
        'components/ui/skeleton.tsx',
    ]

    it('sweeps a soft sheen across placeholders instead of blinking them', () => {
        expect(globals).toMatch(/\.ui-skeleton::after\s*\{[^}]*animation: ui-skeleton-sheen/)
        expect(reducedMotionCss(globals)).toContain('.ui-skeleton::after')
    })

    it.each(loaders)('%s uses the sheen, not the pulse', path => {
        const source = read(path)
        expect(source).toContain('ui-skeleton')
        expect(source).not.toContain('animate-pulse')
    })
})
