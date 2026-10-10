import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Custom document branding (20261010190000): only the service role reaches the
// tables and RPCs; an organization has at most one active logo, and only a
// processed logo of its own can become active.

let db: Db
let owner: { userId: string; orgId: string }
let other: { userId: string; orgId: string }

async function readyAsset(orgId: string, options: { svg?: boolean } = {}) {
    const id = randomUUID()
    await asSuperuser(db)
    await db.query(
        `INSERT INTO public.document_branding_logo_assets
            (id, org_id, status, original_object_path, fallback_object_path, svg_object_path, svg_raster_object_path,
             source_mime_type, source_size_bytes, width, height, display_width, display_height, recommended_variant)
         VALUES ($1, $2, 'ready_for_review', $3, $4, $5, $6, 'image/png', 1000, 400, 200, 400, 200, 'raster')`,
        [id, orgId, `${orgId}/logos/${id}/original.png`, `${orgId}/logos/${id}/fallback.png`,
            options.svg ? `${orgId}/logos/${id}/approved.svg` : null, options.svg ? `${orgId}/logos/${id}/approved-svg.png` : null],
    )
    return id
}

async function statuses(orgId: string) {
    await asSuperuser(db)
    const { rows } = await db.query('SELECT id, status, selected_variant FROM public.document_branding_logo_assets WHERE org_id = $1', [orgId])
    return Object.fromEntries(rows.map((row: { id: string; status: string; selected_variant: string | null }) => [row.id, { status: row.status, variant: row.selected_variant }]))
}

async function activeLogo(orgId: string) {
    await asSuperuser(db)
    const { rows: [row] } = await db.query('SELECT active_logo_asset_id FROM public.document_branding_settings WHERE org_id = $1', [orgId])
    return row?.active_logo_asset_id ?? null
}

beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: 'lite' })
    other = await seedOwnerOrg(db, { tier: 'lite' })
})
afterAll(async () => { await db?.end() })

describe('document branding', () => {
    it('keeps the tables and RPCs away from signed-in users', async () => {
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT * FROM public.document_branding_settings'))).code).toBe('42501')
        expect((await pgError(db.query('SELECT * FROM public.document_branding_logo_assets'))).code).toBe('42501')
        expect((await pgError(db.query('SELECT public.clear_document_branding_logo($1, $2)', [owner.orgId, owner.userId]))).code).toBe('42501')
    })

    it('activates a reviewed logo and supersedes the previous one', async () => {
        const first = await readyAsset(owner.orgId)
        const second = await readyAsset(owner.orgId, { svg: true })
        await asServiceRole(db)
        await db.query('SELECT public.activate_document_branding_logo($1, $2, $3, $4)', [owner.orgId, first, 'raster', owner.userId])
        expect(await activeLogo(owner.orgId)).toBe(first)
        await asServiceRole(db)
        await db.query('SELECT public.activate_document_branding_logo($1, $2, $3, $4)', [owner.orgId, second, 'svg', owner.userId])
        expect(await activeLogo(owner.orgId)).toBe(second)
        const rows = await statuses(owner.orgId)
        expect(rows[first].status).toBe('superseded')
        expect(rows[second]).toEqual({ status: 'active', variant: 'svg' })
    })

    it('refuses the vector version when tracing produced none', async () => {
        const asset = await readyAsset(owner.orgId)
        await asServiceRole(db)
        expect((await pgError(db.query('SELECT public.activate_document_branding_logo($1, $2, $3, $4)', [owner.orgId, asset, 'svg', owner.userId]))).message).toBeTruthy()
    })

    it("refuses another organization's logo", async () => {
        const foreign = await readyAsset(other.orgId)
        const before = await activeLogo(owner.orgId)
        await asServiceRole(db)
        expect((await pgError(db.query('SELECT public.activate_document_branding_logo($1, $2, $3, $4)', [owner.orgId, foreign, 'raster', owner.userId]))).message).toBeTruthy()
        expect(await activeLogo(owner.orgId)).toBe(before)
    })

    it('allows only one active logo per organization', async () => {
        const asset = await readyAsset(owner.orgId)
        await asSuperuser(db)
        expect((await pgError(db.query("UPDATE public.document_branding_logo_assets SET status = 'active', selected_variant = 'raster', approved_at = now() WHERE id = $1", [asset]))).code).toBe('23505')
    })

    it('clears the active logo', async () => {
        await asServiceRole(db)
        await db.query('SELECT public.clear_document_branding_logo($1, $2)', [owner.orgId, owner.userId])
        expect(await activeLogo(owner.orgId)).toBeNull()
        const rows = await statuses(owner.orgId)
        expect(Object.values(rows).some(row => row.status === 'active')).toBe(false)
    })

    it('rejects a malformed GSTIN', async () => {
        await asSuperuser(db)
        expect((await pgError(db.query("UPDATE public.document_branding_settings SET gstin = 'NOT-A-GSTIN' WHERE org_id = $1", [owner.orgId]))).code).toBe('23514')
    })
})
