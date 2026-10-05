// Explicitly synthetic transport. No credentials, auth, provider or database.
import { createServer } from 'vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit --enable-synthetic-fixtures required')
const fixtureRoot = path.resolve('scripts/qa/free-mobile-browser')
const explicitSource = process.argv.find(arg => arg.startsWith('--source-root='))?.slice(14)
const sourceRoot = explicitSource ? path.resolve(explicitSource) : process.argv.includes('--baseline') ? '/tmp/weavly-mobile-baseline-cf00bf46' : process.cwd()
const port = process.argv.includes('--baseline') ? 4187 : 4190
const origin = `http://127.0.0.1:${port}`
const requests = []
let server
const token = id => `${Buffer.from(JSON.stringify({ requestId: id })).toString('base64url')}.synthetic-signature`
let identity = 0
const newId = () => `11111111-1111-4111-8111-${String(++identity).padStart(12, '0')}`
let requestId = newId()
let used = 0
let paidActivated = false
const receipts = new Map()
const savedRows = new Map()
const json = (response, body, status = 200) => { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body)) }
const quota = (remaining = 2 - used) => ({ used: 2 - remaining, remaining, limit: 2, periodStart: '2026-10-01T00:00:00Z', resetsAt: '2026-11-01T00:00:00Z', policyVersion: 1, replayed: false })
const editWindow = (_id, revision = 1) => ({ revision, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), editExpiresAt: new Date(Date.now() + 1800000).toISOString(), serverTime: new Date().toISOString() })
const bodyOf = async request => { let text = ''; for await (const chunk of request) text += chunk; return text ? JSON.parse(text) : {} }
const examples = async () => (await server.ssrLoadModule(path.join(sourceRoot, 'lib/saved-costings-tour.ts'))).makeSavedCostingTourExamples()

server = await createServer({
    root: fixtureRoot, cacheDir: `/tmp/weavly-free-mobile-vite-${port}`, publicDir: path.join(sourceRoot, 'public'), configFile: false, mode: 'development', esbuild: { jsx: 'automatic' },
    css: { postcss: { plugins: [(await import('@tailwindcss/postcss')).default()] } },
    resolve: { alias: [
        { find: '@/lib/supabase/client', replacement: path.join(fixtureRoot, 'supabase.ts') },
        ...['link', 'navigation', 'dynamic', 'image'].map(name => ({ find: `next/${name}`, replacement: path.join(fixtureRoot, `${name}.${['navigation'].includes(name) ? 'ts' : 'tsx'}`) })),
        { find: '@', replacement: sourceRoot },
    ] },
    plugins: [{ name: 'synthetic-server-action-boundary', enforce: 'pre', load(id) {
        if (!id.endsWith('.ts') && !id.endsWith('.tsx')) return
        let source
        try { source = readFileSync(id, 'utf8') } catch { return }
        if (!/^\s*(['"])use server\1/.test(source)) return
        const names = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match => match[1])
        return names.map(name => `export async function ${name}(){ return { error: null, data: [], templates: [], workers: [], rateBookYarns: [], staleDefaultRateNames: [] } }`).join('\n')
    } }, { name: 'synthetic-free-api', configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
            const url = new URL(request.url, origin)
            if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__fixture__/')) return next()
            if (request.headers.origin && request.headers.origin !== origin) return json(response, { code: 'FIXTURE_ORIGIN_DENIED' }, 403)
            const scenario = url.searchParams.get('scenario') ?? new URL(request.headers.referer ?? origin).searchParams.get('scenario') ?? 'normal'
            try {
                if (url.pathname === '/__fixture__/reset') { identity = 0; requestId = newId(); used = 0; paidActivated = false; requests.length = 0; receipts.clear(); savedRows.clear(); return json(response, { ok: true }) }
                if (url.pathname === '/__fixture__/requests') return json(response, requests)
                if (url.pathname === '/__fixture__/saved') { const example = (await examples())[0]; return json(response, { ...example, revision: 1, updated_at: new Date().toISOString(), editWindow: editWindow(example.id) }) }
                const body = await bodyOf(request)
                requests.push({ path: url.pathname, method: request.method, body })
                if (url.pathname === '/api/free/status') {
                    if (scenario === 'balance-failure' && used > 0) return json(response, { code: 'FREE_TEMPORARY_ERROR' }, 503)
                    return json(response, { serverTime: new Date().toISOString(), plan: paidActivated ? 'lite' : 'free', accessState: paidActivated ? 'paid' : 'active', estimationEnabled: true, tourEnabled: false, tourState: 'done', requestToken: paidActivated ? null : token(requestId), quota: quota(['zero', 'correction'].includes(scenario) ? 0 : 2 - used), account: { id: 'synthetic-owner', name: 'Synthetic Owner', email: 'synthetic@example.invalid', organizationName: 'Synthetic Textile' } })
                }
                if (url.pathname === '/api/free/costings') return json(response, { serverTime: new Date().toISOString(), costings: scenario === 'empty-history' ? [] : [...savedRows.values(), ...await examples()], nextPage: null })
                if (url.pathname === '/api/free/calculate') {
                    await new Promise(resolve => setTimeout(resolve, 350))
                    const id = JSON.parse(Buffer.from(body.requestToken.split('.')[0], 'base64url').toString()).requestId
                    const previous = receipts.get(id)
                    if (previous) return json(response, { ...previous, quota: { ...previous.quota, replayed: true } })
                    if (scenario === 'warning' && !body.warningsAcknowledged) return json(response, { needsAcknowledgement: true, warningFields: ['fabricWidthCm'] })
                    const engine = await vite.ssrLoadModule(path.join(sourceRoot, 'lib/estimator.ts'))
                    const totals = engine.calcFullTotals(body.estimate)
                    const result = engine.buildCostingResult(body.estimate, totals)
                    const correction = Boolean(body.costingId)
                    if (!correction) used++
                    const saved = { requestId: id, savedCostingId: body.costingId ?? id, result, totals, quota: quota(['zero', 'correction'].includes(scenario) ? 0 : 2 - used), costingsUsed: correction ? 0 : 1, editWindow: editWindow(body.costingId ?? id, correction ? (body.expectedRevision ?? 1) + 1 : 1) }
                    receipts.set(id, saved); requestId = newId()
                    savedRows.set(saved.savedCostingId, { id: saved.savedCostingId, label: body.label, estimate: body.estimate, result, totals, created_at: saved.editWindow.createdAt, updated_at: saved.editWindow.updatedAt, revision: saved.editWindow.revision, editWindow: saved.editWindow })
                    if (scenario === 'uncertain') return json(response, { code: 'FREE_TEMPORARY_ERROR' }, 503)
                    return json(response, saved)
                }
                if (url.pathname === '/api/free/events') return json(response, { ok: true })
                if (url.pathname === '/api/billing/create-order') return json(response, { orderId: 'order_synthetic', amount: 49900, currency: 'INR', keyId: 'synthetic', planName: 'Weavly Lite', purchaseType: 'new', clientRequestId: 'synthetic-order-request' })
                if (url.pathname === '/api/billing/status') {
                    if (scenario === 'upgrade-active') { paidActivated = true; return json(response, { state: 'activated', paymentId: 'pay_synthetic', orderId: 'order_synthetic', activeUntil: '2027-10-05T00:00:00Z' }) }
                    return json(response, { state: 'processing', orderId: 'order_synthetic' })
                }
                if (url.pathname === '/api/billing/checkout-state') return json(response, { ok: true })
                return json(response, { code: 'UNMOCKED_FIXTURE_ENDPOINT', path: url.pathname }, 501)
            } catch (error) { console.error('Synthetic fixture error:', error.message); return json(response, { code: 'FIXTURE_ERROR' }, 500) }
        })
    } }],
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: { ignored: ['**/*'] }, fs: { allow: [process.cwd(), sourceRoot] } },
})
await server.listen()
console.info(`Synthetic Free component fixture only: ${origin}/free/estimator (${sourceRoot})`)
