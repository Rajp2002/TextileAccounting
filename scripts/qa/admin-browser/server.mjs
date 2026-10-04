// Presentation-only, synthetic component harness. No product session, Auth
// bypass, credentials, service client, financial action or customer data.
import { createServer } from 'vite'
import path from 'node:path'
const root = path.resolve('scripts/qa/admin-browser')
const server = await createServer({
    root, configFile: false, esbuild: { jsx: 'automatic' },
    resolve: { alias: [
        ...['factories', 'payments', 'overview', 'system', 'audit'].map(name => ({ find: `@/lib/admin/${name}`, replacement: path.join(root, 'fixture-client.ts') })),
        { find: 'next/link', replacement: path.join(root, 'link.tsx') },
        { find: 'next/navigation', replacement: path.join(root, 'navigation.ts') },
        { find: '@', replacement: process.cwd() },
    ] },
    plugins: [{ name: 'synthetic-admin-read-fixtures', configureServer(vite) {
        vite.middlewares.use('/__admin_fixture__', async (req, res) => {
            if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
            const origin = req.headers.origin
            if (origin && origin !== 'http://127.0.0.1:4185') { res.statusCode = 403; res.end(); return }
            try {
                const url = new URL(req.url, 'http://127.0.0.1:4185')
                const input = Object.fromEntries(url.searchParams)
                const method = ({ '/factories': 'listFactories', '/factory-detail': 'getFactoryDetail', '/factory-summary': 'getFactorySummary', '/payments': 'getPaymentsReport', '/overview': 'getAdminOverview', '/system': 'getAdminSystem', '/audit': 'getAdminAudit' })[url.pathname]
                if (!method) { res.statusCode = 404; res.end(); return }
                const factory = method.startsWith('getFactory') || method === 'listFactories'
                const fixture = await vite.ssrLoadModule(factory ? '/fixture-data.ts' : '/report-fixtures.ts')
                const data = await fixture[method](method === 'getFactoryDetail' ? input.orgId : input)
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(JSON.stringify(data))
            } catch {
                res.statusCode = 503; res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ message: 'Synthetic fixture source unavailable.' }))
            }
        })
    } }],
    server: { host: '127.0.0.1', port: 4185, strictPort: true, fs: { allow: [process.cwd()] } },
})
await server.listen()
console.log('Synthetic admin component fixtures only: http://127.0.0.1:4185/admin/factories')
