import {writeFileSync} from 'node:fs'
import {connect} from '../../scripts/test-db/cluster.mjs'
import {randomUUID} from 'node:crypto'
import {beforeAll,afterAll,beforeEach,describe,it,expect} from 'vitest'
import {freshDatabase,seedOwnerOrg,asSuperuser,asServiceRole,asUser,pgError,type Db} from './helpers'
let db:Db,founder:string,session:string,owner:{userId:string;orgId:string},peer:{userId:string;orgId:string},other:{userId:string;orgId:string}
async function rpc(operation:string,payload:Record<string,unknown>,id:string|null=null,admin=false,requestId=randomUUID()){
 const {rows}=await db.query('SELECT public.admin_support_mutate($1,$2,$3,$4,$5,$6) AS result',[admin?founder:owner.userId,admin?session:null,operation,id,payload,requestId]);return rows[0].result as {id:string;version:number;status:string}
}
async function read(id:string,admin=false,actor=owner.userId){const {rows}=await db.query("SELECT public.admin_support_read($1,$2,'detail',$3) AS result",[admin?founder:actor,admin?session:null,id]);return rows[0].result}
const intake={subject:'Production is blocked',category:'production',body:'Help with setup'}
function fields(version:number,status='in_progress'){return{expectedVersion:version,status,nextAction:'Founder to investigate',followUpDueAt:null,nextUpdateDueAt:null,externalReference:null,resolutionCode:null,resolutionSummary:null}}
beforeAll(async()=>{db=await freshDatabase();owner=await seedOwnerOrg(db,{tier:null,locked:true});other=await seedOwnerOrg(db,{tier:'lite'});peer=await seedOwnerOrg(db,{tier:'base'});await asSuperuser(db);await db.query('UPDATE public.profiles SET org_id=$1 WHERE id=$2',[owner.orgId,peer.userId]);peer.orgId=owner.orgId;founder=randomUUID();session=randomUUID();await db.query("INSERT INTO auth.users(id,email) VALUES($1,'founder@example.test')",[founder]);await db.query("INSERT INTO public.profiles(id,role) VALUES($1,'admin')",[founder]);await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason) VALUES($1,true,'Synthetic authorized fixture')",[founder]);await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')",[session,founder]);await db.query("INSERT INTO private.platform_admin_sessions(session_id,user_id,absolute_expires_at,aal_verified_at) VALUES($1,$2,now()+interval '8 hours',now())",[session,founder]);await asServiceRole(db)})
beforeEach(async()=>{await asServiceRole(db)})
afterAll(async()=>{await db?.end()})
describe('AD05 support transactional requester boundary',()=>{
 it('locked owner without paid access can create; same key returns original and changed payload409',async()=>{const key=randomUUID();const first=await rpc('create',intake,null,false,key);expect(await rpc('create',intake,null,false,key)).toEqual(first);expect((await pgError(rpc('create',{...intake,body:'Different'},null,false,key))).code).toBe('40001');const data=await read(first.id);expect(data.messages).toHaveLength(1);expect(data.ticket.status).toBe('new');expect(data).not.toHaveProperty('internalNotes');expect(data.ticket).not.toHaveProperty('externalReference')})
 it('same-organization peer and tenant B cannot read/reply; direct client writes/RPC denied',async()=>{const ticket=await rpc('create',intake);expect((await pgError(read(ticket.id,false,peer.userId))).code).toBe('P0002');expect((await pgError(read(ticket.id,false,other.userId))).code).toBe('P0002');await asUser(db,owner.userId,owner.orgId);expect((await pgError(db.query('SELECT * FROM public.support_tickets'))).code).toBe('42501');expect((await pgError(rpc('reply',{body:'Cannot spoof'},ticket.id))).code).toBe('42501');await asServiceRole(db)})
 it('create → triage → question → customer reply → fix → public resolve → reopen',async()=>{
 let t=await rpc('create',intake);t=await rpc('patch',{...fields(t.version),priority:'high',category:'production',reason:'Business workflow blocked'},t.id,true)
 t=await rpc('reply',{...fields(t.version,'waiting_on_customer'),body:'Which error reference appears?',followUpDueAt:'2030-01-01T00:00:00Z',promiseFulfilled:false},t.id,true)
 expect((await read(t.id)).ticket.needsFounderReply).toBe(false);t=await rpc('reply',{body:'ERR-123'},t.id);expect(t.status).toBe('in_progress')
 const due='2030-02-01T00:00:00Z';t=await rpc('patch',{...fields(t.version,'waiting_on_fix'),nextUpdateDueAt:due,externalReference:'https://example.test/issues/123',category:'production',priority:'high'},t.id,true)
 expect((await pgError(rpc('patch',{...fields(t.version,'resolved'),category:'production',priority:'high',resolutionCode:'bug_fixed',resolutionSummary:'Fixed'},t.id,true))).code).toBe('22023')
 t=await rpc('reply',{...fields(t.version,'resolved'),body:'The bug is fixed.',resolutionCode:'bug_fixed',resolutionSummary:'The bug is fixed.',promiseFulfilled:true},t.id,true)
 const resolved=await read(t.id);expect(resolved.ticket.firstPublicFounderReplyAt).toBeTruthy();expect(resolved.ticket.needsFounderReply).toBe(false);expect(resolved.ticket.nextUpdateDueAt).toBeNull()
 t=await rpc('reply',{body:'I still see the problem'},t.id);expect(t.status).toBe('in_progress');const reopened=await read(t.id);expect(reopened.ticket.resolvedAt).toBeNull();expect(reopened.ticket.reopenedCount).toBe(1);expect(reopened.ticket.needsFounderReply).toBe(true);expect(reopened.events.some((e:{eventType:string})=>e.eventType==='reopened')).toBe(true)
 })
 it('note never responds/fulfills, public and private DTOs differ, safe text XSS',async()=>{let t=await rpc('create',{...intake,body:'<script>stored text</script>'});const before=await read(t.id);t=await rpc('note',{body:'Private diagnostic reference',expectedVersion:t.version},t.id,true);const publicDto=await read(t.id);expect(JSON.stringify(publicDto)).not.toContain('Private diagnostic');expect(publicDto.ticket.firstPublicFounderReplyAt).toBeNull();expect(publicDto.ticket.needsFounderReply).toBe(true);expect(publicDto.messages).toEqual(before.messages);expect((await read(t.id,true)).internalNotes[0].body).toBe('Private diagnostic reference')})
 it('stale founder resolution never swallows newer customer reply and retry result precedes version',async()=>{let t=await rpc('create',intake);const stale=t.version;t=await rpc('reply',{body:'More information'},t.id);expect((await pgError(rpc('reply',{...fields(stale,'resolved'),body:'Done',resolutionCode:'setup_corrected',resolutionSummary:'Done',promiseFulfilled:false},t.id,true))).code).toBe('40001');const key=randomUUID(),payload={...fields(t.version),body:'Investigating',promiseFulfilled:false};const first=await rpc('reply',payload,t.id,true,key);await rpc('reply',{body:'Another detail'},t.id);expect(await rpc('reply',payload,t.id,true,key)).toEqual(first);expect((await read(t.id)).ticket.needsFounderReply).toBe(true)})
 it('priority-change reason is retained privately, audited atomically and deduplicated on retry',async()=>{
  const t=await rpc('create',intake),key=randomUUID(),payload={...fields(t.version),category:'production',priority:'critical',reason:'Synthetic business workflow blocked'}
  const first=await rpc('patch',payload,t.id,true,key);expect(await rpc('patch',payload,t.id,true,key)).toEqual(first)
  const privateDto=await read(t.id,true);expect(privateDto.internalNotes.filter((n:{body:string})=>n.body.includes('Synthetic business workflow blocked'))).toHaveLength(1)
  expect(JSON.stringify(await read(t.id))).not.toContain('Synthetic business workflow blocked')
 })
 it('simultaneous founder resolution and customer reply retain responsibility; concurrent identical retries append once',async()=>{
  const t=await rpc('create',intake)
  const params=db.connectionParameters
  const second=connect({host:params.host,port:params.port,database:params.database});await second.connect();await asServiceRole(second)
  try{
   const customer=second.query("SELECT public.admin_support_mutate($1,NULL,'reply',$2,$3,$4) AS result",[owner.userId,t.id,{body:'Concurrent detail'},randomUUID()])
   const founderReply=rpc('reply',{...fields(t.version,'resolved'),body:'Resolved publicly',resolutionCode:'setup_corrected',resolutionSummary:'Resolved publicly',promiseFulfilled:false},t.id,true)
   const results=await Promise.allSettled([customer,founderReply]);expect(results[0].status).toBe('fulfilled')
   if(results[1].status==='rejected')expect((results[1].reason as {code:string}).code).toBe('40001')
   const final=await read(t.id);expect(final.ticket.status).toBe('in_progress');expect(final.ticket.needsFounderReply).toBe(true)
   const key=randomUUID(),payload={body:'One concurrent reply'}
   const both=await Promise.all([rpc('reply',payload,t.id,false,key),second.query("SELECT public.admin_support_mutate($1,NULL,'reply',$2,$3,$4) AS result",[owner.userId,t.id,payload,key])])
   expect(both[0]).toEqual(both[1].rows[0].result)
   const after=await read(t.id);expect(after.messages.filter((m:{body:string})=>m.body===payload.body)).toHaveLength(1)
   expect(after.messages.map((m:{messageSeq:number})=>m.messageSeq)).toEqual(after.messages.map((_m:unknown,i:number)=>i+1))
  }finally{await second.end()}
 })
 it('unbound manual intake is internal-only and bound intake is not first response',async()=>{let t=await rpc('create',{...intake,orgId:owner.orgId,requesterUserId:null,source:'manual_phone'},null,true);const d=await read(t.id,true);expect(d.messages).toHaveLength(0);expect(d.internalNotes).toHaveLength(1);expect((await pgError(rpc('reply',{...fields(t.version),body:'Cannot deliver',promiseFulfilled:false},t.id,true))).code).toBe('22023');t=await rpc('patch',{...fields(t.version,'resolved'),category:'production',priority:'normal',resolutionCode:'explained_behavior',resolutionSummary:'Private outcome'},t.id,true);expect(t.status).toBe('resolved');const bound=await rpc('create',{...intake,orgId:owner.orgId,requesterUserId:owner.userId,source:'manual_email'},null,true);expect((await read(bound.id)).ticket.firstPublicFounderReplyAt).toBeNull();expect((await pgError(rpc('create',{...intake,orgId:owner.orgId,requesterUserId:other.userId,source:'manual_email'},null,true))).code).toBe('22023')})
 it('founder default list puts older critical/overdue ahead of recent normal; tied timestamps paginate once',async()=>{
  const critical=await rpc('create',intake),normal=await rpc('create',intake),overdue=await rpc('create',intake)
  await asSuperuser(db);await db.query("UPDATE public.support_tickets SET priority='normal' WHERE priority='critical'");await db.query("UPDATE public.support_tickets SET updated_at='2026-01-01',priority='critical' WHERE id=$1",[critical.id]);await db.query("UPDATE public.support_tickets SET updated_at='2026-01-01',next_update_due_at=now()-interval '1 hour' WHERE id=$1",[overdue.id]);await asServiceRole(db)
  const {rows}=await db.query("SELECT public.admin_support_read($1,$2,'list',NULL,$3) AS result",[founder,session,{limit:1}]);const first=rows[0].result;expect(first.items[0].id).toBe(critical.id)
  const cursor={id:first.items[0].id,updatedAt:first.items[0].updatedAt,rank:first.items[0].sortRank,asOf:first.asOf}
  const page2=await db.query("SELECT public.admin_support_read($1,$2,'list',NULL,$3) AS result",[founder,session,{limit:100,cursor}]);expect(page2.rows[0].result.items[0].id).toBe(overdue.id);expect(page2.rows[0].result.items.some((t:{id:string})=>t.id===critical.id)).toBe(false);expect(page2.rows[0].result.items.some((t:{id:string})=>t.id===normal.id)).toBe(true)
 })
 it('overdue waiting-customer follow-up is actionable separately from a promised public update',async()=>{
  let t=await rpc('create',intake);t=await rpc('reply',{...fields(t.version,'waiting_on_customer'),body:'Please share the safe error reference',followUpDueAt:'2020-01-01T00:00:00Z',promiseFulfilled:false},t.id,true)
  const {rows}=await db.query("SELECT public.admin_support_read($1,$2,'summary') AS result",[founder,session]);const summary=rows[0].result
  expect(summary.overdueFollowUps).toBeGreaterThan(0);expect(summary.attention.find((i:{ticketId:string})=>i.ticketId===t.id).reason).toBe('Internal customer follow-up due')
  await rpc('reply',{body:'Here is the error reference'},t.id);expect((await read(t.id,true)).ticket.followUpDueAt).toBeNull()
 })
 it('long public/private histories use bounded stable cursors without leakage or missing entries',async()=>{
  const t=await rpc('create',intake);await asSuperuser(db)
  await db.query("INSERT INTO public.support_messages(ticket_id,author_user_id,author_kind,message_kind,body,message_seq,client_request_id,idempotency_actor_key,request_payload_hash) SELECT $1::uuid,$2::uuid,'customer','public_reply','Synthetic message '||g,g+1,gen_random_uuid(),($2::uuid)::text,'fixture' FROM generate_series(1,205)g",[t.id,owner.userId])
  await db.query("INSERT INTO public.support_ticket_events(ticket_id,event_type,before_safe,after_safe,public_visible,request_id) SELECT $1,'status_changed','{}','{\"status\":\"in_progress\"}',true,gen_random_uuid() FROM generate_series(1,205)",[t.id])
  await db.query("INSERT INTO private.support_internal_notes(ticket_id,author_user_id,body,client_request_id,idempotency_actor_key,request_payload_hash) SELECT $1::uuid,$2::uuid,'Synthetic private note '||g,gen_random_uuid(),($2::uuid)::text,'fixture' FROM generate_series(1,205)g",[t.id,founder]);await asServiceRole(db)
  const latest=await read(t.id);expect(latest.messages).toHaveLength(200);expect(latest.events).toHaveLength(200);expect(JSON.stringify(latest)).not.toContain('Synthetic private note')
  const old=await db.query("SELECT public.admin_support_read($1,NULL,'detail',$2,$3) AS result",[owner.userId,t.id,{messageBefore:latest.nextMessageBefore,eventBeforeId:latest.nextEventBefore.id,eventBeforeAt:latest.nextEventBefore.createdAt}])
  expect([...old.rows[0].result.messages,...latest.messages]).toHaveLength(206);expect(new Set([...old.rows[0].result.events,...latest.events].map((e:{id:string})=>e.id)).size).toBe(206)
  const founderLatest=await read(t.id,true);expect(founderLatest.internalNotes).toHaveLength(200)
  const olderNotes=await db.query("SELECT public.admin_support_read($1,$2,'detail',$3,$4) AS result",[founder,session,t.id,{noteBeforeId:founderLatest.nextNoteBefore.id,noteBeforeAt:founderLatest.nextNoteBefore.createdAt}]);expect(olderNotes.rows[0].result.internalNotes).toHaveLength(5)
 })
 it('revoked owner and founder denied and audit failure rolls back message',async()=>{const t=await rpc('create',intake);await asSuperuser(db);await db.query('UPDATE public.profiles SET access_revoked_at=now() WHERE id=$1',[owner.userId]);await asServiceRole(db);expect((await pgError(read(t.id))).code).toBe('42501');await asSuperuser(db);await db.query('UPDATE public.profiles SET access_revoked_at=NULL WHERE id=$1',[owner.userId]);await db.query("CREATE FUNCTION private.test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic audit failure';END$$; CREATE TRIGGER test_reject_audit BEFORE INSERT ON private.admin_audit_events FOR EACH ROW EXECUTE FUNCTION private.test_reject_audit()");await asServiceRole(db);expect((await pgError(rpc('reply',{...fields(t.version),body:'Must roll back',promiseFulfilled:false},t.id,true))).message).toContain('Synthetic audit failure');const unchanged=await read(t.id);expect(unchanged.messages).toHaveLength(1);expect(unchanged.ticket.version).toBe(t.version);await asSuperuser(db);await db.query('DROP TRIGGER test_reject_audit ON private.admin_audit_events;DROP FUNCTION private.test_reject_audit()');await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1',[founder]);await asServiceRole(db);expect((await pgError(read(t.id,true))).code).toBe('42501');await asSuperuser(db);await db.query('UPDATE private.platform_founder_grants SET enabled=true,revoked_at=NULL WHERE user_id=$1',[founder]);await asServiceRole(db)})
 it('profiles priority list against1,000synthetic organizations and5,000tickets within local1second p95budget',async()=>{
  await asSuperuser(db)
  await db.query("CREATE TEMP TABLE support_scale_orgs AS SELECT g,gen_random_uuid() AS org_id,gen_random_uuid() AS user_id FROM generate_series(1,1000)g")
  await db.query("INSERT INTO auth.users(id,email) SELECT user_id,'support-scale-'||g||'@example.test' FROM support_scale_orgs")
  await db.query("INSERT INTO public.organizations(id,name,owner_id) SELECT org_id,'Synthetic support factory '||g,user_id FROM support_scale_orgs")
  await db.query("INSERT INTO public.profiles(id,org_id,role) SELECT user_id,org_id,'owner' FROM support_scale_orgs")
  await db.query("INSERT INTO public.support_tickets(org_id,requester_user_id,created_by_user_id,source,subject,category,priority,client_request_id,idempotency_actor_key,request_payload_hash) SELECT o.org_id,o.user_id,o.user_id,'in_app','Synthetic scale ticket '||s,'other',CASE WHEN s%20=0 THEN 'critical' ELSE 'normal' END,gen_random_uuid(),o.user_id::text,'fixture' FROM generate_series(1,5000)s JOIN support_scale_orgs o ON o.g=1+(s%1000)")
  await asServiceRole(db);const timings:number[]=[]
  for(let i=0;i<10;i++){const start=performance.now();const result=await db.query("SELECT public.admin_support_read($1,$2,'list',NULL,$3) AS result",[founder,session,{limit:25}]);timings.push(performance.now()-start);expect(result.rows[0].result.items).toHaveLength(26);expect(result.rows[0].result.totalMatching).toBeGreaterThanOrEqual(5000)}
  timings.sort((a,b)=>a-b);const p95=timings[Math.ceil(timings.length*.95)-1];writeFileSync('/tmp/weavly-support-performance.json',JSON.stringify({runAt:new Date().toISOString(),organizations:1000,tickets:5000,samples:10,p95Milliseconds:p95,budgetMilliseconds:1000,environment:'disposable loopback PostgreSQL'},null,2));console.info(`AD10 synthetic support scale:1000organizations/5000tickets;10samples;p95=${p95.toFixed(1)}ms;budget=1000ms;local disposable PostgreSQL`);expect(p95).toBeLessThan(1000)
 })

})
