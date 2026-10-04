import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
let db: Db
let founder: string, session: string, owner: { userId: string; orgId: string }, other: typeof owner
beforeAll(async () => {
    db = await freshDatabase(); owner = await seedOwnerOrg(db, { tier: null }); other = await seedOwnerOrg(db, { tier: null })
    await asSuperuser(db); founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'founder@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role,org_id) VALUES($1,'admin',NULL)", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic case fixture','founder@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder]); await asServiceRole(db)
    await db.query("SELECT public.admin_founder_session($1,$2,'establish')", [founder, session])
})
afterAll(async () => { await db?.end() })
const intake = (overrides = {}) => ({ title: 'Synthetic privacy request', body: 'A synthetic account access request.', orgId: owner.orgId, requesterUserId: owner.userId, contactEmail: 'requester@example.test', receivedAt: '2026-10-01T00:00:00Z', nextAction: 'Verify the requester authority', followUpDueAt: '2026-10-05T00:00:00Z', sourceReference: 'fixture-mail-1', category: 'access', source: 'manual_email', ...overrides })
async function mutate(operation: string, id: string | null, payload: unknown, kind = 'privacy', key = randomUUID(), connection = db) {
    await asServiceRole(connection)
    return (await connection.query('SELECT public.admin_formal_mutate($1,$2,$3,$4,$5,$6,$7) result', [founder, session, operation, kind, id, payload, key])).rows[0].result
}
async function read(id: string | null, kind = 'privacy', filters = {}) {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_formal_read($1,$2,$3,$4,$5) result', [founder, session, kind, id, filters])).rows[0].result
}
const change = (version: number, overrides = {}) => ({ expectedVersion: version, status: 'pending', nextAction: 'Review the verified scope', followUpDueAt: '2026-10-06T00:00:00Z', reason: 'Synthetic progress check', ...overrides })

describe('founder privacy/security case transactions', () => {
    it('reuses the source register, records receipt without acknowledgement, and exposes only bounded DTOs', async () => {
        const result = await mutate('create', null, intake()), detail = await read(result.id)
        expect(detail.record).toMatchObject({ managed: true, version: 1, identityState: 'pending', requesterBound: true, acknowledgedAt: null, internalTargetDate: '2026-10-31' })
        expect(detail.record).not.toHaveProperty('requesterUserId'); expect(detail.record).not.toHaveProperty('actor_id')
        expect(detail.events).toHaveLength(1); expect(detail.notes).toEqual([])
        await asSuperuser(db)
        expect((await db.query('SELECT subject FROM public.grievances WHERE id=$1', [result.id])).rowCount).toBe(1)
        const audit = (await db.query("SELECT before_safe,after_safe FROM private.admin_audit_events WHERE action='formal.create' AND target_id=$1", [result.id])).rows
        expect(JSON.stringify(audit)).not.toContain('requester@example'); expect(JSON.stringify(audit)).not.toContain('Synthetic privacy request')
    })
    it('denies direct tables/RPCs, wrong requester tenancy, revoked grant and AAL1', async () => {
        await asUser(db, owner.userId, owner.orgId)
        for (const table of ['private.admin_formal_cases', 'private.admin_formal_notes', 'private.admin_formal_events', 'private.admin_formal_revisions', 'public.grievances', 'public.security_incidents']) expect((await pgError(db.query(`SELECT * FROM ${table}`))).code).toBe('42501')
        expect((await pgError(db.query('SELECT public.admin_formal_read($1,$2,$3)', [founder, session, 'privacy']))).code).toBe('42501')
        expect((await pgError(mutate('create', null, intake({ requesterUserId: other.userId })))).code).toBe('42501')
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal1' WHERE id=$1", [session])
        expect((await pgError(read(null))).code).toBe('42501')
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1", [session]); await db.query('UPDATE private.platform_founder_grants SET enabled=false WHERE user_id=$1', [founder])
        expect((await pgError(read(null))).code).toBe('42501')
        await asSuperuser(db); await db.query('UPDATE private.platform_founder_grants SET enabled=true WHERE user_id=$1', [founder])
    })
    it('idempotent intake/note/update retries return originals, changed payload conflicts and stale edits do not win', async () => {
        const key = randomUUID(), result = await mutate('create', null, intake(), 'privacy', key)
        expect(await mutate('create', null, intake(), 'privacy', key)).toEqual(result)
        expect((await pgError(mutate('create', null, intake({ title: 'Different request' }), 'privacy', key))).code).toBe('40001')
        const noteKey = randomUUID(), note = { expectedVersion: 1, body: 'Private synthetic case note.' }
        const added = await mutate('note', result.id, note, 'privacy', noteKey)
        expect(added.version).toBe(2); expect(await mutate('note', result.id, note, 'privacy', noteKey)).toEqual(added)
        expect((await pgError(mutate('update', result.id, change(1)))).code).toBe('40001')
        const detail = await read(result.id); expect(detail.notes).toHaveLength(1)
        expect(detail.record.identityState).toBe('pending'); expect(detail.record.acknowledgedAt).toBeNull()
    })
    it('requires actual acknowledgement, verification and response evidence before resolved outcomes; reopening retains history', async () => {
        const result = await mutate('create', null, intake())
        expect((await pgError(mutate('update', result.id, change(1, { status: 'acknowledged' })))).code).toBe('22023')
        expect((await pgError(mutate('update', result.id, change(1, { identityState: 'verified' })))).code).toBe('22023')
        const acknowledgement = { status: 'acknowledged', acknowledgedAt: '2026-10-02T00:00:00Z', acknowledgementEvidenceRef: 'fixture-ack-mail' }
        expect((await mutate('update', result.id, change(1, acknowledgement))).version).toBe(2)
        const resolution = { status: 'resolved', outcomeCode: 'request_fulfilled', outcomeSummary: 'Recorded synthetic scoped response.', outcomeEvidenceRef: 'fixture-response-mail', responseRecordedAt: '2026-10-03T00:00:00Z', followUpDueAt: null }
        expect((await pgError(mutate('update', result.id, change(2, resolution)))).code).toBe('22023')
        expect((await mutate('update', result.id, change(2, { ...resolution, identityState: 'verified', identityEvidenceRef: 'fixture-authority-check' }))).version).toBe(3)
        expect((await read(result.id)).record.closedAt).not.toBeNull()
        await mutate('update', result.id, change(3, { status: 'escalated' }))
        const reopened = await read(result.id); expect(reopened.record.closedAt).toBeNull(); expect(reopened.events).toHaveLength(4)
        expect(reopened.record.outcomeSummary).toContain('synthetic scoped response')
    })
    it('records security work without changing reportability, notifying people or activating lockdown', async () => {
        const result = await mutate('create', null, intake({ title: 'Synthetic service investigation', category: 'availability', source: 'monitoring', requesterUserId: null }), 'security')
        await mutate('update', result.id, change(1, { status: 'triaging', severity: 'high', acknowledgedAt: '2026-10-02T00:00:00Z', acknowledgementEvidenceRef: 'fixture-incident-ack' }), 'security')
        expect((await pgError(mutate('update', result.id, change(2, { status: 'closed' }), 'security'))).code).toBe('22023')
        await mutate('update', result.id, change(2, { status: 'closed', severity: 'high', followUpDueAt: null, outcomeCode: 'remediated', outcomeSummary: 'Synthetic incident corrected.', outcomeEvidenceRef: 'fixture-fix-review' }), 'security')
        const detail = await read(result.id, 'security')
        expect(detail.record.existingAssessment).toBe('pending'); expect(detail.record.closedAt).not.toBeNull(); expect(detail.record.acknowledgedAt).not.toBeNull()
        await asSuperuser(db); expect((await db.query('SELECT is_locked_down FROM public.platform_security')).rows[0].is_locked_down).toBe(false)
    })
    it('adopts retained privacy records explicitly without rebinding or treating historical acknowledgements as newly proved', async () => {
        await asSuperuser(db); const id = randomUUID()
        await db.query("INSERT INTO public.grievances(id,subject,description,status,target_entity,grievance_type)VALUES($1,'Retained request','Synthetic legacy context','pending','WEAVLY','DATA_PRIVACY')", [id])
        expect((await read(id)).record).toMatchObject({ managed: false, version: 0 })
        expect((await mutate('adopt', id, { expectedVersion: 0, nextAction: 'Review the retained evidence', followUpDueAt: '2026-10-05T00:00:00Z' })).version).toBe(1)
        expect((await pgError(mutate('update', id, { ...change(1), orgId: other.orgId }))).code).toBe('22023')
        expect((await read(id)).record.orgId).toBeNull()
    })
    it('keeps closure time and the original private outcome evidence when a closed case is corrected', async () => {
        const result = await mutate('create', null, intake({ category: 'grievance' }))
        const close = { status: 'resolved', followUpDueAt: null, outcomeCode: 'response_recorded', outcomeSummary: 'Original synthetic response.', outcomeEvidenceRef: 'fixture-original-response', responseRecordedAt: '2026-10-03T00:00:00Z' }
        await mutate('update', result.id, change(1, close))
        const before = await read(result.id)
        await mutate('update', result.id, change(2, { ...close, outcomeSummary: 'Corrected synthetic summary.', outcomeEvidenceRef: 'fixture-corrected-response' }))
        const after = await read(result.id)
        expect(after.record.closedAt).toBe(before.record.closedAt)
        expect(after.revisions.find((r: { version: number; before: Record<string, unknown>; after: Record<string, unknown> }) => r.version === 3).before.outcomeEvidenceRef).toBe('fixture-original-response')
        expect(after.revisions.find((r: { version: number; before: Record<string, unknown>; after: Record<string, unknown> }) => r.version === 3).after.outcomeEvidenceRef).toBe('fixture-corrected-response')
        await asSuperuser(db)
        const audit = (await db.query('SELECT before_safe,after_safe FROM private.admin_audit_events WHERE target_id=$1', [result.id])).rows
        expect(JSON.stringify(audit)).not.toContain('fixture-original-response')
        expect(JSON.stringify(audit)).not.toContain('synthetic summary')
    })
    it('adoption and reopening preserve a legacy source response and proof fingerprint without exposing its URL', async () => {
        await asSuperuser(db); const id = randomUUID()
        await db.query("INSERT INTO public.grievances(id,subject,status,target_entity,grievance_type,created_at,resolved_at,response_summary,resolution_proof_url)VALUES($1,'Retained resolved request','resolved','WEAVLY','DATA_PRIVACY','2026-10-01','2026-10-02','Retained source response','https://example.test/private-proof?token=synthetic')", [id])
        await mutate('adopt', id, { expectedVersion: 0, nextAction: 'Review retained case evidence', followUpDueAt: '2026-10-05T00:00:00Z' })
        await mutate('update', id, change(1, { status: 'escalated' }))
        const detail = await read(id)
        expect(detail.record.outcomeSummary).toBe('Retained source response')
        expect(detail.revisions.find((r: { version: number; before: Record<string, unknown>; after: Record<string, unknown> }) => r.version === 1).after.closedAt).not.toBeNull()
        expect(detail.revisions.find((r: { version: number; before: Record<string, unknown>; after: Record<string, unknown> }) => r.version === 1).after.retainedProofHash).toMatch(/^[a-f0-9]{64}$/)
        expect(JSON.stringify(detail)).not.toContain('token=synthetic')
        await asSuperuser(db)
        expect((await db.query('SELECT response_summary FROM public.grievances WHERE id=$1', [id])).rows[0].response_summary).toBe('Retained source response')
    })
    it('preserves locked owner unlock intake without direct grievance privileges or an actual unlock', async () => {
        const locked = await seedOwnerOrg(db, { tier: null, locked: true })
        await asServiceRole(db)
        await db.query('SELECT public.admin_owner_unlock_request($1,$2,$3)', [locked.userId, locked.orgId, 'Synthetic owner review request'])
        await db.query('SELECT public.admin_owner_unlock_request($1,$2,$3)', [locked.userId, locked.orgId, 'Synthetic owner review request'])
        expect((await pgError(db.query('SELECT public.admin_owner_unlock_request($1,$2,$3)', [other.userId, locked.orgId, 'Foreign tenant request']))).code).toBe('42501')
        await asSuperuser(db)
        expect((await db.query("SELECT id FROM public.grievances WHERE org_id=$1 AND grievance_type='UNLOCK_REQUEST'", [locked.orgId])).rowCount).toBe(1)
        expect((await db.query('SELECT is_locked_down FROM public.organizations WHERE id=$1', [locked.orgId])).rows[0].is_locked_down).toBe(true)
    })
    it('source, private note/event and idempotency result roll back when required audit fails', async () => {
        const result = await mutate('create', null, intake())
        await asSuperuser(db)
        await db.query("CREATE FUNCTION private.synthetic_fail_formal_audit()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='formal.note' THEN RAISE EXCEPTION 'Synthetic audit outage'; END IF;RETURN NEW;END$$;CREATE TRIGGER synthetic_fail_formal BEFORE INSERT ON private.admin_audit_events FOR EACH ROW EXECUTE FUNCTION private.synthetic_fail_formal_audit()")
        try { expect((await pgError(mutate('note', result.id, { expectedVersion: 1, body: 'Should roll back entirely.' }))).code).toBe('P0001') }
        finally { await asSuperuser(db); await db.query('DROP TRIGGER synthetic_fail_formal ON private.admin_audit_events;DROP FUNCTION private.synthetic_fail_formal_audit()') }
        const detail = await read(result.id); expect(detail.record.version).toBe(1); expect(detail.notes).toEqual([]); expect(detail.events).toHaveLength(1)
    })
    it('concurrent same-key intake creates one case; concurrent version updates cannot both commit', async () => {
        const c = db.connectionParameters, second = connect({ host: c.host, port: c.port, database: c.database }); await second.connect()
        try {
            const key = randomUUID(), payload = intake()
            const [a, b] = await Promise.all([mutate('create', null, payload, 'privacy', key), mutate('create', null, payload, 'privacy', key, second)])
            expect(a).toEqual(b)
            const results = await Promise.allSettled([mutate('note', a.id, { expectedVersion: 1, body: 'One concurrent note.' }), mutate('note', a.id, { expectedVersion: 1, body: 'Another concurrent note.' }, 'privacy', randomUUID(), second)])
            expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
            expect((await read(a.id)).record.version).toBe(2)
        } finally { await second.end() }
    })
    it('bounded keyset lists and combined history cursor never lose equal-timestamp items', async () => {
        const first = await read(null, 'privacy', { queue: 'all', limit: 2 })
        expect(first.items).toHaveLength(3)
        const last = first.items[1], next = await read(null, 'privacy', { queue: 'all', limit: 2, cursorAt: last.sortAt, cursorId: last.id, asOf: first.asOf })
        expect(next.items.map((r: { id: string }) => r.id)).not.toContain(first.items[0].id)
        const result = await mutate('create', null, intake())
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_formal_notes(case_id,author_user_id,body,created_at) SELECT $1,$2,'Synthetic paged history', '2026-10-04' FROM generate_series(1,105)", [result.id, founder])
        const page = await read(result.id); expect(page.notes.length + page.events.length + page.revisions.length).toBe(100); expect(page.nextHistoryCursor).not.toBeNull()
        const tail = await read(result.id, 'privacy', { historyAt: page.nextHistoryCursor.createdAt, historyId: page.nextHistoryCursor.id })
        expect(tail.notes.length + tail.events.length + tail.revisions.length).toBe(7)
        expect(new Set([...page.notes, ...tail.notes].map(n => n.id)).size).toBe(105)
    })
})
