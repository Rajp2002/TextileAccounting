// Local stand-in for Supabase (Auth, PostgREST) and Upstash Redis, used to
// time signed-in pages without touching QA or production. Every request waits
// a fixed delay (a modelled network + database round trip) and is logged, so
// a run can count calls per page and how many had to wait for another.
import { createServer } from 'node:http'
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto'
import { buildFixtures } from './fixtures.mjs'

const b64url = value => Buffer.from(value).toString('base64url')

export function createFakeBackend({ supabaseDelayMs = 30, redisDelayMs = 10 } = {}) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const kid = 'weavly-perf-harness'
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig', key_ops: ['verify'] }
    const fixtures = buildFixtures()
    const log = []

    function signJwt(payload) {
        const header = b64url(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
        const body = b64url(JSON.stringify(payload))
        const signature = sign('sha256', Buffer.from(`${header}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' })
        return `${header}.${body}.${signature.toString('base64url')}`
    }

    function sessionFor(account, issuer) {
        const now = Math.floor(Date.now() / 1000)
        const user = fixtures.authUsers[account.userId]
        const accessToken = signJwt({
            iss: issuer, sub: user.id, aud: 'authenticated', role: 'authenticated',
            exp: now + 6 * 3600, iat: now, email: user.email, phone: '',
            app_metadata: user.app_metadata, user_metadata: user.user_metadata,
            aal: 'aal1', amr: [{ method: 'password', timestamp: now }], session_id: randomUUID(), is_anonymous: false,
        })
        return {
            access_token: accessToken, token_type: 'bearer', expires_in: 6 * 3600, expires_at: now + 6 * 3600,
            refresh_token: `refresh-${user.id}`, user,
        }
    }

    function userFromAuthorization(header) {
        const token = String(header ?? '').replace(/^Bearer\s+/i, '')
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
            return fixtures.authUsers[payload.sub] ?? null
        } catch {
            return null
        }
    }

    function filterRows(rows, searchParams) {
        let result = rows
        for (const [column, rawValue] of searchParams.entries()) {
            if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(column)) continue
            if (column === 'or' || column === 'and') continue
            const value = String(rawValue)
            if (value.startsWith('eq.')) {
                const expected = value.slice(3)
                result = result.filter(row => !(column in row) || String(row[column]) === expected)
            } else if (value === 'is.null') {
                result = result.filter(row => !(column in row) || row[column] === null)
            } else if (value.startsWith('in.(')) {
                const members = value.slice(4, -1).split(',').map(member => member.replace(/^"|"$/g, ''))
                result = result.filter(row => !(column in row) || members.includes(String(row[column])))
            }
        }
        return result
    }

    function respondJson(res, status, body, headers = {}) {
        const payload = body === undefined ? '' : JSON.stringify(body)
        res.writeHead(status, { 'content-type': 'application/json', ...headers })
        res.end(payload)
    }

    function handleRest(req, res, url, body) {
        const path = url.pathname.replace(/^\/rest\/v1\//, '')
        if (path.startsWith('rpc/')) {
            const name = path.slice(4)
            const handler = fixtures.rpc[name]
            const result = typeof handler === 'function' ? handler(body ? JSON.parse(body) : {}) : handler ?? null
            return respondJson(res, 200, result)
        }
        const table = path
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            // Writes are not part of a page load; answer like an empty insert/update.
            return respondJson(res, req.method === 'POST' ? 201 : 200, [])
        }
        const rows = filterRows(fixtures.tables[table] ?? [], url.searchParams)
        const accept = String(req.headers.accept ?? '')
        const headers = { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }
        if (req.method === 'HEAD') {
            res.writeHead(200, headers)
            return res.end()
        }
        if (accept.includes('application/vnd.pgrst.object+json')) {
            if (rows.length !== 1) {
                return respondJson(res, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' })
            }
            return respondJson(res, 200, rows[0], headers)
        }
        return respondJson(res, 200, rows, headers)
    }

    function handleAuth(req, res, url) {
        const path = url.pathname.replace(/^\/auth\/v1/, '')
        if (path === '/.well-known/jwks.json') return respondJson(res, 200, { keys: [jwk] })
        if (path === '/user') {
            const user = userFromAuthorization(req.headers.authorization)
            return user ? respondJson(res, 200, user) : respondJson(res, 401, { code: 'bad_jwt', message: 'invalid JWT' })
        }
        if (path === '/logout') { res.writeHead(204); return res.end() }
        return respondJson(res, 404, { message: `fake auth has no ${path}` })
    }

    function handleRedis(req, res, url, body) {
        // @upstash/redis sends ["COMMAND", ...args] to "/" and arrays of them to "/pipeline".
        const parsed = body ? JSON.parse(body) : []
        if (url.pathname.startsWith('/pipeline') || url.pathname.startsWith('/multi-exec')) {
            return respondJson(res, 200, parsed.map(() => ({ result: null })))
        }
        return respondJson(res, 200, { result: null })
    }

    const server = createServer((req, res) => {
        const startedAt = performance.now()
        const url = new URL(req.url, 'http://fake-backend')
        const kind = url.pathname.startsWith('/rest/v1/') ? 'rest'
            : url.pathname.startsWith('/auth/v1/') ? 'auth'
                : url.pathname.startsWith('/redis') ? 'redis'
                    : 'other'
        if (kind === 'redis') url.pathname = url.pathname.replace(/^\/redis/, '') || '/'
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8')
            const delay = kind === 'redis' ? redisDelayMs : supabaseDelayMs
            setTimeout(() => {
                const entry = {
                    kind, method: req.method,
                    target: kind === 'rest' ? `${url.pathname.replace('/rest/v1/', '')}${url.searchParams.get('select') ? `?select=${url.searchParams.get('select').slice(0, 60)}` : ''}`
                        : kind === 'redis' ? `redis ${body.slice(0, 40)}` : url.pathname,
                    startedAt, endedAt: 0,
                }
                res.on('finish', () => { entry.endedAt = performance.now(); log.push(entry) })
                try {
                    if (kind === 'rest' && api.failRest?.(url)) return respondJson(res, 500, { code: 'XX000', message: 'harness: failing this read on purpose' })
                    if (kind === 'rest') return handleRest(req, res, url, body)
                    if (kind === 'auth') return handleAuth(req, res, url)
                    if (kind === 'redis') return handleRedis(req, res, url, body)
                    // Sentry envelopes (with --sentry) and anything else: hand to a listener.
                    if (api.onOther) { api.onOther(req, body); return respondJson(res, 200, {}) }
                    return respondJson(res, 404, { message: 'not faked' })
                } catch (error) {
                    return respondJson(res, 500, { message: String(error?.message ?? error) })
                }
            }, delay)
        })
    })

    const api = {
        fixtures,
        sessionFor,
        log,
        drainLog() { return log.splice(0, log.length) },
        listen(port) { return new Promise(resolve => server.listen(port, '127.0.0.1', resolve)) },
        close() { return new Promise(resolve => server.close(resolve)) },
    }
    return api
}
