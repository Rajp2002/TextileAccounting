import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FounderShell } from '@/components/admin/founder-shell'
import { FounderAuthFrame } from '@/components/admin/auth-frame'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/support/00000000-0000-4000-8000-000000000001' }))

function allPages(directory: string, relative = ''): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(relative, entry.name)
        return entry.isDirectory() ? allPages(join(directory, entry.name), path) : entry.name === 'page.tsx' ? [path] : []
    })
}

describe('founder shell and route inventory', () => {
    it('has exactly one owner of every routed page URL', () => {
        const pages = allPages(join(process.cwd(), 'app'))
        const routes = pages.map(page => `/${page.split('/').filter(segment => !segment.startsWith('(') && !segment.startsWith('@') && segment !== 'page.tsx').join('/')}`)
        const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index)
        expect(duplicates).toEqual([])
        for (const route of ['/admin/login', '/admin/verify', '/admin/legacy']) expect(routes.filter(value => value === route)).toHaveLength(1)
    })
    it('provides explicit primary/secondary navigation, focus target and shared signout information', () => {
        const html = renderToStaticMarkup(<FounderShell><h1>Fixture content only</h1></FounderShell>)
        for (const name of ['Today', 'Factories', 'Support', 'Payments', 'System', 'Audit', 'Formal operations']) expect(html).toContain(name)
        expect(html).toContain('href="#founder-content"')
        expect(html).toContain('id="founder-content" tabindex="-1"')
        expect(html).toMatch(/<a(?=[^>]*href="\/admin\/support")(?=[^>]*aria-current="page")[^>]*>/)
        expect(html).toContain('action="/auth/signout"')
        expect(html).toContain('Signing out also ends the customer session')
    })
    it('keeps customer records and signup links out of the auth shell', () => {
        const html = renderToStaticMarkup(<FounderAuthFrame title="Fixture sign-in" description="Fixture only"><form/></FounderAuthFrame>)
        expect(html).toContain('Founder access')
        expect(html).not.toContain('/signup')
        expect(html).not.toContain('/admin/factories')
        expect(html).not.toContain('/admin/support')
    })
})
