import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { gzipSync } from 'node:zlib'

const nextDir = resolve(process.argv[2] ?? '.next')
const appDir = join(nextDir, 'server/app')
function files(directory) {
    return readdirSync(directory).flatMap(name => {
        const file = join(directory, name)
        return statSync(file).isDirectory() ? files(file) : [file]
    })
}
const routes = {}
for (const file of files(appDir).filter(file => file.endsWith('page_client-reference-manifest.js'))) {
    const sandbox = { globalThis: {} }
    runInNewContext(readFileSync(file, 'utf8'), sandbox)
    const manifest = Object.values(sandbox.globalThis.__RSC_MANIFEST)[0]
    const entry = relative(appDir, file).replace('_client-reference-manifest.js', '')
    const token = `static/chunks/app/${entry}-`
    const chunks = new Set()
    for (const client of Object.values(manifest.clientModules)) {
        if (!client.chunks?.some(chunk => String(chunk).startsWith(token))) continue
        for (const chunk of client.chunks) if (String(chunk).endsWith('.js')) chunks.add(chunk)
    }
    const sizes = [...chunks].sort().map(chunk => {
        const content = readFileSync(join(nextDir, chunk))
        return { path: chunk, rawBytes: content.length, gzipBytes: gzipSync(content).length,
            containsJsPdf: content.includes(Buffer.from('jsPDF PubSub')) }
    })
    const route = `/${entry.replace(/\([^/]+\)\//g, '').replace(/\/?page$/, '')}`
    routes[route] = { rawBytes: sizes.reduce((n, c) => n + c.rawBytes, 0), gzipBytes: sizes.reduce((n, c) => n + c.gzipBytes, 0), chunks: sizes }
}
console.log(JSON.stringify({ method: 'Deduplicated page-entry dependency chunks from webpack RSC manifests; gzip per file. Excludes separate layout-only chunks and async imports; not observed browser transfer.', routes }, null, 2))
