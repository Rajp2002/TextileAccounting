import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { navigationIntentForClick, resolveNavigationPathname } from '../lib/navigation-intent'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const click = (overrides: Partial<{ button: number; defaultPrevented: boolean; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({
    button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...overrides,
})

describe('navigation intent', () => {
    it('records where a plain tap is going and where it started', () => {
        expect(navigationIntentForClick(click(), '/owner/quotes?status=draft#top', '/owner/estimator'))
            .toEqual({ path: '/owner/quotes', from: '/owner/estimator' })
        expect(navigationIntentForClick(click(), { pathname: '/owner/rates', query: { kind: 'yarn' } }, '/owner/estimator'))
            .toEqual({ path: '/owner/rates', from: '/owner/estimator' })
    })

    it('ignores taps that will not navigate this tab to another page', () => {
        expect(navigationIntentForClick(click({ defaultPrevented: true }), '/owner/quotes', '/owner/estimator')).toBeNull()
        expect(navigationIntentForClick(click({ button: 1 }), '/owner/quotes', '/owner/estimator')).toBeNull()
        for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
            expect(navigationIntentForClick(click({ [key]: true }), '/owner/quotes', '/owner/estimator')).toBeNull()
        }
        expect(navigationIntentForClick(click(), '/owner/estimator?draft=1', '/owner/estimator')).toBeNull()
    })

    it('shows the destination as current until the router commits it', () => {
        const intent = { path: '/owner/quotes', from: '/owner/estimator' }
        expect(resolveNavigationPathname('/owner/estimator', intent)).toBe('/owner/quotes')
        expect(resolveNavigationPathname('/owner/estimator', null)).toBe('/owner/estimator')
    })

    it('drops an intent once the page changes for any reason, including Back', () => {
        const intent = { path: '/owner/quotes', from: '/owner/estimator' }
        expect(resolveNavigationPathname('/owner/quotes', intent)).toBe('/owner/quotes')
        expect(resolveNavigationPathname('/owner/rates', intent)).toBe('/owner/rates')
    })
})

describe('instant navigation chrome', () => {
    it('starts an intent from every navigation link and drops the delayed pending box', () => {
        const link = read('components/navigation/navigation-link.tsx')
        expect(link).toContain('startNavigationIntent(navigationIntentForClick(event, props.href, pathname))')
        expect(link).not.toContain('useLinkStatus')
        expect(link).not.toContain('navigation-pending')
        expect(read('app/globals.css')).not.toContain('.navigation-pending')
    })

    it('selects tabs, drawer items, and workflow pills from the intended page', () => {
        for (const file of [
            'components/navigation/owner-sidebar.tsx',
            'components/navigation/navigation-disclosure.tsx',
            'components/navigation/mobile-workflow-navigation.tsx',
        ]) {
            expect(read(file), file).toContain('useNavigationPathname()')
        }
    })

    it('closes the phone drawer on the tap instead of after the next page arrives', () => {
        const sidebar = read('components/navigation/owner-sidebar.tsx')
        expect(sidebar).toContain('onDestination={() => { navigated.current = true; setIsOpen(false) }}')
        expect(sidebar).toContain('prefetchDestinations')
        expect(read('components/navigation/navigation-disclosure.tsx')).toContain('prefetch={prefetchDestinations ? undefined : false}')
    })

    it('reuses a page opened in the last 30 seconds instead of showing its skeleton again', () => {
        expect(read('next.config.ts')).toMatch(/staleTimes:\s*\{\s*dynamic:\s*30\s*\}/)
    })
})

describe('one calm page change', () => {
    it('shows a skeleton at once and settles the real page in from partial opacity', () => {
        const globals = read('app/globals.css')
        expect(globals).toMatch(/@keyframes ui-page-settle\s*\{\s*from\s*\{\s*opacity: 0\.5;\s*\}\s*\}/)
        expect(globals).toMatch(/\.dashboard-main > \*\s*\{\s*animation: ui-page-settle var\(--motion-base\) ease-out backwards;/)
        expect(globals).toMatch(/\.dashboard-main > \[aria-busy="true"\]\s*\{\s*animation: none;/)
        expect(read('app/(dashboard)/owner/loading.tsx')).toContain('aria-busy="true"')
    })

    it('gives phone skeletons the same compact title as the Free and Lite pages they stand in for', () => {
        const ownerLoading = read('components/navigation/owner-route-loading.tsx')
        expect(ownerLoading).toContain("'free-mobile-page-header'")
        expect(read('components/navigation/base-route-loading.tsx')).toContain('headerClassName')
        const estimatorLoading = read('app/(dashboard)/owner/estimator/loading.tsx')
        expect(estimatorLoading).toContain("useOwnerPlan() === 'lite' ? 'lite-mobile-page-header' : undefined")
    })
})
