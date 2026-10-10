import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { nextSidebarPreference, parseSidebarPreference, sidebarPreferenceCookie, SIDEBAR_PREFERENCE_COOKIE, SIDEBAR_RAIL_DEFAULT_QUERY } from '@/lib/sidebar-preference'
import { en } from '@/lib/i18n/locales/en'
import { hi } from '@/lib/i18n/locales/hi'
import { gu } from '@/lib/i18n/locales/gu'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Desktop sidebar: full menu or icon rail', () => {
    it('reads only the two saved choices and otherwise follows the screen', () => {
        expect(parseSidebarPreference('collapsed')).toBe('collapsed')
        expect(parseSidebarPreference('expanded')).toBe('expanded')
        for (const value of [undefined, null, '', 'rail', 'EXPANDED']) expect(parseSidebarPreference(value)).toBe('auto')
    })

    it('toggles to the opposite of what the screen shows now', () => {
        // Tablets and small laptops show the rail by default, so the first toggle expands it.
        expect(nextSidebarPreference('auto', true)).toBe('expanded')
        // From 1280px the full menu shows by default, so the first toggle collapses it.
        expect(nextSidebarPreference('auto', false)).toBe('collapsed')
        expect(nextSidebarPreference('collapsed', false)).toBe('expanded')
        expect(nextSidebarPreference('expanded', true)).toBe('collapsed')
        expect(SIDEBAR_RAIL_DEFAULT_QUERY).toBe('(min-width: 768px) and (max-width: 1279.98px)')
    })

    it('keeps the choice for a year in a site-wide cookie the layouts read on the server', () => {
        expect(sidebarPreferenceCookie('collapsed')).toBe(`${SIDEBAR_PREFERENCE_COOKIE}=collapsed; Path=/; Max-Age=31536000; SameSite=Lax`)
        for (const layout of ['app/(dashboard)/owner/layout.tsx', 'app/free/layout.tsx']) {
            expect(read(layout), layout).toContain('cookieStore.get(SIDEBAR_PREFERENCE_COOKIE)')
        }
        expect(read('app/(dashboard)/owner/layout.tsx')).toContain('data-workspace-shell data-sidebar-preference={sidebarPreference}')
        expect(read('app/free/FreeWorkspace.tsx')).toContain('data-workspace-shell data-sidebar-preference={sidebarPreference}')
    })

    it('drives every offset from --shell-sidebar-w: rail below 1280px, full menu from 1280px, the saved choice at any desktop width', () => {
        const styles = read('app/globals.css')
        expect(styles).toMatch(/@media \(min-width: 768px\) \{\s*:root \{\s*--shell-sidebar-w: var\(--shell-nav-rail-w\);/)
        expect(styles).toMatch(/@media \(min-width: 1280px\) \{\s*:root \{\s*--shell-sidebar-w: var\(--shell-nav-w\);/)
        expect(styles).toContain(':root:has([data-workspace-shell][data-sidebar-preference="expanded"]) {\n      --shell-sidebar-w: var(--shell-nav-w);')
        expect(styles).toContain(':root:has([data-workspace-shell][data-sidebar-preference="collapsed"]) {\n      --shell-sidebar-w: var(--shell-nav-rail-w);')
        expect(read('app/mobile.css')).toContain('.mobile-workspace-content { padding-left: var(--shell-sidebar-w);')
        // No surface keeps the old fixed width.
        for (const file of ['app/mobile.css', 'components/navigation/owner-sidebar.tsx', 'app/(dashboard)/owner/layout.tsx']) {
            expect(read(file), file).not.toMatch(/248px/)
        }
    })

    it('shows icons only when the aside is narrow and opens the rail over the page without moving it', () => {
        const styles = read('app/globals.css')
        expect(styles).toMatch(/\.workspace-sidebar \{\s*width: var\(--shell-sidebar-w\);\s*container: workspace-nav \/ inline-size;/)
        expect(styles).toMatch(/\.workspace-sidebar\[data-peek\] \{\s*width: var\(--shell-nav-w\);/)
        expect(styles).toContain('@container workspace-nav (width < 240px) {')
        const sidebar = read('components/navigation/owner-sidebar.tsx')
        expect(sidebar).toContain('data-peek={peeking || undefined}')
        expect(sidebar).toContain('<NavContent {...props} onToggleWidth={toggleWidth} />')
        // The phone drawer keeps the full menu and has no width toggle.
        expect(sidebar).toMatch(/<NavContent \{\.\.\.props\} prefetchDestinations onCurrentDestination=/)
    })

    it('labels the width toggle in every language', () => {
        for (const locale of [en, hi, gu]) {
            expect(locale.navigation.collapse_menu).toBeTruthy()
            expect(locale.navigation.expand_menu).toBeTruthy()
        }
    })
})
