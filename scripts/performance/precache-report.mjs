#!/usr/bin/env node
// What the service worker downloads when it installs: entries in the built
// public/sw.js precache manifest, with raw bytes and transfer bytes (gzip 9
// for text; images and fonts are already compressed).
// Usage, after a build: node scripts/performance/precache-report.mjs [output.json]
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const worker = readFileSync('public/sw.js', 'utf8')
const urls = [...worker.matchAll(/url:"([^"]+)"/g)].map(match => match[1])
const groupOf = url => url.startsWith('/_next/static/chunks/app/') ? 'route page chunks'
    : url.startsWith('/_next/static/chunks/') ? 'shared and lazy chunks'
        : url.startsWith('/_next/static/css/') ? 'css'
            : url.startsWith('/_next/static/media/') ? 'fonts'
                : url.startsWith('/images/') ? 'images'
                    : 'other public files'
const groups = {}
let rawBytes = 0
let transferBytes = 0
for (const url of urls) {
    const file = decodeURIComponent(url.startsWith('/_next/') ? `.next/${url.slice(7)}` : `public${url}`)
    let content
    try {
        content = readFileSync(file)
    } catch {
        continue // e.g. /_offline, a route rather than a file
    }
    const transfer = /\.(png|jpe?g|webp|gif|woff2?|ico|mp4)$/i.test(url) ? statSync(file).size : gzipSync(content, { level: 9 }).length
    const group = (groups[groupOf(url)] ??= { entries: 0, rawBytes: 0, transferBytes: 0 })
    group.entries += 1
    group.rawBytes += content.length
    group.transferBytes += transfer
    rawBytes += content.length
    transferBytes += transfer
}
const report = { entries: urls.length, rawBytes, transferBytes, groups }
const mb = bytes => (bytes / 1048576).toFixed(2)
console.log(`${urls.length} entries, ${mb(rawBytes)} MB raw, ${mb(transferBytes)} MB transfer`)
for (const [name, group] of Object.entries(groups)) console.log(`  ${name.padEnd(24)} ${String(group.entries).padStart(4)} entries  ${mb(group.transferBytes)} MB transfer`)
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2))
