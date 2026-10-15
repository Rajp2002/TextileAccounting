/** Disposable loopback-only browser/SQL harness. Substitutes server transport,
 * never production authentication. RLS and real RPCs run as the local fixture owner. */
import { createServer } from 'vite'
import pg from 'pg'
pg.types.setTypeParser(1700, Number)
// Match PostgREST: calendar dates are strings, never timezone-shifted instants.
pg.types.setTypeParser(1082, (value) => value)
import path from 'node:path'
const url = new URL(process.env.STOCK_TEST_DATABASE_URL || '')
if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^\/weavly_stock_test_\d+$/.test(url.pathname)
)
    throw new Error('Disposable local database required')
const root = path.resolve('scripts/qa/challan-browser')
const server = await createServer({
    root,
    configFile: false,
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: [
            {
                find: '@/app/actions/tour-preferences',
                replacement: path.join(root, 'tour-preferences.ts'),
            },
            { find: '@', replacement: process.cwd() },
            {
                find: 'next/navigation',
                replacement: path.join(root, 'navigation.ts'),
            },
            { find: 'next/link', replacement: path.join(root, 'link.tsx') },
        ],
    },
    plugins: [
        {
            name: 'challan-test-transport',
            enforce: 'pre',
            resolveId(source, importer) {
                if (
                    source === './challan-actions' &&
                    importer?.endsWith('/owner/dispatches/ChallansClient.tsx')
                )
                    return path.join(root, 'actions.ts')
            },
        },
        {
            name: 'challan-local-db',
            configureServer(vite) {
                vite.middlewares.use('/local-challan', async (req, res) => {
                    if (req.method !== 'POST') {
                        res.statusCode = 405
                        res.end()
                        return
                    }
                    const db = new pg.Client({ connectionString: url.href })
                    try {
                        let raw = ''
                        for await (const c of req) raw += c
                        if (raw.length > 220000)
                            throw new Error('Request too large')
                        const x = JSON.parse(raw || '{}')
                        await db.connect()
                        await db.query('set role authenticated')
                        await db.query(
                            'select set_config(\'request.jwt.claim.sub\',\'10000000-0000-4000-8000-000000000001\',false),set_config(\'request.jwt.claims\',\'{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}\',false)',
                        )
                        let out
                        if (req.url === '/list')
                            out = {
                                data: (
                                    await db.query(
                                        "select * from delivery_challans where (archived_at is not null)=$1 and (number ilike $2 or document->>'customer_name' ilike $2) order by created_at desc,id desc limit 50 offset $3",
                                        [x.history, `%${x.search}%`, x.offset],
                                    )
                                ).rows,
                            }
                        else if (req.url === '/get')
                            out = {
                                data: (
                                    await db.query(
                                        'select * from delivery_challans where id=$1',
                                        [x.id],
                                    )
                                ).rows[0],
                                events: (
                                    await db.query(
                                        'select * from delivery_challan_events where challan_id=$1 order by created_at,id',
                                        [x.id],
                                    )
                                ).rows,
                            }
                        else if (req.url === '/stock') {
                            out = (
                                await db.query(
                                    'select get_quality_stock_board() data',
                                )
                            ).rows[0].data
                            out.legacy = (
                                await db.query(
                                    'select id,quality_id,basis,balance_meters,basis_meters,basis_at,dispatched_meters,onboarded_meters,status,started_at,closed_at,version from legacy_stock',
                                )
                            ).rows.map((row) => ({
                                ...row,
                                balance_meters:
                                    row.balance_meters === null
                                        ? null
                                        : Number(row.balance_meters),
                                basis_meters:
                                    row.basis_meters === null
                                        ? null
                                        : Number(row.basis_meters),
                                dispatched_meters: Number(row.dispatched_meters),
                                onboarded_meters: Number(row.onboarded_meters),
                            }))
                        }
                        else if (req.url === '/mutate') {
                            const result = (
                                await db.query(
                                    'select mutate_delivery_challan($1,$2,$3,$4,$5) data',
                                    [
                                        x.id,
                                        x.requestId,
                                        x.version,
                                        x.action,
                                        x.payload,
                                    ],
                                )
                            ).rows[0].data
                            out = { success: true, id: result.id }
                        } else throw new Error('Unknown endpoint')
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify(out))
                    } catch (e) {
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ error: e.message }))
                    } finally {
                        await db.end()
                    }
                })
            },
        },
    ],
    server: {
        host: '127.0.0.1',
        port: 4180,
        strictPort: true,
        fs: { allow: [process.cwd()] },
    },
})
await server.listen()
console.log('Challan browser harness: http://127.0.0.1:4180')
