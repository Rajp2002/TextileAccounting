import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Refactor Package 1B-1: saved costing snapshots are immutable in the
// database (E8 C-INV-21, trigger protect_costing_snapshot_update).

let db: Db
let owner: { userId: string; orgId: string }

async function seedCosting(recordKind = 'costing') {
    const id = randomUUID()
    await asSuperuser(db)
    await db.query(
        `INSERT INTO public.estimator_quotes(id, org_id, record_kind, yarn_denier, meters, yarn_rate_per_kg,
            landed_cost_per_meter, quote_price_per_meter, intended_margin_percent)
         VALUES ($1, $2, $3, 75, 5000, 180, 27.67, 31.44, 12)`,
        [id, owner.orgId, recordKind],
    )
    return id
}

async function price(id: string) {
    await asSuperuser(db)
    const { rows } = await db.query('SELECT quote_price_per_meter::float8 AS price, is_archived FROM public.estimator_quotes WHERE id = $1', [id])
    return rows[0] as { price: number; is_archived: boolean } | undefined
}

beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: 'lite' })
})
afterAll(async () => { await db?.end() })

describe('saved costing immutability', () => {
    it('INVARIANT C-INV-21: an owner cannot change the economics of a saved costing', async () => {
        const id = await seedCosting()
        await asUser(db, owner.userId, owner.orgId)
        const error = await pgError(db.query('UPDATE public.estimator_quotes SET quote_price_per_meter = 40 WHERE id = $1', [id]))
        expect(error.message).toBe('Historical costing snapshots are immutable. Save a new costing version for changed economics.')
        expect((await price(id))?.price).toBe(31.44)
    })

    it('INVARIANT C-INV-21: metadata such as archiving can still change', async () => {
        const id = await seedCosting()
        await asUser(db, owner.userId, owner.orgId)
        const { rowCount } = await db.query('UPDATE public.estimator_quotes SET is_archived = true WHERE id = $1', [id])
        expect(rowCount).toBe(1)
        expect(await price(id)).toEqual({ price: 31.44, is_archived: true })
    })

    it('INVARIANT C-INV-21: the rule also binds the service role, and deletion is refused', async () => {
        const id = await seedCosting()
        await asServiceRole(db)
        const update = await pgError(db.query('UPDATE public.estimator_quotes SET landed_cost_per_meter = 1 WHERE id = $1', [id]))
        expect(update.message).toContain('Historical costing snapshots are immutable')
        const remove = await pgError(db.query('DELETE FROM public.estimator_quotes WHERE id = $1', [id]))
        expect(remove.message).toBe('Historical costing snapshots cannot be deleted. Archive the snapshot instead.')
        expect((await price(id))?.price).toBe(31.44)
    })

    it('CHARACTERIZATION: rows that are not costings (legacy quotations) are not protected', async () => {
        const id = await seedCosting('quotation')
        await asServiceRole(db)
        await db.query('UPDATE public.estimator_quotes SET quote_price_per_meter = 40 WHERE id = $1', [id])
        expect((await price(id))?.price).toBe(40)
    })

    it('CHARACTERIZATION CS-8: the account-deletion setting bypasses the rule for any SQL session that sets it', async () => {
        const id = await seedCosting()
        await asUser(db, owner.userId, owner.orgId)
        await db.query("SELECT set_config('app.account_deletion', 'true', false)")
        await db.query('UPDATE public.estimator_quotes SET quote_price_per_meter = 40 WHERE id = $1', [id])
        await db.query("SELECT set_config('app.account_deletion', '', false)")
        expect((await price(id))?.price).toBe(40)
    })
})
