import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const access = vi.hoisted(() => ({ identity: vi.fn(), admin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ getVerifiedIdentity: access.identity }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: access.admin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ isUserRevoked: vi.fn(), checkAuthRateLimit: vi.fn() }))

import { GET as overview } from '@/app/api/admin/overview/route'
import { GET as factories } from '@/app/api/admin/factories/route'
import { GET as factory } from '@/app/api/admin/factories/[orgId]/route'
import { GET as payments } from '@/app/api/admin/payments/route'
import { GET as system } from '@/app/api/admin/system/route'
import { GET as audit } from '@/app/api/admin/audit/route'
import { GET as support, POST as capture } from '@/app/api/admin/support/route'
import { GET as thread, PATCH as patch } from '@/app/api/admin/support/[id]/route'
import { POST as reply } from '@/app/api/admin/support/[id]/messages/route'
import { POST as note } from '@/app/api/admin/support/[id]/notes/route'
import { GET as session, POST as touch } from '@/app/api/admin/session/route'
import { GET as ownSupport, POST as intake } from '@/app/api/support/route'
import { GET as ownThread } from '@/app/api/support/[id]/route'
import { POST as ownReply } from '@/app/api/support/[id]/messages/route'
import { GET as ownSession } from '@/app/api/support/session/route'
import { GET as candidateSession } from '@/app/api/admin/auth/session/route'
import { GET as legacyList } from '@/app/api/admin/legacy/route'
import { GET as legacyDetail } from '@/app/api/admin/legacy/[kind]/[id]/route'
import { GET as legacyBindings } from '@/app/api/admin/legacy/dpas/[id]/bindings/route'
import { GET as ownExport } from '@/app/api/support/export/route'

const id = '00000000-0000-4000-8000-000000000001'
const context = { params: Promise.resolve({ id }) }
const get = (path = '/api/admin/support') => new NextRequest(`https://qa.invalid${path}`)
const mutation = () => new Request('https://qa.invalid/api/admin/support', {
    method: 'POST', headers: { Origin: 'https://qa.invalid', 'Content-Type': 'application/json' }, body: '{}',
})
beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('WEAVLY_ADMIN_ENABLED', 'false')
    vi.stubEnv('WEAVLY_SUPPORT_ENABLED', 'false')
    vi.stubEnv('WEAVLY_ADMIN_PRODUCTION_APPROVED', '')
    vi.stubEnv('WEAVLY_SUPPORT_PRODUCTION_APPROVED', '')
    access.admin.mockImplementation(() => { throw new Error('Disabled capabilities must not query a database') })
})
afterEach(() => vi.unstubAllEnvs())

describe('AD11 server capability rollback', () => {
    const founder = [
        ['overview', () => overview(get())], ['factories', () => factories(get())],
        ['factory detail', () => factory(get(), { params: Promise.resolve({ orgId: id }) })],
        ['payments', () => payments(get())], ['system', () => system()], ['audit', () => audit(get())],
        ['support list', () => support(get())], ['support detail', () => thread(get(), context)],
        ['manual capture', () => capture(mutation())], ['support patch', () => patch(mutation(), context)],
        ['public reply', () => reply(mutation(), context)], ['internal note', () => note(mutation(), context)],
        ['session', () => session()], ['interactive touch', () => touch(mutation())],
        ['candidate session', () => candidateSession()],
        ['legacy list', () => legacyList(get('/api/admin/legacy'))],
        ['legacy record', () => legacyDetail(get(), { params: Promise.resolve({ kind: 'grievances', id }) })],
        ['legacy DPA bindings', () => legacyBindings(get(), { params: Promise.resolve({ id }) })],
    ] as const
    it.each(founder)('disabling founder data denies %s before any privileged read or write', async (_name, call) => {
        const response = await call()
        expect(response.status).toBe(503)
        expect(await response.json()).toMatchObject({ code: 'ADMIN_DISABLED' })
        expect(response.headers.get('cache-control')).toContain('no-store')
        expect(access.identity).not.toHaveBeenCalled()
        expect(access.admin).not.toHaveBeenCalled()
    })
    const customer = [
        ['own list', () => ownSupport(get('/api/support'))], ['own thread', () => ownThread(get('/api/support'), context)],
        ['intake', () => intake(mutation())], ['reply', () => ownReply(mutation(), context)],
        ['session', () => ownSession()],
        ['own public export', () => ownExport()],
    ] as const
    it.each(customer)('disabling customer support denies %s without changing business access', async (_name, call) => {
        const response = await call()
        expect(response.status).toBe(503)
        expect(await response.json()).toMatchObject({ code: 'SUPPORT_DISABLED' })
        expect(access.identity).not.toHaveBeenCalled()
        expect(access.admin).not.toHaveBeenCalled()
    })
    it('an enabled production switch is insufficient without the independent approval gate', async () => {
        vi.stubEnv('WEAVLY_ADMIN_ENABLED', 'true')
        vi.stubEnv('WEAVLY_SUPPORT_ENABLED', 'true')
        expect((await overview(get())).status).toBe(503)
        expect((await ownSupport(get())).status).toBe(503)
        expect(access.admin).not.toHaveBeenCalled()
    })
})
