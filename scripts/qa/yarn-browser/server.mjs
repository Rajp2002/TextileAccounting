// Only a retained disposable fixture database is accepted. No production auth bypass.
import { createServer } from 'vite'
import pg from 'pg'
import path from 'node:path'
const url = new URL(process.env.STOCK_TEST_DATABASE_URL || '')
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !/^\/weavly_stock_test_\d+$/.test(url.pathname)) throw new Error('Only a disposable local stock-test database is permitted.')
const root = path.resolve('scripts/qa/yarn-browser')
const server = await createServer({ root, configFile: false, esbuild: { jsx: 'automatic' },
    resolve: { alias: [{ find: '@', replacement: process.cwd() }, { find: 'next/navigation', replacement: path.resolve('scripts/qa/stock-browser/navigation.ts') }, { find: 'next/link', replacement: path.resolve('scripts/qa/stock-browser/link.tsx') }] },
    plugins: [{ name: 'local-yarn-actions', enforce: 'pre', resolveId(source, importer) {
        if (source === './yarn-actions' && importer?.endsWith('/owner/stock/YarnStockClient.tsx')) return path.join(root, 'actions.ts')
    } }, { name: 'local-yarn-db', configureServer(vite) { vite.middlewares.use('/local-yarn', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const db = new pg.Client({ connectionString: url.href })
        try {
            let raw = ''; for await (const chunk of req) raw += chunk
            const input = JSON.parse(raw || '{}'); await db.connect(); await db.query('set role authenticated')
            await db.query("select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false),set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"10000000-0000-4000-8000-000000000001\"}',false)")
            let output
            if (req.url === '/read') {
                const data = (await db.query('select get_yarn_stock_board($1,$2,$3,$4) result', [input.asOf ?? null, input.yarnId ?? null, input.cursor?.at ?? null, input.cursor?.id ?? null])).rows[0].result
                const more = data.movements.length > 50; data.movements = data.movements.slice(0, 50); const last = data.movements.at(-1)
                data.nextCursor = more ? { at: last.created_at, id: last.id } : null; output = { data }
            } else if (req.url === '/save') {
                await db.query('select mutate_yarn_stock($1,$2,$3)', [input.requestId, input.action, input.payload]); output = { success: true }
            } else throw new Error('Unknown local endpoint')
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(output))
        } catch (error) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message, uncertain: !['22023','40001','42501','22P02'].includes(error.code) })) }
        finally { await db.end() }
    }) } }], server: { host: '127.0.0.1', port: 4181, strictPort: true, fs: { allow: [process.cwd()] } } })
await server.listen(); console.log('Local yarn harness: http://127.0.0.1:4181')
