// Explicitly synthetic transport. No credentials, auth, provider or database.
import { createServer } from 'vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit --enable-synthetic-fixtures required')
const fixtureRoot = path.resolve('scripts/qa/lite-estimator-browser')
const explicitSource = process.argv.find(arg => arg.startsWith('--source-root='))?.slice(14)
const sourceRoot = explicitSource ? path.resolve(explicitSource) : process.argv.includes('--baseline') ? '/tmp/weavly-lite-baseline-34f37ce2' : process.cwd()
const port = process.argv.includes('--baseline') ? 4196 : 4197
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
const qualities = async () => (await examples()).map((example,index) => ({id: `22222222-2222-4222-8222-${String(index+1).padStart(12,'0')}`,name: index ? 'Synthetic Quality B — twill customer order' : 'Synthetic Quality A — Surat plain weave with a long identifiable fabric recipe name', updated_at:'2026-10-01T00:00:00Z',is_active:true,warp_rows:example.estimate.warpRows,weft_rows:example.estimate.weftRows,per_pick_cost_paise:example.estimate.perPickCostPaisa,overhead_override_per_m:3,warp_crimp_pct:0,yarn_shortage_pct:0}))
const paidReceipts = new Map()
let paidSaveCount = 0
let mutableQualities = null
let secondaryRequests = 0
const currentQualities = async () => mutableQualities ?? (mutableQualities = await qualities())
const examples = async () => (await server.ssrLoadModule(path.join(sourceRoot, 'lib/saved-costings-tour.ts'))).makeSavedCostingTourExamples()

server = await createServer({
    root: fixtureRoot, cacheDir: `/tmp/weavly-lite-estimator-vite-${port}`, publicDir: path.join(sourceRoot, 'public'), configFile: false, mode: 'development', esbuild: { jsx: 'automatic' },
    // Freeze dependency discovery before scenarios start. Opening the real
    // export dialog must not invalidate already loaded modules mid-flow.
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'sonner', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-label', '@radix-ui/react-slot', '@radix-ui/react-switch', 'class-variance-authority', 'clsx', 'date-fns', 'date-fns-tz', 'decimal.js', 'jspdf', 'lucide-react', 'nanoid', 'tailwind-merge', 'web-vitals'] },
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
        return names.map(name => `export async function ${name}(...args){ const response = await fetch('/__fixture__/action/${name}', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({args})}); const answer = await response.json(); if(!response.ok) throw new Error(answer.error || 'Synthetic response lost'); return answer; }`).join('\n')
    } }, { name: 'synthetic-free-api', configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
            const url = new URL(request.url, origin)
            if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__fixture__/')) return next()
            if (request.headers.origin && request.headers.origin !== origin) return json(response, { code: 'FIXTURE_ORIGIN_DENIED' }, 403)
            const scenario = url.searchParams.get('scenario') ?? new URL(request.headers.referer ?? origin).searchParams.get('scenario') ?? 'normal'
            try {
                if (url.pathname === '/__fixture__/reset') { identity = 0; requestId = newId(); used = 0; paidActivated = false; requests.length = 0; receipts.clear(); savedRows.clear(); paidReceipts.clear(); paidSaveCount=0; mutableQualities=null; secondaryRequests=0; return json(response, { ok: true }) }
                if (url.pathname === '/__fixture__/templates') return json(response, scenario==='qualities-empty' ? [] : await currentQualities())
                if (url.pathname === '/__fixture__/requests') return json(response, requests)
                if (url.pathname === '/__fixture__/saved') { const example = (await examples())[0]; return json(response, { ...example, revision: 1, updated_at: new Date().toISOString(), editWindow: editWindow(example.id) }) }
                const body = await bodyOf(request)
                requests.push({ path: url.pathname, method: request.method, body })
                if (url.pathname.startsWith('/__fixture__/action/')) {
                    const name = url.pathname.split('/').at(-1), args = body.args ?? []
                    if (name === 'getEstimatorTemplates') return json(response,{data:await currentQualities(),error:null})
                    if (name === 'getEstimatorSecondaryData') {
                        secondaryRequests++
                        if (scenario==='qualities-failed' && secondaryRequests===1) return json(response,{error:'Synthetic quality loading failed'})
                        if (scenario==='qualities-loading') await new Promise(resolve=>setTimeout(resolve,1000))
                        return json(response,{templates:scenario==='qualities-empty' ? [] : await currentQualities(),workers:[],rateBookYarns:[],staleDefaultRateNames:[]})
                    }
                    if (name === 'updateTemplateRates') {
                        await new Promise(resolve=>setTimeout(resolve,300))
                        const proposal=args[0], current=await currentQualities(), index=current.findIndex(template=>template.id===proposal.id)
                        if (index<0) return json(response,{error:'Synthetic missing quality'})
                        if (scenario==='rate-rejected') return json(response,{error:'Synthetic definite rate rejection'})
                        if (scenario!=='rate-unknown-not-applied') mutableQualities=current.map((template,i)=>i===index ? {...template,warp_rows:proposal.warpRows,weft_rows:proposal.weftRows,updated_at:new Date().toISOString()} : template)
                        if (scenario.startsWith('rate-unknown')) return json(response,{error:'Synthetic rate response lost'},503)
                        return json(response,{error:null,updatedAt:mutableQualities[index].updated_at})
                    }
                    if (name === 'saveEstimatorQuoteV3') {
                        await new Promise(resolve=>setTimeout(resolve,300))
                        const request = args[0], previous = paidReceipts.get(request.clientRequestId)
                        if (previous) return json(response,previous.answer)
                        if (scenario === 'rejected') return json(response,{success:false,error:'Synthetic definite rejection'})
                        const source = [...paidReceipts.values()].find(saved => saved.answer.quoteId === request.sourceQuoteId)
                        if (source && JSON.stringify(source.request.estimate) === JSON.stringify(request.estimate) && source.request.qualityLabel === request.qualityLabel) {
                            const answer = {...source.answer,noChange:true}
                            paidReceipts.set(request.clientRequestId,{answer,receipt:source.receipt,request})
                            return json(response,answer)
                        }
                        const stamp = new Date().toISOString(), version=++paidSaveCount
                        const id = `33333333-3333-4333-8333-${String(version).padStart(12,'0')}`
                        const answer = {success:true,quoteId:id,versionNumber:version,updatedAt:stamp,createdAt:stamp}
                        const receipt = {id,version_number:version,updated_at:stamp,created_at:stamp,record_kind:'costing'}
                        paidReceipts.set(request.clientRequestId,{answer,receipt,request})
                        if (scenario.startsWith('unknown')) return json(response,{error:'Synthetic response lost after commit'},503)
                        return json(response,answer)
                    }
                    if (name === 'getCostingSaveReceipt') return json(response,scenario==='unknown-retry' ? {status:'not_found'} : paidReceipts.has(args[0]) ? {status:'saved',receipt:paidReceipts.get(args[0]).receipt} : {status:'not_found'})
                    return json(response,{error:null,data:[],success:true,templates:await qualities(),workers:[],rateBookYarns:[],staleDefaultRateNames:[]})
                }
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
                if (url.pathname === '/api/analytics/plan-events') return json(response, { ok: true })
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
console.info(`Synthetic Lite estimator fixture only: ${origin}/free/estimator (${sourceRoot})`)
