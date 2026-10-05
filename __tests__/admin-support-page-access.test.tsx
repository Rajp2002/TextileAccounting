import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe,it,expect,vi,beforeEach} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({owner:vi.fn(),redirect:vi.fn(),plan:vi.fn(),founder:vi.fn()}))
vi.mock('@/lib/support/server',()=>({requireSupportOwner:mocks.owner}))
vi.mock('@/lib/subscription',()=>({getOrgPlanAccess:mocks.plan}))
vi.mock('@/lib/admin/founder',()=>({requireFounderPage:mocks.founder}))
vi.mock('next/navigation',()=>({redirect:mocks.redirect}))
vi.mock('@/components/admin/sensitive-boundary',()=>({SensitiveBoundary:({children}:{children:React.ReactNode})=><>{children}</>}))
vi.mock('@/components/support/support-workspace',()=>({SupportInbox:({compactMobile=false,founder}:{compactMobile?:boolean;founder:boolean})=> <div data-compact={compactMobile} data-founder={founder}>Tickets loaded</div>,SupportThread:({compactMobile=false,founder}:{compactMobile?:boolean;founder:boolean})=> <div data-compact={compactMobile} data-founder={founder}>Conversation loaded</div>}))
vi.mock('@/components/support/support-history-export',()=>({SupportHistoryExport:({compactMobile=false}:{compactMobile?:boolean})=> <div data-export-compact={compactMobile}>History export</div>}))
import {AdminError} from '@/lib/admin/errors'
import Inbox from '@/app/(support)/support/page'
import Thread from '@/app/(support)/support/[id]/page'
import FounderInbox from '@/app/(admin-console)/admin/support/page'
import FounderThread from '@/app/(admin-console)/admin/support/[id]/page'
import {LEGAL_OPERATOR} from '@/lib/legal-operator'
const id='33333333-3333-4333-8333-333333333333'
beforeEach(()=>{vi.clearAllMocks();mocks.plan.mockResolvedValue({effectiveTier:'base'});mocks.founder.mockResolvedValue({userId:id});mocks.redirect.mockImplementation((path:string)=>{throw new Error('REDIRECT:'+path)})})
describe('requester support page guard failure states',()=>{
 it('only401 redirects to sign-in with bounded internal return path for both pages',async()=>{mocks.owner.mockRejectedValue(new AdminError('UNAUTHENTICATED',401,'Raw provider error'));await expect(Inbox()).rejects.toThrow('REDIRECT:/login?next=%2Fsupport');await expect(Thread({params:Promise.resolve({id})})).rejects.toThrow(`REDIRECT:/login?next=%2Fsupport%2F${id}`)})
 it('503 disabled/source failure renders unavailable and published recovery/contact without private content',async()=>{mocks.owner.mockRejectedValue(new AdminError('UNAVAILABLE',503,'Raw secret database detail'));for(const element of [await Inbox(),await Thread({params:Promise.resolve({id})})]){const html=renderToStaticMarkup(element);expect(html).toContain('Support is unavailable');expect(html).toContain(`mailto:${LEGAL_OPERATOR.contactEmail}`);expect(html).toContain('/forgot-password');expect(html).not.toContain('Raw secret');expect(html).not.toContain('Tickets loaded');expect(html).not.toContain('Conversation loaded')}expect(mocks.redirect).not.toHaveBeenCalled()})
 it('403 owner/revocation denial is generic and does not redirect or load records',async()=>{mocks.owner.mockRejectedValue(new AdminError('FORBIDDEN',403,'Raw role/profile details'));const html=renderToStaticMarkup(await Inbox());expect(html).toContain('Support access could not be verified');expect(html).not.toContain('Raw role');expect(html).not.toContain('Tickets loaded');expect(mocks.redirect).not.toHaveBeenCalled()})
 it('verified owner pages render the correct guarded requester workflow',async()=>{mocks.owner.mockResolvedValue({userId:id,orgId:id});expect(renderToStaticMarkup(await Inbox())).toContain('Tickets loaded');expect(renderToStaticMarkup(await Thread({params:Promise.resolve({id})}))).toContain('Conversation loaded')})
 it.each(['free','lite','base','none','unknown'])('verified %s owner presentation respects the authorized compact tiers',async tier=>{
  mocks.owner.mockResolvedValue({userId:id,orgId:id})
  mocks.plan.mockResolvedValue({effectiveTier:tier})
  const compact=tier==='free'||tier==='lite'
  const inbox=renderToStaticMarkup(await Inbox())
  expect(inbox).toContain(`data-compact="${compact}" data-founder="false"`)
  expect(inbox).toContain(`data-export-compact="${compact}"`)
  expect(renderToStaticMarkup(await Thread({params:Promise.resolve({id})}))).toContain(`data-compact="${compact}" data-founder="false"`)
  expect(mocks.owner).toHaveBeenCalledTimes(2)
  expect(mocks.plan).toHaveBeenCalledTimes(2)
  expect(mocks.plan).toHaveBeenCalledWith(id)
 })
 it('plan-source failure preserves the existing support workflow and access guard',async()=>{mocks.owner.mockResolvedValue({userId:id,orgId:id});mocks.plan.mockRejectedValue(new Error('Private plan source details'));for(const element of [await Inbox(),await Thread({params:Promise.resolve({id})})]){const html=renderToStaticMarkup(element);expect(html).toContain('data-compact="false"');expect(html).not.toContain('Private plan')}expect(mocks.owner).toHaveBeenCalledTimes(2)})
 it.each([403,503])('owner guard %s fails closed before compact-plan lookup',async status=>{
  mocks.owner.mockRejectedValue(new AdminError('FORBIDDEN',status,'Private guard details'))
  mocks.plan.mockResolvedValue({effectiveTier:'lite'})
  for(const element of [await Inbox(),await Thread({params:Promise.resolve({id})})]){
   const html=renderToStaticMarkup(element)
   expect(html).not.toContain('data-compact')
   expect(html).not.toContain('History export')
   expect(html).not.toContain('Private guard details')
  }
  expect(mocks.plan).not.toHaveBeenCalled()
 })
 it('privileged founder pages retain their presentation and independent access guard',async()=>{
  mocks.plan.mockResolvedValue({effectiveTier:'lite'})
  for(const element of [await FounderInbox(),await FounderThread({params:Promise.resolve({id})})])expect(renderToStaticMarkup(element)).toContain('data-compact="false" data-founder="true"')
  expect(mocks.founder).toHaveBeenCalledTimes(2)
  expect(mocks.owner).not.toHaveBeenCalled()
  expect(mocks.plan).not.toHaveBeenCalled()
 })
 it('failed founder access cannot render privileged records',async()=>{
  mocks.founder.mockRejectedValue(new Error('Founder access denied'))
  await expect(FounderInbox()).rejects.toThrow('Founder access denied')
  await expect(FounderThread({params:Promise.resolve({id})})).rejects.toThrow('Founder access denied')
  expect(mocks.plan).not.toHaveBeenCalled()
  expect(mocks.owner).not.toHaveBeenCalled()
 })
})
