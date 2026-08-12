import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('logout route', () => {
    it('uses a native POST and a full-page GET redirect instead of a Server Action transition', () => {
        const button = read('components/auth/logout-button.tsx')
        const route = read('app/auth/signout/route.ts')
        const proxy = read('proxy.ts')

        expect(button).toContain('action="/auth/signout" method="post"')
        expect(button).not.toContain('action={signOut}')
        expect(route).toContain('export async function POST')
        expect(route).toContain('claims_validation')
        expect(route).toContain('supabase.auth.getClaims()')
        expect(route).toContain('supabase.auth.signOut()')
        expect(route).toContain("createSignInServerTimer('auth_logout', traceId)")
        expect(route).toContain("new URL('/login', request.url), { status: 303 }")
        expect(route).toContain("response.cookies.delete('last_activity')")
        expect(proxy).toContain("request.method === 'POST' && pathname === '/auth/signout'")
        expect(proxy).toContain("if (request.method === 'POST' && isAuthRoute(pathname) && !isSignOutRequest)")
    })

    it('rejects cross-origin form posts when the browser supplies an Origin header', () => {
        const route = read('app/auth/signout/route.ts')

        expect(route).toContain("request.headers.get('origin')")
        expect(route).toContain('origin !== request.nextUrl.origin')
        expect(route).toContain("{ error: 'Invalid request origin.' }, { status: 403 }")
    })
})
