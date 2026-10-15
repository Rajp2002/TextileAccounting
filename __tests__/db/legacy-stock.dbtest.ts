import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Legacy fabric stock (20261015120000): untagged pre-Weavly fabric kept in its own ledger next to orange
// (production-fed) stock. The two pools are never mixed, an unknown balance is never a number, and every
// movement between them is atomic and happens once.

let db: Db
let owner: { userId: string; orgId: string }
let quality = 0

type Legacy = { basis: string; balance: number | null; dispatched: number; onboarded: number; status: string; version: number }

/** A fresh quality with `orange` metres of orange stock, recorded as a verified opening. */
async function newQuality(orange = 1000, who = owner) {
    const label = `Quality ${++quality}`
    await asUser(db, who.userId, who.orgId)
    await db.query("SELECT public.record_quality_stock_adjustment($1, $2, 'opening', 'Physical count', $3)", [label, orange, randomUUID()])
    await asSuperuser(db)
    const { rows: [row] } = await db.query('SELECT id FROM public.quality_stock WHERE org_id = $1 AND quality_key = lower($2)', [who.orgId, label])
    return row.id as string
}

async function legacy(qualityId: string, client: Db = db, request = randomUUID(), action = 'start', payload: object = {}, version?: number) {
    await asUser(client, owner.userId, owner.orgId)
    const current = version ?? (await legacyRow(qualityId, client))?.version ?? 0
    await asUser(client, owner.userId, owner.orgId)
    const { rows: [row] } = await client.query('SELECT public.mutate_legacy_stock($1, $2, $3, $4, $5) AS result', [qualityId, request, current, action, payload])
    return row.result as { id: string; duplicate: boolean }
}

async function legacyRow(qualityId: string, client: Db = db): Promise<Legacy | undefined> {
    await asSuperuser(client)
    const { rows: [row] } = await client.query(
        `SELECT basis, balance_meters::float8 AS balance, dispatched_meters::float8 AS dispatched, onboarded_meters::float8 AS onboarded, status, version
         FROM public.legacy_stock WHERE quality_id = $1`, [qualityId])
    return row
}

async function orange(qualityId: string) {
    await asSuperuser(db)
    const { rows: [row] } = await db.query('SELECT meters::float8 AS meters FROM public.quality_stock WHERE id = $1', [qualityId])
    return row.meters as number
}

async function challanMutate(id: string, action: string, payload: object, client: Db = db) {
    await asSuperuser(client)
    const { rows: [current] } = await client.query('SELECT version FROM public.delivery_challans WHERE id = $1', [id])
    await asUser(client, owner.userId, owner.orgId)
    await client.query('SELECT public.mutate_delivery_challan($1, $2, $3, $4, $5)', [id, randomUUID(), current?.version ?? 0, action, payload])
}

/** A saved draft with the given lines; each line is [metres, 'tracked' | 'legacy' | undefined]. */
async function draft(qualityId: string, lines: [number, string | undefined][]) {
    const id = randomUUID()
    await challanMutate(id, 'save', {
        quality_id: qualityId,
        selling_rate: 50,
        lines: lines.map(([meters, source], index) => ({ lot: `T-${index + 1}`, meters, ...(source ? { source } : {}) })),
        document: {
            sender_name: 'Test Weaving Works', sender_address: 'Surat', customer_name: 'Test Party',
            customer_address: 'Surat', delivery_address: 'Surat', date: '2026-10-15',
        },
    })
    return id
}

beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: 'base' })
})
afterAll(async () => { await db?.end() })

describe('starting legacy stock', () => {
    it('INVARIANT: an unknown opening stores no number, not zero', async () => {
        const id = await newQuality()
        await legacy(id, db, randomUUID(), 'start', { basis: 'unknown' })
        expect(await legacyRow(id)).toMatchObject({ basis: 'unknown', balance: null, status: 'open' })
        expect((await pgError(legacy(id, db, randomUUID(), 'start', { basis: 'unknown' }, 1))).code).toBe('40001')
    })

    it('rejects metres with an unknown basis and missing metres with an estimate', async () => {
        const id = await newQuality()
        expect((await pgError(legacy(id, db, randomUUID(), 'start', { basis: 'unknown', meters: 100 }))).code).toBe('22023')
        expect((await pgError(legacy(id, db, randomUUID(), 'start', { basis: 'estimated' }))).code).toBe('22023')
        expect((await pgError(legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: -1 }))).code).toBe('22023')
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 30000 })
        expect(await legacyRow(id)).toMatchObject({ basis: 'estimated', balance: 30000 })
    })

    it('INVARIANT: the same request is applied once, and a changed retry is refused', async () => {
        const id = await newQuality()
        const request = randomUUID()
        const first = await legacy(id, db, request, 'start', { basis: 'estimated', meters: 500 }, 0)
        const again = await legacy(id, db, request, 'start', { basis: 'estimated', meters: 500 }, 0)
        expect(again).toEqual({ id: first.id, duplicate: true })
        expect((await pgError(legacy(id, db, request, 'start', { basis: 'estimated', meters: 600 }, 0))).code).toBe('40001')
    })
})

describe('challans split between orange and legacy stock', () => {
    it('INVARIANT: a mixed challan takes orange metres from orange stock and legacy metres from legacy stock', async () => {
        const id = await newQuality(1000)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 30000 })
        const challan = await draft(id, [[100, 'tracked'], [200, undefined], [200, 'legacy']])
        await challanMutate(challan, 'confirm', {})
        expect(await orange(id)).toBe(700)
        expect(await legacyRow(id)).toMatchObject({ balance: 29800, dispatched: 200 })
        await asSuperuser(db)
        const { rows: [saved] } = await db.query('SELECT sent_meters::float8 AS sent, legacy_meters::float8 AS legacy FROM public.delivery_challans WHERE id = $1', [challan])
        expect(saved).toEqual({ sent: 500, legacy: 200 })
    })

    it('INVARIANT: a legacy-only challan leaves orange stock untouched and is never refused for an unknown balance', async () => {
        const id = await newQuality(0)
        const challan = await draft(id, [[4200, 'legacy']])
        await challanMutate(challan, 'confirm', {})
        expect(await orange(id)).toBe(0)
        // Marking takas Legacy starts legacy stock as unknown; no balance is invented.
        expect(await legacyRow(id)).toMatchObject({ basis: 'unknown', balance: null, dispatched: 4200 })
        await asSuperuser(db)
        const { rows } = await db.query("SELECT kind FROM public.quality_stock_movements WHERE quality_id = $1 AND kind = 'dispatch'", [id])
        expect(rows).toHaveLength(0)
    })

    it('INVARIANT: not enough orange stock refuses the whole challan, legacy part included', async () => {
        const id = await newQuality(100)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 1000 })
        const challan = await draft(id, [[150, 'tracked'], [50, 'legacy']])
        expect((await pgError(challanMutate(challan, 'confirm', {}))).message).toMatch(/Insufficient stock/)
        expect(await orange(id)).toBe(100)
        expect(await legacyRow(id)).toMatchObject({ balance: 1000, dispatched: 0 })
    })

    it('INVARIANT: an estimate can be exceeded; the balance goes negative instead of being clamped', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 100 })
        await challanMutate(await draft(id, [[160, 'legacy']]), 'confirm', {})
        expect(await legacyRow(id)).toMatchObject({ basis: 'estimated', balance: -60 })
    })

    it('INVARIANT: reversing a mixed challan restores each pool exactly once', async () => {
        const id = await newQuality(1000)
        await legacy(id, db, randomUUID(), 'start', { basis: 'counted', meters: 800 })
        const challan = await draft(id, [[300, 'tracked'], [200, 'legacy']])
        await challanMutate(challan, 'confirm', {})
        await challanMutate(challan, 'reverse_dispatch', { reason: 'Truck returned', stock_present: true })
        expect(await orange(id)).toBe(1000)
        expect(await legacyRow(id)).toMatchObject({ balance: 800, dispatched: 0 })
        await asSuperuser(db)
        const { rows } = await db.query(
            "SELECT kind, reverses_id FROM public.legacy_stock_movements WHERE source_id = $1 ORDER BY created_at", [challan])
        expect(rows.map((row: { kind: string }) => row.kind)).toEqual(['dispatch', 'dispatch_reversal'])
        expect(rows[1].reverses_id).not.toBeNull()
        expect((await pgError(challanMutate(challan, 'reverse_dispatch', { reason: 'Again', stock_present: true }))).code).toBe('22023')
        expect(await legacyRow(id)).toMatchObject({ balance: 800 })
    })

    it('INVARIANT: existing challans without a source still take everything from orange stock', async () => {
        const id = await newQuality(500)
        await challanMutate(await draft(id, [[120, undefined]]), 'confirm', {})
        expect(await orange(id)).toBe(380)
        expect(await legacyRow(id)).toBeUndefined()
    })

    it('rejects an unknown line source', async () => {
        const id = await newQuality()
        expect((await pgError(draft(id, [[10, 'stolen']]))).code).toBe('22023')
    })

    it('INVARIANT: concurrent confirmations cannot oversell orange stock', async () => {
        const id = await newQuality(100)
        const a = await draft(id, [[80, 'tracked']])
        const b = await draft(id, [[80, 'tracked']])
        const params = db.connectionParameters
        const second = connect({ host: params.host, port: params.port, database: params.database })
        await second.connect()
        try {
            const results = await Promise.allSettled([challanMutate(a, 'confirm', {}), challanMutate(b, 'confirm', {}, second)])
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
            expect(await orange(id)).toBe(20)
        } finally { await second.end() }
    })
})

describe('onboarding old takas into orange stock', () => {
    const takas = [{ lot: '104', meters: 98.5 }, { lot: '105', meters: 101.5 }]

    it('INVARIANT: onboarding moves metres from legacy to orange in one step, once', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 1000 })
        const request = randomUUID()
        const seen = (await legacyRow(id))!.version
        const first = await legacy(id, db, request, 'onboard', { lines: takas }, seen)
        // A retry resends the exact request it first sent, including the version it saw.
        expect(await legacy(id, db, request, 'onboard', { lines: takas }, seen)).toEqual({ id: first.id, duplicate: true })
        expect(await orange(id)).toBe(200)
        expect(await legacyRow(id)).toMatchObject({ balance: 800, onboarded: 200 })
        await asSuperuser(db)
        const { rows: [moved] } = await db.query("SELECT id FROM public.legacy_stock_movements WHERE client_request_id = $1 AND kind = 'onboard'", [request])
        const { rows } = await db.query("SELECT meters_delta::float8 AS delta FROM public.quality_stock_movements WHERE source_id = $1 AND kind = 'legacy_onboarding'", [moved.id])
        expect(rows).toEqual([{ delta: 200 }])
    })

    it('INVARIANT: onboarding with an unknown balance keeps it unknown and still counts what was onboarded', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'onboard', { lines: takas })
        expect(await legacyRow(id)).toMatchObject({ basis: 'unknown', balance: null, onboarded: 200 })
        expect(await orange(id)).toBe(200)
    })

    it('refuses repeated taka numbers and empty rows', async () => {
        const id = await newQuality(0)
        expect((await pgError(legacy(id, db, randomUUID(), 'onboard', { lines: [takas[0], { lot: ' 104 ', meters: 10 }] }))).code).toBe('22023')
        expect((await pgError(legacy(id, db, randomUUID(), 'onboard', { lines: [{ lot: '', meters: 10 }] }))).code).toBe('22023')
        expect((await pgError(legacy(id, db, randomUUID(), 'onboard', { lines: [{ lot: '7', meters: 0 }] }))).code).toBe('22023')
        expect(await orange(id)).toBe(0)
    })
})

describe('counting, closing and reopening', () => {
    it('INVARIANT: a count that differs from the balance needs a reason and keeps the gap in the ledger', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 25800 })
        expect((await pgError(legacy(id, db, randomUUID(), 'count', { meters: 18450 }))).code).toBe('22023')
        await legacy(id, db, randomUUID(), 'count', { meters: 18450, reason: 'Godown count, rack A to D' })
        expect(await legacyRow(id)).toMatchObject({ basis: 'counted', balance: 18450 })
        await asSuperuser(db)
        const { rows: [count] } = await db.query(
            "SELECT expected_meters::float8 AS expected, entered_meters::float8 AS entered, meters_delta::float8 AS delta FROM public.legacy_stock_movements WHERE quality_id = $1 AND kind = 'count'", [id])
        expect(count).toEqual({ expected: 25800, entered: 18450, delta: -7350 })
    })

    it('INVARIANT: a count after an unknown start is a new starting point, with no back-dated opening', async () => {
        const id = await newQuality(0)
        await challanMutate(await draft(id, [[4200, 'legacy']]), 'confirm', {})
        await legacy(id, db, randomUUID(), 'count', { meters: 9000 })
        expect(await legacyRow(id)).toMatchObject({ basis: 'counted', balance: 9000, dispatched: 4200 })
        await asSuperuser(db)
        const { rows: [start] } = await db.query("SELECT entered_meters FROM public.legacy_stock_movements WHERE quality_id = $1 AND kind = 'start'", [id])
        expect(start.entered_meters).toBeNull()
    })

    it('INVARIANT: a count against a stale balance is refused', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 500 })
        const seen = (await legacyRow(id))!.version
        await challanMutate(await draft(id, [[50, 'legacy']]), 'confirm', {})
        expect((await pgError(legacy(id, db, randomUUID(), 'count', { meters: 450 }, seen))).code).toBe('40001')
    })

    it('INVARIANT: an estimate reaching zero does not close; only a zero count and confirmation do', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 200 })
        await challanMutate(await draft(id, [[200, 'legacy']]), 'confirm', {})
        expect(await legacyRow(id)).toMatchObject({ basis: 'estimated', balance: 0, status: 'open' })
        expect((await pgError(legacy(id, db, randomUUID(), 'close', { confirmed: true }))).code).toBe('22023')
        await legacy(id, db, randomUUID(), 'count', { meters: 0 })
        expect((await pgError(legacy(id, db, randomUUID(), 'close', {}))).code).toBe('22023')
        await legacy(id, db, randomUUID(), 'close', { confirmed: true })
        expect(await legacyRow(id)).toMatchObject({ status: 'closed' })
    })

    it('INVARIANT: a closed quality refuses legacy takas until it is reopened with a reason', async () => {
        const id = await newQuality(1000)
        await legacy(id, db, randomUUID(), 'start', { basis: 'counted', meters: 0 })
        await legacy(id, db, randomUUID(), 'close', { confirmed: true })
        const challan = await draft(id, [[10, 'legacy']])
        expect((await pgError(challanMutate(challan, 'confirm', {}))).message).toMatch(/closed/)
        expect(await orange(id)).toBe(1000)
        expect((await pgError(legacy(id, db, randomUUID(), 'reopen', { basis: 'counted', meters: 300 }))).code).toBe('22023')
        await legacy(id, db, randomUUID(), 'reopen', { basis: 'counted', meters: 300, reason: 'Found bales in the back godown' })
        expect(await legacyRow(id)).toMatchObject({ status: 'open', basis: 'counted', balance: 300 })
        await challanMutate(challan, 'confirm', {})
        expect(await legacyRow(id)).toMatchObject({ balance: 290 })
        await asSuperuser(db)
        const { rows } = await db.query('SELECT kind FROM public.legacy_stock_movements WHERE quality_id = $1 ORDER BY created_at, id', [id])
        expect(rows.map((row: { kind: string }) => row.kind)).toEqual(['start', 'close', 'reopen', 'dispatch'])
    })

    it('INVARIANT: a counted balance cannot be replaced by an estimate', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'counted', meters: 100 })
        expect((await pgError(legacy(id, db, randomUUID(), 'estimate', { meters: 500 }))).code).toBe('22023')
    })
})

describe('access', () => {
    it('INVARIANT: another factory cannot read or change this legacy stock', async () => {
        const id = await newQuality(0)
        await legacy(id, db, randomUUID(), 'start', { basis: 'estimated', meters: 100 })
        const other = await seedOwnerOrg(db, { tier: 'base', name: 'Other Mills' })
        await asUser(db, other.userId, other.orgId)
        const { rows } = await db.query('SELECT id FROM public.legacy_stock WHERE quality_id = $1', [id])
        expect(rows).toHaveLength(0)
        expect((await pgError(db.query("SELECT public.mutate_legacy_stock($1, $2, 1, 'count', '{\"meters\": 0}')", [id, randomUUID()]))).message).toMatch(/Choose a stock quality/)
        expect((await legacyRow(id))?.balance).toBe(100)
    })

    it('INVARIANT: an owner without production access cannot write legacy stock', async () => {
        const lite = await seedOwnerOrg(db, { tier: 'lite', name: 'Lite Mills' })
        await asUser(db, lite.userId, lite.orgId)
        expect((await pgError(db.query("SELECT public.mutate_legacy_stock($1, $2, 0, 'start', '{\"basis\": \"unknown\"}')", [randomUUID(), randomUUID()]))).code).toBe('42501')
    })

    it('INVARIANT: owners cannot write the tables directly', async () => {
        const id = await newQuality(0)
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query("INSERT INTO public.legacy_stock(org_id, quality_id, basis) VALUES ($1, $2, 'unknown')", [owner.orgId, id]))).code).toBe('42501')
    })
})
