import {test,expect,type Page} from '@playwright/test'
const id='33333333-3333-4333-8333-333333333333'
const org='22222222-2222-4222-8222-222222222222'
function fixture(founder=true){return {ticket:{id,orgId:org,subject:'Synthetic production setup issue',category:'production',priority:'high',status:'in_progress',source:'in_app',requesterBound:true,createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-04T10:00:00Z',version:4,nextAction:founder?'Review the safe workflow reference':'',followUpDueAt:null,nextUpdateDueAt:null,needsFounderReply:true,resolvedAt:null,resolutionCode:null,resolutionSummary:null,firstPublicFounderReplyAt:null,reopenedCount:0,...(founder?{externalReference:null}:{})},messages:[{id:'message-1',authorKind:'customer',messageKind:'initial_intake',body:'Synthetic owner: production setup is blocked.',createdAt:'2026-10-01T10:00:00Z',messageSeq:1}],events:[{id:'event-1',eventType:'create',before:{},after:{status:'new'},createdAt:'2026-10-01T10:00:00Z'}],asOf:'2026-10-04T10:00:00Z',nextMessageBefore:null,nextEventBefore:null,...(founder?{internalNotes:[{id:'note-1',body:'Synthetic private diagnostic: never customer-visible.',createdAt:'2026-10-04T09:00:00Z'}],nextNoteBefore:null}:{})}}
async function noExternal(page:Page){await page.route('**/*',route=>{const hostname=new URL(route.request().url()).hostname;return hostname==='127.0.0.1'?route.continue():route.abort('blockedbyclient')})}
test.beforeEach(async({page})=>{await noExternal(page)})
test('founder sees separated public/private composers and stored markup stays text',async({page},info)=>{
 const dto=fixture();dto.messages[0].body='<script>window.fixtureLeak=true</script> Synthetic text only'
 await page.route('**/api/admin/support/**',route=>route.fulfill({json:dto}))
 await page.goto(`/?kind=founder&ticket=${id}`);await expect(page.getByRole('heading',{name:'Public conversation'})).toBeVisible();await expect(page.getByText('Private founder notes',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send and resolve',exact:true})).toBeVisible();await expect(page.getByText('Synthetic private diagnostic: never customer-visible.')).toBeHidden();await page.getByText('Private founder notes',{exact:true}).click();await expect(page.getByRole('button',{name:'Add internal note'})).toBeVisible();expect(await page.evaluate(()=>Reflect.get(window,'fixtureLeak'))).toBeUndefined()
 await page.screenshot({path:`output/playwright/admin-console/support-fixtures/founder-${info.project.name}.png`,fullPage:true})
})
test('requester thread has no private note or founder control; draft is memory-only and Enter does not send',async({page},info)=>{
 const posts:unknown[]=[];await page.route('**/api/support/**',route=>{if(route.request().method()==='POST')posts.push(route.request().postDataJSON());return route.fulfill({json:fixture(false)})})
 await page.goto(`/?ticket=${id}`);await expect(page.getByRole('heading',{name:'Conversation',exact:true})).toBeVisible();await expect(page.getByText('Synthetic private diagnostic')).toHaveCount(0);await expect(page.getByRole('button',{name:'Add internal note'})).toHaveCount(0)
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic private draft');await page.getByRole('textbox',{name:'Message',exact:true}).press('Enter');expect(posts).toHaveLength(0)
 const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));expect(JSON.stringify(storage)).not.toContain('Synthetic private draft')
 await page.screenshot({path:`output/playwright/admin-console/support-fixtures/requester-${info.project.name}.png`,fullPage:true})
})
test('customer composer keeps an uncertain submission immutable after close and reopen',async({page})=>{
 const posts:Array<Record<string,unknown>>=[]
 await page.route('**/api/support?**',route=>route.fulfill({json:{items:[],totalMatching:0,nextCursor:null,asOf:'2026-10-31T04:00:00Z'}}))
 await page.route('**/api/support',route=>{posts.push(route.request().postDataJSON());return posts.length===1?route.abort('failed'):route.fulfill({status:429,json:{message:'Please wait before trying again.'}})})
 await page.goto('/');await page.getByRole('button',{name:'Create your first ticket'}).click()
 const subject=page.getByRole('textbox',{name:'Subject',exact:true}),description=page.getByRole('textbox',{name:'Description',exact:true})
 await expect(subject).toBeFocused();await expect(page.getByRole('button',{name:'Submit ticket',exact:true})).toBeDisabled()
 await subject.fill('Help with my estimate');await description.fill('Synthetic request with no customer data.');await page.getByRole('button',{name:'Submit ticket',exact:true}).click()
 await expect(page.getByRole('button',{name:'Retry original submission'})).toBeVisible();await expect(subject).toBeDisabled()
 await page.getByRole('button',{name:'Close',exact:true}).last().click();await expect(page.getByRole('status')).toContainText('Draft on this page')
 await page.getByRole('button',{name:'New ticket',exact:true}).click();await expect(subject).toHaveValue('Help with my estimate');await expect(subject).toBeDisabled()
 await page.getByRole('button',{name:'Retry original submission'}).click();await expect(page.getByRole('alert')).toContainText('Please wait');expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0])
})
test('lost response then429and refresh retry the original immutable reply key and version',async({page})=>{
 const dto=fixture();const posts:Array<Record<string,unknown>>=[]
 await page.route('**/api/admin/support/**',route=>{if(route.request().method()==='GET')return route.fulfill({json:dto});posts.push(route.request().postDataJSON());if(posts.length===1){dto.ticket.version=5;return route.abort('failed')}if(posts.length===2)return route.fulfill({status:429,json:{code:'THROTTLED',message:'Please wait before trying again.'}});return route.fulfill({json:{id,version:5,status:'in_progress'}})})
 await page.goto(`/?kind=founder&ticket=${id}`);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic immutable reply');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('button',{name:'Retry original reply'})).toBeVisible();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Refresh ticket'}).click();await expect(page.getByRole('button',{name:'Retry original reply'})).toBeVisible();await page.getByRole('button',{name:'Retry original reply'}).click();await expect(page.getByRole('alert')).toContainText('Please wait');await expect(page.getByRole('button',{name:'Retry original reply'})).toBeVisible();await page.getByRole('button',{name:'Refresh ticket'}).click();await page.getByRole('button',{name:'Retry original reply'}).click();await expect(page.getByText('Reply sent in-app.',{exact:true})).toBeVisible();expect(posts).toHaveLength(3);expect(posts[1]).toEqual(posts[0]);expect(posts[2]).toEqual(posts[0]);expect(posts[2].expectedVersion).toBe(4)
})
test('internal note sends only to notes endpoint and never changes public conversation',async({page})=>{
 const dto=fixture(),posts:Array<{url:string;body:Record<string,unknown>}>=[]
 await page.route('**/api/admin/support/**',route=>{if(route.request().method()==='GET')return route.fulfill({json:dto});const body=route.request().postDataJSON();posts.push({url:route.request().url(),body});dto.ticket.version=5;dto.internalNotes!.push({id:'note-2',body:String(body.body),createdAt:'2026-10-04T10:00:00Z'});return route.fulfill({json:{id,version:5,status:'in_progress'}})})
 await page.goto(`/?kind=founder&ticket=${id}`);await page.getByText('Private founder notes',{exact:true}).click();await page.getByRole('textbox',{name:'Internal note',exact:true}).fill('New synthetic private note');await page.getByRole('button',{name:'Add internal note',exact:true}).click();await expect(page.getByText('Private note added.',{exact:true})).toBeVisible();expect(posts[0].url).toContain('/notes');expect(dto.messages).toHaveLength(1);expect(dto.ticket.firstPublicFounderReplyAt).toBeNull();expect(dto.ticket.needsFounderReply).toBe(true)
})
test('founder inbox tabs and factory drill-down reach the API; rows show factory and plan',async({page},info)=>{
 const calls:string[]=[];const row=fixture().ticket
 await page.route('**/api/admin/support?**',route=>{calls.push(route.request().url());return route.fulfill({json:{items:[{...row,factoryName:'Synthetic Mills',planLabel:'Lite'}],nextCursor:null,totalMatching:1,asOf:'2026-10-04T10:00:00Z'}})})
 await page.goto(`/?kind=founder&queue=needs_reply&orgId=${org}`);await expect(page.getByText('Synthetic Mills · Lite')).toBeVisible();expect(calls.some(url=>url.includes('queue=needs_reply')&&url.includes(`orgId=${org}`))).toBe(true);await expect(page.getByRole('tab',{name:'Needs reply'})).toHaveAttribute('aria-selected','true')
 await page.getByRole('tab',{name:'Answered'}).click();await expect.poll(()=>calls.some(url=>url.includes('queue=answered'))).toBe(true)
 await page.getByRole('tab',{name:'Resolved'}).click();await expect.poll(()=>calls.some(url=>url.includes('queue=all')&&url.includes('status=resolved'))).toBe(true)
 await expect(page.getByRole('link',{name:'Open ticket'})).toBeVisible();await page.screenshot({path:`output/playwright/admin-console/support-fixtures/inbox-${info.project.name}.png`,fullPage:true})
})

test('synthetic requester and founder lifecycle wires create, send, customer reply, send and resolve, and reopen',async({page})=>{
 const dto=fixture() as unknown as import('@/lib/support/contracts').FounderTicketDetail
 let created=false;const mutations:Array<{path:string;payload:Record<string,unknown>}>=[]
 await page.route('**/api/**support**',async route=>{
  const request=route.request(),url=new URL(request.url()),founder=url.pathname.startsWith('/api/admin/'),method=request.method()
  const publicDto=()=>({ticket:{...dto.ticket,nextAction:'',followUpDueAt:null,externalReference:undefined},messages:dto.messages,events:dto.events,asOf:dto.asOf,nextMessageBefore:dto.nextMessageBefore,nextEventBefore:dto.nextEventBefore})
  if(method==='GET')return route.fulfill({json:url.pathname.endsWith('/support')?{items:created?[dto.ticket]:[],nextCursor:null,totalMatching:created?1:0,asOf:dto.asOf}:founder?dto:publicDto()})
  const payload=request.postDataJSON() as Record<string,unknown>;mutations.push({path:url.pathname,payload})
  if(url.pathname.endsWith('/support')){created=true;dto.ticket.subject=String(payload.subject);dto.ticket.status='new';dto.ticket.version=1;dto.ticket.category='other';dto.ticket.priority='normal';dto.messages=[{id:'intake',authorKind:'customer',messageKind:'initial_intake',body:String(payload.body),createdAt:dto.asOf,messageSeq:1}]}
  else{
   if(founder&&payload.expectedVersion!==dto.ticket.version)return route.fulfill({status:409,json:{code:'CONFLICT',message:'Refresh this synthetic ticket.'}})
   const old=dto.ticket.status;dto.ticket.version+=1
   if(founder){dto.ticket.status=payload.status as typeof dto.ticket.status;dto.ticket.nextAction=String(payload.nextAction);dto.ticket.followUpDueAt=payload.followUpDueAt as string|null;dto.ticket.nextUpdateDueAt=payload.nextUpdateDueAt as string|null;dto.ticket.externalReference=payload.externalReference as string|null}
   if(url.pathname.endsWith('/messages')){
    dto.messages.push({id:`message-${dto.messages.length+1}`,authorKind:founder?'founder':'customer',messageKind:'public_reply',body:String(payload.body),createdAt:dto.asOf,messageSeq:dto.messages.length+1})
    dto.ticket.needsFounderReply=!founder
    if(founder){dto.ticket.firstPublicFounderReplyAt??=dto.asOf;if(dto.ticket.status==='resolved'){dto.ticket.resolvedAt=dto.asOf;dto.ticket.resolutionCode=String(payload.resolutionCode);dto.ticket.resolutionSummary=String(payload.resolutionSummary)}}
    else{dto.ticket.status=old==='new'?'new':'in_progress';dto.ticket.followUpDueAt=null;dto.ticket.resolvedAt=null;if(old==='resolved')dto.ticket.reopenedCount+=1}
   }
  }
  return route.fulfill({json:{id,version:dto.ticket.version,status:dto.ticket.status}})
 })
 await page.goto('/');await page.getByRole('button',{name:'New ticket',exact:true}).click();await page.getByRole('textbox',{name:'Subject',exact:true}).fill('Synthetic lifecycle support ticket');await page.getByRole('textbox',{name:'Description',exact:true}).fill('Synthetic setup question');await page.getByRole('button',{name:'Submit ticket',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic lifecycle support ticket'})).toBeVisible()
 // Send: the ticket stays open and leaves Needs reply for Answered.
 await page.goto(`/?kind=founder&ticket=${id}`);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Which safe error reference do you see?');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Reply sent in-app.',{exact:true})).toBeVisible();expect(dto.ticket.status).toBe('in_progress');expect(dto.ticket.needsFounderReply).toBe(false);expect(mutations.at(-1)!.payload).toMatchObject({status:'in_progress',nextAction:'Wait for the customer',promiseFulfilled:false})
 // A customer reply puts it back in Needs reply.
 await page.goto(`/?ticket=${id}`);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic error reference ERR-123');await page.getByRole('button',{name:'Send reply',exact:true}).click();await expect(page.getByText('Reply sent in-app.',{exact:true})).toBeVisible();expect(dto.ticket.status).toBe('in_progress');expect(dto.ticket.needsFounderReply).toBe(true)
 // Send and resolve: the reply is the resolution summary and the ticket moves to Resolved.
 await page.goto(`/?kind=founder&ticket=${id}`);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic setup corrected.');await page.getByRole('button',{name:'Send and resolve',exact:true}).click();await expect(page.getByText('Reply sent and ticket resolved.',{exact:true})).toBeVisible();expect(dto.ticket.status).toBe('resolved');expect(dto.ticket.resolutionSummary).toBe('Synthetic setup corrected.');expect(dto.ticket.resolutionCode).toBe('explained_behavior');expect(dto.ticket.nextUpdateDueAt).toBeNull()
 await page.goto(`/?ticket=${id}`);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic problem persists');await page.getByRole('button',{name:'Send reply',exact:true}).click();await expect(page.getByText('Reply sent in-app.',{exact:true})).toBeVisible();expect(dto.ticket.status).toBe('in_progress');expect(dto.ticket.reopenedCount).toBe(1);expect(dto.ticket.needsFounderReply).toBe(true);expect(mutations).toHaveLength(5)
})
