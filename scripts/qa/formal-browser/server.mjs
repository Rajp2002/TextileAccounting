// Synthetic, loopback-only component response adapter. No environment-file
// loading, Auth clients, service credentials, database, delivery or purge.
import { createServer } from 'vite'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const root = path.resolve('scripts/qa/formal-browser'), sessions = new Map()
function cookieSession(req) {
    const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('synthetic-formal-session='))?.split('=')[1]
    return value && /^[0-9a-f-]{36}$/.test(value) ? value : 'unconfigured-fixture'
}
async function jsonBody(req) {
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > 32000) throw new Error('Fixture input too large') }
    return body ? JSON.parse(body) : {}
}
function json(res, status, data) {
    res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store')
    res.end(JSON.stringify(data))
}
function revisionValues(record) {
    return Object.fromEntries(['status', 'severity', 'identityState', 'identityEvidenceRef', 'acknowledgedAt', 'acknowledgementEvidenceRef', 'outcomeCode', 'outcomeSummary', 'outcomeEvidenceRef', 'responseRecordedAt', 'closedAt', 'nextAction', 'followUpDueAt', 'identityVerifiedAt'].map(key => [key, record[key] ?? null]).concat([['retainedProofHash', null]]))
}

const server = await createServer({
    root, configFile: false, esbuild: { jsx: 'automatic' },
    resolve: { alias: [
        { find: 'next/link', replacement: path.join(root, 'link.tsx') },
        { find: 'next/navigation', replacement: path.join(root, 'navigation.ts') },
        { find: '@', replacement: process.cwd() },
    ] },
    plugins: [{ name: 'synthetic-formal-component-fixtures', configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url, 'http://127.0.0.1:4190')
            const control = url.pathname.startsWith('/__formal_fixture__/'), mutation = url.pathname.startsWith('/api/admin/formal')
            if (!control && !mutation) { next(); return }
            if (req.headers.host !== '127.0.0.1:4190' || (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:4190')) { json(res, 403, { message: 'Loopback fixture only.' }); return }
            try {
                if (url.pathname === '/__formal_fixture__/health') { json(res, 200, { fixtureOnly: true }); return }
                const fixture = await vite.ssrLoadModule('/fixture-data.ts'), key = cookieSession(req)
                if (!sessions.has(key)) sessions.set(key, { details: { privacy: fixture.formalFixture('privacy'), security: fixture.formalFixture('security') }, attempts: [], committed: new Map(), steps: [] })
                let state = sessions.get(key), kind = url.searchParams.get('kind') === 'security' ? 'security' : 'privacy'
                if (url.pathname === '/__formal_fixture__/reset' && req.method === 'POST') {
                    const input = await jsonBody(req)
                    state = { details: { privacy: fixture.formalFixture('privacy', input.managed !== false), security: fixture.formalFixture('security', input.managed !== false) }, attempts: [], committed: new Map(), steps: [] }
                    sessions.set(key, state); json(res, 200, { fixtureOnly: true }); return
                }
                if (url.pathname === '/__formal_fixture__/scenario' && req.method === 'POST') {
                    const input = await jsonBody(req)
                    if (!Array.isArray(input.steps) || input.steps.some(step => !['commit_lost', 'throttle', 'success'].includes(step))) throw new Error('Invalid synthetic scenario')
                    state.steps = input.steps; json(res, 200, { fixtureOnly: true }); return
                }
                if (url.pathname === '/__formal_fixture__/detail' && req.method === 'GET') { json(res, 200, state.details[kind]); return }
                if (url.pathname === '/__formal_fixture__/attempts' && req.method === 'GET') { json(res, 200, { items: state.attempts, committedCount: state.committed.size }); return }
                if (url.pathname === '/__formal_fixture__/advance' && req.method === 'POST') {
                    const detail = state.details[kind]
                    detail.record = { ...detail.record, managed: true, version: 2, status: kind === 'privacy' ? 'acknowledged' : 'investigating',
                        nextAction: 'New synthetic parent context action', outcomeCode: 'response_recorded', outcomeSummary: 'New synthetic parent outcome context', outcomeEvidenceRef: 'fixture:parent-context-v2', responseRecordedAt: '2026-10-04T13:00:00.000Z' }
                    json(res, 200, { fixtureOnly: true }); return
                }
                if (!mutation || req.method !== 'POST') { json(res, 405, { message: 'Synthetic operation unavailable.' }); return }
                const payload = await jsonBody(req), fingerprint = JSON.stringify(payload)
                state.attempts.push({ path: url.pathname, payload })
                const step = state.steps.shift() ?? 'success'
                if (step === 'throttle') { json(res, 429, { code: 'THROTTLED', message: 'Synthetic throttled retry. The earlier save remains unconfirmed.' }); return }
                const existing = state.committed.get(payload.clientRequestId)
                if (existing) {
                    if (existing.fingerprint !== fingerprint) { json(res, 409, { code: 'IDEMPOTENCY_MISMATCH', message: 'Synthetic request content changed.' }); return }
                    json(res, 200, existing.result); return
                }
                const intake = url.pathname === '/api/admin/formal'
                if (intake) kind = payload.kind
                else {
                    const match = /^\/api\/admin\/formal\/(privacy|security)\/20000000-0000-4000-8000-000000000001$/.exec(url.pathname)
                    if (!match) { json(res, 404, { message: 'Unknown synthetic case.' }); return }
                    kind = match[1]
                }
                const schema = intake ? fixture.createFormalSchema : ({ adopt: fixture.adoptFormalSchema, note: fixture.noteFormalSchema, update: fixture.updateFormalSchema })[payload.operation]
                const update = { ...payload }; delete update.operation
                const parsed = schema?.safeParse(intake ? payload : update)
                if (!parsed?.success) { json(res, 400, { message: 'Synthetic fixture validation rejected this payload.' }); return }
                let detail = state.details[kind]
                if (!intake && payload.expectedVersion !== detail.record.version) { json(res, 409, { code: 'STALE_VERSION', message: 'Synthetic stale version. Review the current case before saving.' }); return }
                if (intake) {
                    detail = fixture.formalFixture(kind)
                    detail.record = { ...detail.record, title: parsed.data.title, body: parsed.data.body, receivedAt: parsed.data.receivedAt, nextAction: parsed.data.nextAction, followUpDueAt: parsed.data.followUpDueAt,
                        orgId: parsed.data.orgId, contactEmail: parsed.data.contactEmail, source: parsed.data.source, category: parsed.data.category, sourceReference: parsed.data.sourceReference }
                } else {
                    const before = revisionValues(detail.record), version = detail.record.version + 1
                    if (payload.operation === 'note') detail.notes.unshift({ id: randomUUID(), body: parsed.data.body, createdAt: fixture.fixtureInstant })
                    else {
                        if ((payload.status === 'resolved' || payload.status === 'closed') && (!payload.outcomeSummary || !payload.outcomeEvidenceRef || (kind === 'privacy' && !payload.responseRecordedAt))) { json(res, 400, { message: 'Synthetic closure needs recorded outcome evidence.' }); return }
                        detail.record = { ...detail.record, managed: true, ...parsed.data, version }
                        delete detail.record.clientRequestId; delete detail.record.expectedVersion; delete detail.record.reason
                        detail.revisions.unshift({ id: randomUUID(), version, before, after: revisionValues(detail.record), createdAt: fixture.fixtureInstant })
                    }
                    detail.record.version = version
                }
                state.details[kind] = detail
                const result = { id: fixture.fixtureId, kind, version: detail.record.version, requestId: payload.clientRequestId }
                state.committed.set(payload.clientRequestId, { fingerprint, result })
                // A committed response body is lost/truncated, so the client
                // cannot verify success. Completing HTTP avoids a browser's
                // automatic connection retry consuming the scripted 429.
                if (step === 'commit_lost') { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end('{'); return }
                json(res, 200, result)
            } catch { json(res, 503, { message: 'Synthetic formal fixture is unavailable.' }) }
        })
    } }],
    // Component state must survive test-controlled prop refreshes; source-file
    // edits from another agent must not cause a fixture document reload.
    server: { host: '127.0.0.1', port: 4190, strictPort: true, hmr: false, fs: { allow: [process.cwd()] } },
})
await server.listen()
console.log('Synthetic formal component fixtures only: http://127.0.0.1:4190/admin/formal/new')
