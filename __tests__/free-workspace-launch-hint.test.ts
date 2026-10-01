import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionMock = vi.hoisted(() => vi.fn())
const planAccessMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ getCachedSession: sessionMock }))
vi.mock('@/lib/subscription', () => ({ getOrgPlanAccess: planAccessMock }))

import { POST } from '../app/api/workspace-hint/route'
import {
    freeWorkspaceHintValue,
    hasFreeWorkspaceHint,
    isFreeWorkspaceAccess,
    WORKSPACE_HINT_COOKIE,
} from '../lib/workspace-hint'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const ownerSession = (role = 'owner') => ({
    user: { id: 'owner-user-id' },
    profile: { role, org_id: 'org-1' },
})

function hintRequest(origin?: string) {
    return new NextRequest('https://textile-accounting.vercel.app/api/workspace-hint', {
        method: 'POST',
        headers: origin ? { origin } : {},
    })
}

beforeEach(() => {
    sessionMock.mockReset()
    planAccessMock.mockReset()
})

describe('workspace hint helpers', () => {
    it('matches only a Free hint written for the same user', () => {
        const value = freeWorkspaceHintValue('owner-user-id')

        expect(hasFreeWorkspaceHint(value, 'owner-user-id')).toBe(true)
        expect(hasFreeWorkspaceHint(value, 'other-user-id')).toBe(false)
        expect(hasFreeWorkspaceHint(value, null)).toBe(false)
        expect(hasFreeWorkspaceHint(undefined, 'owner-user-id')).toBe(false)
        expect(hasFreeWorkspaceHint('free', 'owner-user-id')).toBe(false)
        expect(hasFreeWorkspaceHint('lite.owner-user-id', 'owner-user-id')).toBe(false)
    })

    it('uses the same Free workspace rule as the owner layout and requireRole', () => {
        expect(isFreeWorkspaceAccess({ effectiveTier: 'free' })).toBe(true)
        expect(isFreeWorkspaceAccess({ effectiveTier: 'none', freeAccount: true })).toBe(true)
        expect(isFreeWorkspaceAccess({ effectiveTier: 'none' })).toBe(false)
        expect(isFreeWorkspaceAccess({ effectiveTier: 'lite' })).toBe(false)
        expect(isFreeWorkspaceAccess({ effectiveTier: 'base' })).toBe(false)

        const ownerLayout = read('app/(dashboard)/owner/layout.tsx')
        const auth = read('lib/auth.ts')
        expect(ownerLayout).toContain("if (access.effectiveTier === 'free' || access.freeAccount) {")
        expect(auth).toContain("if (access.effectiveTier === 'free' || access.freeAccount) redirect('/free')")
    })
})

describe('/api/workspace-hint', () => {
    it('sets the hint for a Free owner from the server-side plan', async () => {
        sessionMock.mockResolvedValue(ownerSession())
        planAccessMock.mockResolvedValue({ subscriptionTier: 'free', effectiveTier: 'free', freeAccount: true })

        const response = await POST(hintRequest('https://textile-accounting.vercel.app'))

        expect(response.status).toBe(204)
        expect(planAccessMock).toHaveBeenCalledWith('org-1')
        const cookie = response.cookies.get(WORKSPACE_HINT_COOKIE)
        expect(cookie?.value).toBe('free.owner-user-id')
        expect(cookie?.httpOnly).toBe(true)
        expect(cookie?.path).toBe('/')
    })

    it('clears a stale hint once the org is paid', async () => {
        sessionMock.mockResolvedValue(ownerSession())
        planAccessMock.mockResolvedValue({ subscriptionTier: 'lite', effectiveTier: 'lite' })

        const response = await POST(hintRequest())

        expect(response.status).toBe(204)
        expect(response.cookies.get(WORKSPACE_HINT_COOKIE)?.value).toBe('')
    })

    it('never sets the hint for non-owners', async () => {
        sessionMock.mockResolvedValue(ownerSession('admin'))

        const response = await POST(hintRequest())

        expect(planAccessMock).not.toHaveBeenCalled()
        expect(response.cookies.get(WORKSPACE_HINT_COOKIE)?.value).toBe('')
    })

    it('rejects anonymous and cross-origin requests without touching the cookie', async () => {
        sessionMock.mockResolvedValue(null)
        const anonymous = await POST(hintRequest())
        expect(anonymous.status).toBe(401)
        expect(anonymous.cookies.get(WORKSPACE_HINT_COOKIE)).toBeUndefined()

        const crossOrigin = await POST(hintRequest('https://attacker.example'))
        expect(crossOrigin.status).toBe(403)
        expect(crossOrigin.cookies.get(WORKSPACE_HINT_COOKIE)).toBeUndefined()
    })

    it('takes nothing from the request body', () => {
        const route = read('app/api/workspace-hint/route.ts')

        expect(route).not.toContain('request.json()')
        expect(route).not.toContain('request.formData()')
        expect(route).toContain('getCachedSession()')
        expect(route).toContain('getOrgPlanAccess(session.profile.org_id)')
    })
})

describe('Free workspace launch hint contracts', () => {
    it('keeps the plan lookup out of Proxy and uses the hint only for home redirects', () => {
        const proxy = read('proxy.ts')

        expect(proxy).not.toContain('@/lib/subscription')
        expect(proxy).not.toContain('getOrgPlanAccess')
        expect(proxy).toContain('hasFreeWorkspaceHint(request.cookies.get(WORKSPACE_HINT_COOKIE)?.value, userId)')
        expect(proxy).toContain('getRoleHomePath(role, freeWorkspaceHint)')
        // Protected owner routes keep their literal redirect; the hint never rewrites them.
        expect(proxy).toContain("if (pathname === '/owner') {\n            return NextResponse.redirect(new URL('/owner/estimator', request.url))")
    })

    it('lets the Free layout correct a stale hint for a paid org', () => {
        const layout = read('app/free/layout.tsx')

        expect(layout).toContain("const session=await getCachedSession();if(!session)redirect('/login')")
        expect(layout).toContain('const access=await getOrgPlanAccess(session.profile.org_id)')
        expect(layout).toContain("if(freeWorkspaceHint&&!freeWorkspace)redirect('/owner/estimator')")
        expect(layout).toContain('{freeWorkspace&&!freeWorkspaceHint&&<WorkspaceHintSync/>}')
    })

    it('clears a stale hint only after the owner layout keeps Free orgs out', () => {
        const layout = read('app/(dashboard)/owner/layout.tsx')
        const freeRedirect = layout.indexOf("redirect('/free')")
        const staleHint = layout.indexOf('const staleFreeWorkspaceHint')

        expect(layout).toContain("requireRole(['owner'], { allowFreeAccount: true })")
        expect(freeRedirect).toBeGreaterThan(-1)
        expect(staleHint).toBeGreaterThan(freeRedirect)
        expect(layout).toContain('{staleFreeWorkspaceHint && <WorkspaceHintSync />}')
    })

    it('writes the hint from the tier the sign-in action resolved and clears it on sign-out', () => {
        const authActions = read('app/(auth)/actions/auth.ts')
        const signInBody = authActions.slice(authActions.indexOf('export async function signIn'))
        const signOut = read('app/auth/signout/route.ts')

        expect(signInBody).toContain("return succeed('/free', data.session.user.id)")
        expect(signInBody).toContain('cookieStore.delete(WORKSPACE_HINT_COOKIE)')
        expect(signInBody.indexOf('cookieStore.set(WORKSPACE_HINT_COOKIE')).toBeLessThan(
            signInBody.indexOf('return { redirectTo }'),
        )
        expect(signOut).toContain('response.cookies.delete(WORKSPACE_HINT_COOKIE)')
    })

    it('keeps the installed app starting at /login', () => {
        expect(read('app/manifest.ts')).toContain("start_url: '/login'")
    })
})
