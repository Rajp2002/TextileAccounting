import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db, owner: {userId:string;orgId:string}, id: string
const issued = new Date(Date.now()-60_000).toISOString()
const binding = (s:string) => createHash('sha256').update(s).digest('hex')
async function create(requestId: string = randomUUID()) {
  await asServiceRole(db)
  const {rows} = await db.query("SELECT complete_free_saved_costing($1,$2,$3,$4,'engine',$5,'Original','{}','{\"cost\":10}','{}') AS value", [owner.userId,owner.orgId,requestId,binding(requestId),issued])
  return rows[0].value
}
async function revise(requestId: string = randomUUID(), revision = 1, costingId = id, cost = 20) {
  await asServiceRole(db)
  const {rows} = await db.query("SELECT recalculate_free_saved_costing($1,$2,$3,$4,'engine',$5,$6,$7,'Updated','{}',$8,'{}') AS value", [owner.userId,owner.orgId,requestId,binding(`${requestId}:${costingId}:${revision}:${cost}`),issued,costingId,revision,JSON.stringify({cost})])
  return rows[0].value
}
async function row() {
  await asSuperuser(db)
  return (await db.query('SELECT * FROM free_saved_costings WHERE id=$1',[id])).rows[0]
}
async function expire() {
  await asSuperuser(db)
  await db.query("UPDATE free_saved_costings SET created_at=clock_timestamp()-interval '30 minutes' WHERE id=$1",[id])
}
beforeAll(async()=>{db=await freshDatabase();await asSuperuser(db);await db.query('UPDATE free_rollout SET estimation_enabled=true')})
beforeEach(async()=>{
  owner=await seedOwnerOrg(db,{tier:null})
  await db.query('INSERT INTO free_account_subjects(id,verified_at,beta_allowed) VALUES($1,now(),true)',[owner.userId])
  await db.query('INSERT INTO free_account_grants(org_id,subject_id) VALUES($1,$2)',[owner.orgId,owner.userId])
  id=(await create()).savedCostingId
})
afterAll(async()=>{await db?.end()})

describe('Free saved costing revision window',()=>{
  it('updates the same entry without a debit, without moving the original deadline',async()=>{
    const original=await row(), result=await revise()
    expect(result.costingsUsed).toBe(0)
    expect(result.quota).toMatchObject({used:1,remaining:1})
    expect(result.editWindow.revision).toBe(2)
    expect(Date.parse(result.editWindow.editExpiresAt)-new Date(original.created_at).getTime()).toBe(30*60_000)
    const saved=await row()
    expect(saved.id).toBe(id);expect(saved.created_at).toEqual(original.created_at)
    expect(saved.result).toEqual({cost:20});expect(saved.label).toBe('Updated')
    expect((await db.query('SELECT count(*)::int AS n FROM free_saved_costings WHERE subject_id=$1',[owner.userId])).rows[0].n).toBe(1)
  })
  it('allows revisions with zero allowance left',async()=>{
    await create()
    expect((await revise()).quota).toMatchObject({used:2,remaining:0})
    expect((await pgError(create())).message).toBe('FREE_QUOTA_EXHAUSTED')
  })
  it('returns the exact saved revision on retry, even after another revision and expiry',async()=>{
    const request=randomUUID(), first=await revise(request)
    await revise(randomUUID(),2,id,30)
    await expire()
    const replay=await revise(request)
    expect(replay.result).toEqual(first.result)
    expect(replay.quota.replayed).toBe(true)
    expect(replay.editWindow.revision).toBe(2)
    expect((await row()).revision).toBe(3)
    expect((await row()).result).toEqual({cost:30})
  })
  it('rejects new requests at expiry without changing saved data or quota',async()=>{
    await expire()
    expect((await pgError(revise())).message).toBe('FREE_EDIT_WINDOW_EXPIRED')
    expect((await row()).revision).toBe(1)
    expect((await db.query('SELECT used FROM free_monthly_usage WHERE subject_id=$1',[owner.userId])).rows[0].used).toBe(1)
  })
  it('rejects stale tab revisions instead of overwriting newer work',async()=>{
    await revise()
    expect((await pgError(revise())).message).toBe('FREE_COSTING_CONFLICT')
    expect((await row()).revision).toBe(2)
  })
  it('binds retries to their exact inputs',async()=>{
    const request=randomUUID()
    await revise(request)
    expect((await pgError(revise(request,1,id,999))).message).toBe('FREE_REQUEST_CONFLICT')
    expect((await row()).result).toEqual({cost:20})
  })
  it('rejects token reuse between creation and recalculation in both directions',async()=>{
    expect((await pgError(revise(id))).message).toBe('FREE_REQUEST_CONFLICT')
    const request=randomUUID();await revise(request)
    expect((await pgError(create(request))).message).toBe('FREE_REQUEST_CONFLICT')
    await asSuperuser(db)
    expect((await db.query('SELECT used FROM free_monthly_usage WHERE subject_id=$1',[owner.userId])).rows[0].used).toBe(1)
  })
  it('enforces costing ownership',async()=>{
    const mine=owner, foreign=await seedOwnerOrg(db,{tier:null})
    await db.query('INSERT INTO free_account_subjects(id,verified_at,beta_allowed) VALUES($1,now(),true)',[foreign.userId])
    await db.query('INSERT INTO free_account_grants(org_id,subject_id) VALUES($1,$2)',[foreign.orgId,foreign.userId])
    owner=foreign
    expect((await pgError(revise())).message).toBe('FREE_ACCESS_DENIED')
    owner=mine
    expect((await row()).revision).toBe(1)
  })
  it.each(['lite','base'])('does not apply to the %s plan',async tier=>{
    await asSuperuser(db)
    await db.query("INSERT INTO org_subscriptions(org_id,plan_tier,status,current_start,current_end) VALUES($1,$2,'active',now()-interval '1 day',now()+interval '30 days')",[owner.orgId,tier])
    expect((await pgError(revise())).message).toBe('FREE_ACCESS_DENIED')
  })
  it('denies locked accounts and direct authenticated calls',async()=>{
    await asSuperuser(db);await db.query('UPDATE organizations SET is_locked_down=true WHERE id=$1',[owner.orgId])
    expect((await pgError(revise())).message).toBe('FREE_ACCESS_DENIED')
    await asUser(db,owner.userId,owner.orgId)
    const denied=await pgError(db.query("SELECT recalculate_free_saved_costing($1,$2,$3,$4,'engine',$5,$6,1,'Updated','{}','{}','{}')",[owner.userId,owner.orgId,randomUUID(),binding('direct'),issued,id]))
    expect(denied.code).toBe('42501')
  })
  it('rolls back invalid saves with no revision or receipt left behind',async()=>{
    await asServiceRole(db)
    const request=randomUUID()
    await pgError(db.query("SELECT recalculate_free_saved_costing($1,$2,$3,$4,'engine',$5,$6,1,'','{}','{}','{}')",[owner.userId,owner.orgId,request,binding('invalid'),issued,id]))
    expect((await row()).revision).toBe(1)
    expect((await db.query('SELECT * FROM free_costing_recalculation_receipts WHERE request_id=$1',[request])).rows).toEqual([])
  })
})
