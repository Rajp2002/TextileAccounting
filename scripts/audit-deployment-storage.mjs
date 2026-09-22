import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Run after `npm run build`. Trace totals are uncompressed and deduplicated;
// they are not Vercel's compressed, region-aware GB-month billing metric.
const root = process.cwd()
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  }))
  return nested.flat()
}

const traces = (await filesIn(path.join(root, '.next/server')))
  .filter(file => file.endsWith('.nft.json'))
const uniqueFiles = new Map()
const routes = []
const missing = new Set()
for (const trace of traces) {
  const manifest = JSON.parse(await readFile(trace, 'utf8'))
  let bytes = 0
  let sourceMapBytes = 0
  for (const relative of new Set(manifest.files)) {
    const file = path.resolve(path.dirname(trace), relative)
    if (!uniqueFiles.has(file)) {
      try {
        uniqueFiles.set(file, (await stat(file)).size)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        missing.add(path.relative(root, file))
        continue
      }
    }
    const size = uniqueFiles.get(file)
    bytes += size
    if (file.endsWith('.map')) sourceMapBytes += size
  }
  routes.push({ trace: path.relative(root, trace), bytes, sourceMapBytes })
}

const publicFiles = await Promise.all((await filesIn(path.join(root, 'public')))
  .map(async file => ({ file: path.relative(root, file), bytes: (await stat(file)).size })))
const sum = items => items.reduce((total, size) => total + size, 0)
console.log(JSON.stringify({
  buildId: (await readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim(),
  traceCount: traces.length,
  uniqueTracedBytes: sum([...uniqueFiles.values()]),
  uniqueTracedSourceMapBytes: sum([...uniqueFiles].filter(([file]) => file.endsWith('.map')).map(([, size]) => size)),
  publicBytes: sum(publicFiles.map(file => file.bytes)),
  largestPublicFiles: publicFiles.sort((a, b) => b.bytes - a.bytes).slice(0, 10),
  largestTraces: routes.sort((a, b) => b.bytes - a.bytes).slice(0, 10),
  missingTracedFiles: [...missing],
}, null, 2))
if (missing.size) process.exitCode = 1
