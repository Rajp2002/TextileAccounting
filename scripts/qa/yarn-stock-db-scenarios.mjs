import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

export async function testYarnStock({ admin, a, b, outsider, floor, org, test, saveProduction }) {
    let quote = '30000000-0000-4000-8000-000000000001'
    const quality = (await admin.query("select id from quality_stock where org_id=$1 and quality_key='cotton'", [org])).rows[0].id
    const rpc = async (db, action, payload, request = randomUUID()) => (await db.query('select mutate_yarn_stock($1,$2,$3) result', [request, action, payload])).rows[0].result
    const board = async (db = a, date = null, yarn = null, cursor = null) => (await db.query('select get_yarn_stock_board($1,$2,$3,$4) result', [date, yarn, cursor?.at ?? null, cursor?.id ?? null])).rows[0].result
    const weights = async () => Object.fromEntries((await board()).yarns.map(row => [row.yarn_key, Number(row.weight_kg)]))
    const mutation = async (id, action, payload = {}, db = a, request = randomUUID(), version) => {
        const current = version ?? (await admin.query('select version from delivery_challans where id=$1', [id])).rows[0]?.version ?? 0
        return (await db.query('select mutate_delivery_challan($1,$2,$3,$4,$5) result', [id, request, current, action, payload])).rows[0].result
    }
    const draft = async (meters = 100) => {
        const id = randomUUID()
        await mutation(id, 'save', { quality_id: quality, selling_rate: 40, document: { date: '2026-09-12', sender_name: 'Local yarn fixture', sender_address: 'Surat', customer_name: 'Local receiver', customer_address: 'Ahmedabad', delivery_address: 'Warehouse' }, lines: [{ lot: '001', meters }] })
        return id
    }
    const snapshot = (warp = 12, weft = 8) => ({ audit: { warp: { layers: [{ name: 'Warp Yarn 1', finalKgPer100m: warp }] }, weft: { layers: [{ name: 'Weft Yarn 1', finalKgPer100m: weft }] } } })
    const newCosting = async data => {
        const id = randomUUID()
        await admin.query("insert into estimator_quotes(id,org_id,record_kind,quality_label,yarn_denier,meters,yarn_rate_per_kg,landed_cost_per_meter,quote_price_per_meter,intended_margin_percent,worker_rate_per_m,costing_result_snapshot) values($1,$2,'costing','Cotton',100,1000,100,20,40,50,2,$3)", [id, org, data])
        return id
    }
    const entry = (name, kg, expected) => ({ yarn_name: name, weight_kg: kg, reason: 'Verified local yarn fixture', ...(expected === undefined ? {} : { expected_kg: expected }) })
    const link = (version = 0, costingId = quote, db = a, request) => rpc(db, 'recipe', { quality_id: quality, costing_id: costingId, expected_version: version, reason: 'Verified fabric recipe' }, request)
    await admin.query('update quality_stock set meters=10000 where id=$1', [quality])
    const oldDispatch = await draft()
    await mutation(oldDispatch, 'confirm')
    await admin.query(readFileSync('supabase/migrations/20260912131633_yarn_stock_until_dispatch.sql', 'utf8'))
    await test('yarn cutover does not import legacy issues or deduct historical dispatches', async () => {
        assert.equal((await board()).started_at, null)
        assert.deepEqual(await weights(), {})
        assert.ok((await admin.query('select count(*)::int n from delivery_challans')).rows[0].n > 0)
    })
    await test('costing links require a complete named weight snapshot and tenant-matched quality', async () => {
        await assert.rejects(link(), /fresh costing/)
        quote = await newCosting(snapshot())
        const request = randomUUID()
        await link(0, quote, a, request)
        assert.equal((await link(0, quote, a, request)).duplicate, true)
        await assert.rejects(link(), /formula changed/)
        assert.equal((await board()).qualities.find(row => row.id === quality).recipe[0].kg_per_100m, 12)
    })
    await test('opening and receipts are additive, normalized and retry-safe', async () => {
        const request = randomUUID()
        await rpc(a, 'opening', entry('  WARP   Yarn 1  ', 100), request)
        assert.equal((await rpc(a, 'opening', entry('  WARP   Yarn 1  ', 100), request)).duplicate, true)
        await assert.rejects(rpc(a, 'opening', entry('Warp Yarn 1', 100)), /already recorded/)
        await assert.rejects(rpc(a, 'receipt', entry('Warp Yarn 1', 10), request), /different details/)
        await rpc(a, 'receipt', entry('Warp Yarn 1', 50))
        await rpc(a, 'opening', entry('Weft Yarn 1', 100))
        assert.deepEqual(await weights(), { 'warp yarn 1': 150, 'weft yarn 1': 100 })
    })
    await test('production, draft saves, and printing leave total yarn owned unchanged', async () => {
        const before = await weights()
        await saveProduction()
        const id = await draft()
        await admin.query('select * from delivery_challans where id=$1', [id])
        assert.deepEqual(await weights(), before)
    })
    let sent
    await test('100m confirmation deducts each yarn exactly once through the real challan RPC', async () => {
        sent = await draft(); const request = randomUUID()
        await mutation(sent, 'confirm', {}, a, request, 1)
        await mutation(sent, 'confirm', {}, a, request, 1)
        assert.deepEqual(await weights(), { 'warp yarn 1': 138, 'weft yarn 1': 92 })
        assert.equal((await admin.query("select count(*)::int n from yarn_stock_movements where challan_id=$1 and kind='dispatch'", [sent])).rows[0].n, 2)
    })
    await test('costing edits do not rewrite the linked recipe or a previous deduction', async () => {
        await assert.rejects(admin.query('update estimator_quotes set costing_result_snapshot=$1 where id=$2', [snapshot(30, 10), quote]), /immutable/)
        quote = await newCosting(snapshot(30, 10))
        assert.equal((await board()).qualities.find(row => row.id === quality).recipe[0].kg_per_100m, 12)
        await link(1)
        const deduction = (await admin.query("select recipe_snapshot from yarn_stock_movements where challan_id=$1 and kind='dispatch' limit 1", [sent])).rows[0].recipe_snapshot
        assert.equal(deduction.recipe[0].kg_per_100m, 12)
        await mutation(sent, 'reverse_dispatch', { stock_present: true, reason: 'All fabric returned before receipt' })
        assert.deepEqual(await weights(), { 'warp yarn 1': 150, 'weft yarn 1': 100 })
        await assert.rejects(mutation(sent, 'reverse_dispatch', { stock_present: true, reason: 'Repeated reversal' }), /unreceived/)
    })
    await test('pre-tracking reversal cannot invent yarn stock', async () => {
        const before = await weights()
        await mutation(oldDispatch, 'reverse_dispatch', { stock_present: true, reason: 'Historical fabric is physically back' })
        assert.deepEqual(await weights(), before)
    })
    await test('receipt differences and payments do not change yarn after dispatch', async () => {
        const id = await draft(); await mutation(id, 'confirm'); const before = await weights()
        await mutation(id, 'receipt', { meters: 98 })
        await mutation(id, 'resolve', { decision: 'accepted', reason: 'Receiver verified measurement' })
        await mutation(id, 'payment', { amount: 3920, date: '2026-09-12', method: 'cash', reason: 'Received full payment' })
        assert.deepEqual(await weights(), before)
    })
    await test('missing recipe blocks dispatch atomically once yarn tracking starts', async () => {
        const id = await draft(), before = await weights()
        const recipe = (await admin.query('delete from yarn_stock_recipes where org_id=$1 and quality_id=$2 returning *', [org, quality])).rows[0]
        const fabric = (await admin.query('select meters from quality_stock where id=$1', [quality])).rows[0].meters
        await assert.rejects(mutation(id, 'confirm'), /Link a saved costing/)
        assert.deepEqual(await weights(), before)
        assert.equal((await admin.query('select meters from quality_stock where id=$1', [quality])).rows[0].meters, fabric)
        assert.equal((await admin.query('select delivery_status from delivery_challans where id=$1', [id])).rows[0].delivery_status, 'draft')
        await admin.query('insert into yarn_stock_recipes(org_id,quality_id,costing_id,recipe,version) values($1,$2,$3,$4,$5)', [org, quality, quote, JSON.stringify(recipe.recipe), recipe.version])
    })
    await test('insufficient later yarn rolls back earlier yarn deductions and fabric', async () => {
        const before = await weights(); await rpc(a, 'correction', entry('Weft Yarn 1', 0, before['weft yarn 1']))
        const id = await draft(), fabric = (await admin.query('select meters from quality_stock where id=$1', [quality])).rows[0].meters
        await assert.rejects(mutation(id, 'confirm'), /Insufficient yarn stock/)
        assert.equal((await weights())['warp yarn 1'], before['warp yarn 1'])
        assert.equal((await admin.query('select meters from quality_stock where id=$1', [quality])).rows[0].meters, fabric)
        assert.equal((await admin.query('select count(*)::int n from yarn_stock_movements where challan_id=$1', [id])).rows[0].n, 0)
        await rpc(a, 'receipt', entry('Weft Yarn 1', 100))
    })
    await test('concurrent partial dispatches serialize and cannot overdraw a yarn', async () => {
        let before = await weights(); await rpc(a, 'correction', entry('Warp Yarn 1', 30, before['warp yarn 1']))
        const first = await draft(60), second = await draft(60)
        const results = await Promise.allSettled([mutation(first, 'confirm', {}, a), mutation(second, 'confirm', {}, b)])
        assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
        assert.equal((await weights())['warp yarn 1'], 12)
        const success = results[0].status === 'fulfilled' ? first : second
        await mutation(success, 'reverse_dispatch', { stock_present: true, reason: 'Returned local fixture fabric' })
    })
    await test('same named warp and weft layers share a balance and fractional metres keep precision', async () => {
        const combined = snapshot(1, 2); combined.audit.weft.layers[0].name = ' warp   yarn 1 '
        quote = await newCosting(combined); await link(2)
        const before = await weights(), id = await draft(0.01)
        await mutation(id, 'confirm')
        assert.equal((await weights())['warp yarn 1'], before['warp yarn 1'] - 0.0003)
        const records = (await admin.query("select kg_delta from yarn_stock_movements where challan_id=$1 and kind='dispatch'", [id])).rows
        assert.equal(records.length, 1); assert.equal(Number(records[0].kg_delta), -0.0003)
        await mutation(id, 'reverse_dispatch', { stock_present: true, reason: 'Returned small fabric fixture' })
        assert.deepEqual(await weights(), before)
    })
    await test('corrections reject stale balances, invalid weights and concurrent lost updates', async () => {
        const before = await weights(), kg = before['warp yarn 1']
        const results = await Promise.allSettled([rpc(a, 'correction', entry('Warp Yarn 1', kg + 1, kg)), rpc(b, 'correction', entry('Warp Yarn 1', kg + 2, kg))])
        assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
        await assert.rejects(rpc(a, 'receipt', entry('Warp Yarn 1', -1)), /valid kg/)
        await assert.rejects(rpc(a, 'receipt', entry('Warp Yarn 1', 0.0001)), /valid kg/)
    })
    await test('owner RLS, revoked access, locked tenants and direct write permissions are enforced', async () => {
        assert.deepEqual((await board(outsider)).yarns, [])
        await assert.rejects(board(floor), /owner access/)
        await assert.rejects(rpc(floor, 'receipt', entry('Warp Yarn 1', 1)), /owner access/)
        await assert.rejects(link(0, quote, outsider), /active saved costing/)
        assert.equal((await outsider.query('select * from yarn_stock_movements')).rowCount, 0)
        for (const table of ['yarn_stock','yarn_stock_movements','yarn_stock_recipes','yarn_stock_requests','yarn_stock_settings']) {
            await assert.rejects(a.query(`delete from ${table}`), /permission denied/)
        }
        await admin.query('update organizations set is_locked_down=true where id=$1', [org])
        await assert.rejects(rpc(a, 'receipt', entry('Warp Yarn 1', 1)), /locked|restricted/i)
        await admin.query('update organizations set is_locked_down=false where id=$1', [org])
        await admin.query("update profiles set access_revoked_at=now() where id='10000000-0000-4000-8000-000000000001'")
        await assert.rejects(board(), /owner access/)
        await admin.query("update profiles set access_revoked_at=null where id='10000000-0000-4000-8000-000000000001'")
        const anon = (await admin.query("select has_function_privilege('anon','public.mutate_yarn_stock(uuid,text,jsonb)','execute') allowed")).rows[0]
        assert.equal(anon.allowed, false)
    })
    await test('audit date uses India midnight and complete balances independent of history pages', async () => {
        await rpc(a, 'opening', entry('Audit fixture', 10))
        await rpc(a, 'receipt', entry('Audit fixture', 5))
        const yarn = (await board()).yarns.find(row => row.yarn_key === 'audit fixture').id
        await admin.query("update yarn_stock_movements set created_at=case when kind='opening' then '2026-03-31 18:29:59+00'::timestamptz else '2026-03-31 18:30:00+00'::timestamptz end where yarn_id=$1", [yarn])
        assert.equal((await board(a, '2026-03-31')).yarns.find(row => row.id === yarn).weight_kg, 10)
        assert.equal((await board(a, '2026-04-01')).yarns.find(row => row.id === yarn).weight_kg, 15)
        for (let i = 0; i < 55; i++) await rpc(a, 'receipt', entry('Audit fixture', 1))
        const seen = new Set(); let cursor = null
        for (;;) {
            const page = await board(a, null, yarn, cursor)
            assert.equal(page.yarns.find(row => row.id === yarn).weight_kg, 70)
            for (const movement of page.movements.slice(0, 50)) { assert.ok(!seen.has(movement.id)); seen.add(movement.id) }
            if (page.movements.length <= 50) break
            cursor = { at: page.movements[49].created_at, id: page.movements[49].id }
        }
        assert.equal(seen.size, 57)
    })
}
