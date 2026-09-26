import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Refactor Package 1B-1: tenant isolation, plan gating, locked organizations
// and request replay, exercised through the real quality-stock RPCs
// (E10 O-INV-01, O-INV-02, O-INV-09; E11 A-INV-07).

let db: Db
let orgA: { userId: string; orgId: string }
let orgB: { userId: string; orgId: string }

async function recordOpening(label: string, meters: number, requestId = randomUUID()) {
    const { rows } = await db.query(
        "SELECT public.record_quality_stock_adjustment($1, $2, 'opening', 'Physical count', $3) AS result",
        [label, meters, requestId],
    )
    return rows[0].result as { id: string; duplicate: boolean }
}

async function stockRows() {
    const { rows } = await db.query('SELECT org_id, quality_key, meters::float8 AS meters FROM public.quality_stock ORDER BY quality_key')
    return rows as { org_id: string; quality_key: string; meters: number }[]
}

beforeAll(async () => {
    db = await freshDatabase()
    orgA = await seedOwnerOrg(db, { tier: 'base', name: 'Org A' })
    orgB = await seedOwnerOrg(db, { tier: 'base', name: 'Org B' })
})
afterAll(async () => { await db?.end() })

describe('quality stock tenant, plan and lock boundaries', () => {
    it('INVARIANT O-INV-01: an owner records stock only in their own organization', async () => {
        await asUser(db, orgA.userId, orgA.orgId)
        await recordOpening('Cotton Poplin', 120.5)
        expect(await stockRows()).toEqual([{ org_id: orgA.orgId, quality_key: 'cotton poplin', meters: 120.5 }])
    })

    it('INVARIANT O-INV-01: another organization cannot read that stock, directly or via the board RPC', async () => {
        await asUser(db, orgB.userId, orgB.orgId)
        expect(await stockRows()).toEqual([])
        const { rows } = await db.query('SELECT public.get_quality_stock_board(NULL, NULL, NULL) AS board')
        expect(JSON.stringify(rows[0].board)).not.toContain('cotton poplin')
    })

    it('INVARIANT O-INV-09: replaying the same request id records the change once', async () => {
        await asUser(db, orgB.userId, orgB.orgId)
        const requestId = randomUUID()
        const first = await recordOpening('Rayon Slub', 50, requestId)
        const replay = await recordOpening('Rayon Slub', 50, requestId)
        expect(first.duplicate).toBe(false)
        expect(replay).toEqual({ id: first.id, duplicate: true })
        expect(await stockRows()).toEqual([{ org_id: orgB.orgId, quality_key: 'rayon slub', meters: 50 }])
    })

    it('INVARIANT O-INV-09: reusing a request id for different details is rejected', async () => {
        await asUser(db, orgB.userId, orgB.orgId)
        const requestId = randomUUID()
        await recordOpening('Linen Blend', 10, requestId)
        const error = await pgError(recordOpening('Linen Blend', 11, requestId))
        expect(error.code).toBe('40001')
    })

    it('INVARIANT O-INV-01: a Lite owner has no production stock access', async () => {
        const lite = await seedOwnerOrg(db, { tier: 'lite', name: 'Lite Org' })
        await asUser(db, lite.userId, lite.orgId)
        const error = await pgError(recordOpening('Cotton Poplin', 5))
        expect(error.code).toBe('42501')
    })

    it('INVARIANT O-INV-02 / A-INV-07: a locked organization cannot write stock and its balance is unchanged', async () => {
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = true WHERE id = $1', [orgA.orgId])
        await asUser(db, orgA.userId, orgA.orgId)
        const error = await pgError(db.query(
            "SELECT public.record_quality_stock_adjustment('Cotton Poplin', 999, 'correction', 'Recount', $1, 120.5)",
            [randomUUID()],
        ))
        expect(error.message).toContain('organization is locked')
        expect(await stockRows()).toEqual([{ org_id: orgA.orgId, quality_key: 'cotton poplin', meters: 120.5 }])
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = false WHERE id = $1', [orgA.orgId])
    })
})
