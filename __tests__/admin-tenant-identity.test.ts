import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks=vi.hoisted(() => ({ getUser:vi.fn(), profile:vi.fn(), from:vi.fn(), revoked:vi.fn(), plan:vi.fn() }))
vi.mock('server-only',()=>({}))
vi.mock('react',()=>({ cache:<T>(fn:T)=>fn }))
vi.mock('next/navigation',()=>({ redirect:(path:string)=>{ throw new Error(`REDIRECT:${path}`) } }))
vi.mock('next/headers',()=>({ headers:async()=>new Headers() }))
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>({auth:{getUser:mocks.getUser}}) }))
vi.mock('@/lib/rate-limit',()=>({isUserRevoked:mocks.revoked}))
vi.mock('@/lib/subscription',()=>({getCachedOrgPlanAccess:mocks.plan}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:mocks.from})}))
import { getCachedSession, getVerifiedIdentity, requireRole } from '@/lib/auth'

const currentProfile=(role='owner',org_id:string|null='org-a')=>({role,org_id,full_name:'Synthetic User',access_revoked_at:null})
beforeEach(()=>{
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({data:{user:{id:'verified-user',app_metadata:{role:'admin',org_id:'attacker-org'},user_metadata:{role:'admin'}}}})
    mocks.revoked.mockResolvedValue(false)
    mocks.profile.mockResolvedValue({data:currentProfile(),error:null})
    mocks.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:mocks.profile})})})
    mocks.plan.mockResolvedValue({effectiveTier:'base',freeAccount:null})
})

describe('AD01 verified identity and tenant authorization separation',()=>{
    it('organization-less platform profile is verified identity but never a tenant session',async()=>{
        mocks.profile.mockResolvedValue({data:currentProfile('admin',null),error:null})
        expect((await getVerifiedIdentity())?.profile.org_id).toBeNull()
        expect(await getCachedSession()).toBeNull()
        await expect(requireRole(['admin'])).rejects.toThrow('REDIRECT:/login')
        expect(mocks.plan).not.toHaveBeenCalled()
    })
    it('owner without organization remains denied rather than receiving a fake tenant',async()=>{
        mocks.profile.mockResolvedValue({data:currentProfile('owner',null),error:null})
        expect(await getCachedSession()).toBeNull()
        await expect(requireRole(['owner'],{allowFreeAccount:true})).rejects.toThrow('REDIRECT:/login')
    })
    it('valid customer scope comes only from the current protected database profile',async()=>{
        const session=await requireRole(['owner'])
        expect(session.profile).toMatchObject({role:'owner',org_id:'org-a'})
        expect(session.profile.org_id).not.toBe('attacker-org')
        expect(mocks.plan).toHaveBeenCalledWith('org-a')
    })
    it('missing profile, revoked profile and failed profile lookup all fail closed',async()=>{
        mocks.profile.mockResolvedValue({data:null,error:null})
        expect(await getVerifiedIdentity()).toBeNull()
        mocks.profile.mockResolvedValue({data:{...currentProfile(),access_revoked_at:'2026-10-04T00:00:00Z'},error:null})
        expect(await getVerifiedIdentity()).toBeNull()
        mocks.profile.mockResolvedValue({data:currentProfile(),error:new Error('source unavailable')})
        expect(await getVerifiedIdentity()).toBeNull()
    })
    it('identity revocation prevents authorization queries and missing Auth identity is rejected',async()=>{
        mocks.revoked.mockResolvedValue(true)
        expect(await getVerifiedIdentity()).toBeNull()
        expect(mocks.from).not.toHaveBeenCalled()
        mocks.getUser.mockResolvedValue({data:{user:null}})
        expect(await getVerifiedIdentity()).toBeNull()
    })
    it('Free routing remains customer-only and support may explicitly skip the plan restriction',async()=>{
        mocks.plan.mockResolvedValue({effectiveTier:'free',freeAccount:{}})
        await expect(requireRole(['owner'])).rejects.toThrow('REDIRECT:/free')
        expect((await requireRole(['owner'],{allowFreeAccount:true})).profile.org_id).toBe('org-a')
    })
})
