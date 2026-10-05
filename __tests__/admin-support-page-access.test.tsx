import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe,it,expect,vi,beforeEach} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({owner:vi.fn(),redirect:vi.fn(),plan:vi.fn()}))
vi.mock('@/lib/support/server',()=>({requireSupportOwner:mocks.owner}))
vi.mock('@/lib/subscription',()=>({getOrgPlanAccess:mocks.plan}))
vi.mock('next/navigation',()=>({redirect:mocks.redirect}))
vi.mock('@/components/admin/sensitive-boundary',()=>({SensitiveBoundary:({children}:{children:React.ReactNode})=><>{children}</>}))
vi.mock('@/components/support/support-workspace',()=>({SupportInbox:({compactMobile}:{compactMobile?:boolean})=> <div data-compact={compactMobile}>Tickets loaded</div>,SupportThread:({compactMobile}:{compactMobile?:boolean})=> <div data-compact={compactMobile}>Conversation loaded</div>}))
import {AdminError} from '@/lib/admin/errors'
import Inbox from '@/app/(support)/support/page'
import Thread from '@/app/(support)/support/[id]/page'
import {LEGAL_OPERATOR} from '@/lib/legal-operator'
const id='33333333-3333-4333-8333-333333333333'
beforeEach(()=>{vi.clearAllMocks();mocks.plan.mockResolvedValue({effectiveTier:'base'});mocks.redirect.mockImplementation((path:string)=>{throw new Error('REDIRECT:'+path)})})
describe('requester support page guard failure states',()=>{
 it('only401 redirects to sign-in with bounded internal return path for both pages',async()=>{mocks.owner.mockRejectedValue(new AdminError('UNAUTHENTICATED',401,'Raw provider error'));await expect(Inbox()).rejects.toThrow('REDIRECT:/login?next=%2Fsupport');await expect(Thread({params:Promise.resolve({id})})).rejects.toThrow(`REDIRECT:/login?next=%2Fsupport%2F${id}`)})
 it('503 disabled/source failure renders unavailable and published recovery/contact without private content',async()=>{mocks.owner.mockRejectedValue(new AdminError('UNAVAILABLE',503,'Raw secret database detail'));for(const element of [await Inbox(),await Thread({params:Promise.resolve({id})})]){const html=renderToStaticMarkup(element);expect(html).toContain('Support is unavailable');expect(html).toContain(`mailto:${LEGAL_OPERATOR.contactEmail}`);expect(html).toContain('/forgot-password');expect(html).not.toContain('Raw secret');expect(html).not.toContain('Tickets loaded');expect(html).not.toContain('Conversation loaded')}expect(mocks.redirect).not.toHaveBeenCalled()})
 it('403 owner/revocation denial is generic and does not redirect or load records',async()=>{mocks.owner.mockRejectedValue(new AdminError('FORBIDDEN',403,'Raw role/profile details'));const html=renderToStaticMarkup(await Inbox());expect(html).toContain('Support access could not be verified');expect(html).not.toContain('Raw role');expect(html).not.toContain('Tickets loaded');expect(mocks.redirect).not.toHaveBeenCalled()})
 it('verified owner pages render the correct guarded requester workflow',async()=>{mocks.owner.mockResolvedValue({userId:id,orgId:id});expect(renderToStaticMarkup(await Inbox())).toContain('Tickets loaded');expect(renderToStaticMarkup(await Thread({params:Promise.resolve({id})}))).toContain('Conversation loaded')})
 it('only verified Free entitlement enables compact presentation after owner access succeeds',async()=>{mocks.owner.mockResolvedValue({userId:id,orgId:id});for(const tier of ['free','lite','base','none']){mocks.plan.mockResolvedValue({effectiveTier:tier});for(const element of [await Inbox(),await Thread({params:Promise.resolve({id})})])expect(renderToStaticMarkup(element)).toContain(`data-compact="${tier==='free'}"`)}expect(mocks.plan).toHaveBeenCalledWith(id)})
 it('plan-source failure preserves the existing support workflow and access guard',async()=>{mocks.owner.mockResolvedValue({userId:id,orgId:id});mocks.plan.mockRejectedValue(new Error('Private plan source details'));for(const element of [await Inbox(),await Thread({params:Promise.resolve({id})})]){const html=renderToStaticMarkup(element);expect(html).toContain('data-compact="false"');expect(html).not.toContain('Private plan')}expect(mocks.owner).toHaveBeenCalledTimes(2)})
})
