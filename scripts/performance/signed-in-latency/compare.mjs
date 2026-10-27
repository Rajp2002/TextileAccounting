#!/usr/bin/env node
// Prints a markdown before/after table from two run.mjs reports.
// Usage: node scripts/performance/signed-in-latency/compare.mjs before.json after.json [--js]
import { readFileSync } from 'node:fs'

const [beforePath, afterPath] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const showJs = process.argv.includes('--js')
const load = path => JSON.parse(readFileSync(path, 'utf8'))
const before = load(beforePath)
const after = load(afterPath)
const key = result => `${result.account} ${result.path}`
const afterByKey = new Map(after.results.map(result => [key(result), result]))
const kb = bytes => (bytes / 1024).toFixed(1)
const change = (from, to) => from ? `${to - from > 0 ? '+' : ''}${Math.round((to - from) / from * 100)}%` : ''

const header = ['Account', 'Route', 'TTFB ms', 'Full page ms', 'Waits', 'Calls']
if (showJs) header.push('First-load JS (KB gz)')
console.log(`| ${header.join(' | ')} |`)
console.log(`|${header.map(() => ' --- ').join('|')}|`)
for (const result of before.results) {
    const next = afterByKey.get(key(result))
    if (!next) continue
    const cells = [
        result.account,
        `\`${result.path}\`${result.status === 307 ? ' (redirect)' : ''}`,
        `${result.ttfbMs} → ${next.ttfbMs} (${change(result.ttfbMs, next.ttfbMs)})`,
        `${result.totalMs} → ${next.totalMs} (${change(result.totalMs, next.totalMs)})`,
        `${result.sequentialWaits} → ${next.sequentialWaits}`,
        `${result.backendCalls} → ${next.backendCalls}`,
    ]
    if (showJs) cells.push(result.html && next.html ? `${kb(result.html.gzipBytes)} → ${kb(next.html.gzipBytes)} (${change(result.html.gzipBytes, next.html.gzipBytes)})` : '')
    console.log(`| ${cells.join(' | ')} |`)
}
