import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks=vi.hoisted(()=>({claims:vi.fn(),signOut:vi.fn(),actor:vi.fn(),revoke:vi.fn(),log:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getClaims:mocks.claims,signOut:mocks.signOut}})}))
vi.mock('@/lib/admin/founder',()=>({verifyFounderRevocationActor:mocks.actor,revokeFounderSessionsOf:mocks.revoke}))
vi.mock('@/lib/sign-in-telemetry.server',()=>({createSignInServerTimer:()=>({measure:async(_name:string,work:()=>Promise<unknown>)=>work(),log:mocks.log})}))
import { POST } from '@/app/auth/signout/route'

function request(authenticated=true,origin:string|null='http://localhost') {
    const body=new FormData();body.set('traceId','synthetic-logout')
    return new NextRequest('http://localhost/auth/signout',{
        method:'POST',body,headers:{...(origin?{origin}:{}),...(authenticated?{cookie:'sb-localproject-auth-token.0=chunk-a; sb-localproject-auth-token.1=chunk-b; last_activity=123'}:{})},
    })
}
beforeEach(()=>{
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PROJECT_ID','localproject')
    mocks.claims.mockResolvedValue({data:{claims:{sub:'synthetic-user'}},error:null})
    mocks.signOut.mockResolvedValue({error:null})
    mocks.actor.mockResolvedValue({userId:'synthetic-user',sessionId:'synthetic-session',aal:'aal1'})
    mocks.revoke.mockResolvedValue('revoked')
})

describe('AD01 logout confirmation boundary',()=>{
    it('returns503 when profile/identity verification is unavailable and provider signout also fails',async()=>{
        mocks.actor.mockRejectedValue(new Error('sensitive identity source detail'))
        mocks.signOut.mockResolvedValue({error:new Error('sensitive provider detail')})
        const response=await POST(request())
        expect(response.status).toBe(503)
        expect(response.headers.has('location')).toBe(false)
        const result=await response.json()
        expect(result).toMatchObject({code:'SIGNOUT_UNAVAILABLE'})
        expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/)
        expect(JSON.stringify(result)).not.toContain('sensitive')
        expect(mocks.log).toHaveBeenCalledWith('signout_error',{claims_valid:true,founder_revocation:'unavailable'})
    })

    it('a no-op revocation is not proof that an authenticated session was terminated',async()=>{
        mocks.revoke.mockResolvedValue('not_applicable')
        mocks.signOut.mockRejectedValue(new Error('provider unreachable'))
        expect((await POST(request())).status).toBe(503)
    })

    it('confirmed provider signout succeeds even when founder verification is unavailable',async()=>{
        mocks.actor.mockRejectedValue(new Error('profile unavailable'))
        const response=await POST(request())
        expect(response.status).toBe(303)
        expect(response.headers.get('location')).toBe('http://localhost/login')
        expect(response.headers.get('cache-control')).toContain('no-store')
    })

    it('confirmed authoritative founder revocation permits local logout when provider is unavailable',async()=>{
        mocks.signOut.mockResolvedValue({error:new Error('provider unavailable')})
        const response=await POST(request())
        expect(response.status).toBe(303)
        expect(response.cookies.get('sb-localproject-auth-token.0')?.value).toBe('')
        expect(response.cookies.get('sb-localproject-auth-token.1')?.value).toBe('')
        expect(response.cookies.get('last_activity')?.value).toBe('')
    })

    it('anonymous logout remains a safe redirect even if there is no Auth session to sign out',async()=>{
        mocks.claims.mockResolvedValue({data:{claims:null},error:null})
        mocks.revoke.mockResolvedValue('not_applicable')
        mocks.signOut.mockResolvedValue({error:new Error('no session')})
        expect((await POST(request(false))).status).toBe(303)
        expect(mocks.log).toHaveBeenCalledWith('success',{claims_valid:false,founder_revocation:'not_applicable'})
    })

    it('a claims-provider exception still tries both authorities and fails closed for a cookie-bearing session',async()=>{
        mocks.claims.mockRejectedValue(new Error('claims unavailable'))
        mocks.actor.mockRejectedValue(new Error('verification unavailable'))
        mocks.signOut.mockRejectedValue(new Error('signout unavailable'))
        expect((await POST(request())).status).toBe(503)
        expect(mocks.actor).toHaveBeenCalledTimes(1)
        expect(mocks.revoke).not.toHaveBeenCalled()
        expect(mocks.signOut).toHaveBeenCalledTimes(1)
    })

    it('an Auth-cookie project-hint mismatch cannot masquerade as anonymous when both authorities fail',async()=>{
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_PROJECT_ID','differentproject')
        mocks.claims.mockResolvedValue({data:{claims:null},error:new Error('verification unavailable')})
        mocks.actor.mockRejectedValue(new Error('verification unavailable'))
        mocks.signOut.mockResolvedValue({error:new Error('provider unavailable')})
        expect((await POST(request())).status).toBe(503)
    })

    it('verifies the founder actor before sign-out ends the session, then revokes alongside sign-out',async()=>{
        const order:string[]=[]
        let finishRevoke=()=>{}
        mocks.actor.mockImplementation(async()=>{order.push('actor');return {userId:'synthetic-user',sessionId:'synthetic-session',aal:'aal1'}})
        mocks.revoke.mockImplementation(()=>{order.push('revoke:start');return new Promise(resolve=>{finishRevoke=()=>{order.push('revoke:end');resolve('not_applicable')}})})
        mocks.signOut.mockImplementation(async()=>{order.push('signout:start');finishRevoke();return {error:null}})
        expect((await POST(request())).status).toBe(303)
        expect(order).toEqual(['actor','revoke:start','signout:start','revoke:end'])
    })

    it('identity check reuses the route client, so the session is read once',async()=>{
        await POST(request())
        expect(mocks.actor).toHaveBeenCalledWith(expect.objectContaining({auth:expect.objectContaining({signOut:mocks.signOut})}))
    })

    it('cross-origin logout is rejected before either authority is called',async()=>{
        expect((await POST(request(true,'https://unrelated.example'))).status).toBe(403)
        expect(mocks.signOut).not.toHaveBeenCalled()
        expect(mocks.actor).not.toHaveBeenCalled()
        expect(mocks.revoke).not.toHaveBeenCalled()
    })

    it('missing Origin is rejected instead of bypassing cookie mutation protection',async()=>{
        expect((await POST(request(true,null))).status).toBe(403)
        expect(mocks.signOut).not.toHaveBeenCalled()
        expect(mocks.actor).not.toHaveBeenCalled()
        expect(mocks.revoke).not.toHaveBeenCalled()
    })

    it('a cross-site fetch hint is rejected even with a spoofed same-origin value',async()=>{
        const crossSite=request();crossSite.headers.set('sec-fetch-site','cross-site')
        expect((await POST(crossSite)).status).toBe(403)
        expect(mocks.signOut).not.toHaveBeenCalled()
        expect(mocks.actor).not.toHaveBeenCalled()
        expect(mocks.revoke).not.toHaveBeenCalled()
    })
})
