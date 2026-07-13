#!/usr/bin/env node
import http from 'node:http'

const targetPort = Number(process.env.OFF009_TARGET_PORT || 3101)
const listenPort = Number(process.env.OFF009_PROXY_PORT || 3102)
const delayMs = Number(process.env.OFF009_DELAY_MS || 17_000)
let armed = false

const server = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/__arm_off009') {
        armed = true
        response.writeHead(204)
        response.end()
        return
    }

    const shouldDelay = armed && request.method === 'POST' && request.url?.startsWith('/supervisor/dashboard')
    if (shouldDelay) armed = false

    const upstream = http.request({
        hostname: '127.0.0.1',
        port: targetPort,
        path: request.url,
        method: request.method,
        headers: {
            ...request.headers,
            host: `localhost:${listenPort}`,
            'x-forwarded-host': `localhost:${listenPort}`,
        },
    }, (upstreamResponse) => {
        const chunks = []
        upstreamResponse.on('data', (chunk) => chunks.push(chunk))
        upstreamResponse.on('end', () => {
            const send = () => {
                response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
                response.end(Buffer.concat(chunks))
            }
            if (shouldDelay) setTimeout(send, delayMs)
            else send()
        })
    })

    upstream.on('error', (error) => {
        response.writeHead(502, { 'content-type': 'text/plain' })
        response.end(`OFF-009 proxy upstream error: ${error.message}`)
    })
    request.pipe(upstream)
})

server.listen(listenPort, '127.0.0.1', () => {
    process.stdout.write(`OFF-009 delay proxy ready on http://localhost:${listenPort}\n`)
})
