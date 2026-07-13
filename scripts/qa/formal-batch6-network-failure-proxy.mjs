#!/usr/bin/env node
import http from 'node:http'

const targetPort = Number(process.env.FORMAL_B6_TARGET_PORT || 3101)
const listenPort = Number(process.env.FORMAL_B6_PROXY_PORT || 3000)
let armed = false
let interceptedCount = 0

const server = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/__arm_setup_failure') {
        armed = true
        response.writeHead(204)
        response.end()
        return
    }

    if (request.method === 'GET' && request.url === '/__setup_failure_status') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ armed, interceptedCount }))
        return
    }

    const shouldFail = armed && request.method === 'POST' && request.url?.startsWith('/onboarding')
    if (shouldFail) {
        armed = false
        interceptedCount += 1
        request.resume()
        response.writeHead(503, {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
        })
        response.end('Controlled QA network failure before upstream mutation.')
        return
    }

    const upstream = http.request({
        hostname: '127.0.0.1',
        port: targetPort,
        path: request.url,
        method: request.method,
        // Preserve the browser-facing origin so auth redirects and cookies remain
        // scoped to the proxy URL while traffic is forwarded to the backend port.
        headers: { ...request.headers, host: `localhost:${listenPort}` },
    }, (upstreamResponse) => {
        if (request.method === 'POST') {
            process.stdout.write(
                `SETUP-007 proxy POST ${request.url} -> ${upstreamResponse.statusCode || 502}; set-cookie=${Boolean(upstreamResponse.headers['set-cookie'])}\n`
            )
        }
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
        upstreamResponse.pipe(response)
    })

    upstream.on('error', () => {
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('Controlled QA proxy could not reach the local application.')
    })
    request.pipe(upstream)
})

server.listen(listenPort, '127.0.0.1', () => {
    process.stdout.write(`SETUP-007 failure proxy ready on http://localhost:${listenPort}\n`)
})
