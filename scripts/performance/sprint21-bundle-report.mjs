#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import zlib from 'node:zlib'

const nextDir = path.resolve(process.argv[2] ?? '.next')
const outputPath = process.argv[3]
const routes = {
    '/owner/estimator': { folder: 'estimator', label: 'Cost Estimate', budgetGzipBytes: 200_000 },
    '/owner/rates': { folder: 'rates', label: 'Yarn Rate Book', budgetGzipBytes: 180_000 },
    '/owner/quotes': { folder: 'quotes', label: 'Saved Costings', budgetGzipBytes: 180_000 },
    '/owner/settings': { folder: 'settings', label: 'Settings', budgetGzipBytes: 180_000 },
    '/owner/billing': { folder: 'billing', label: 'Subscription & Billing', budgetGzipBytes: null },
}

function findManifest(routeFolder) {
    const directory = path.join(nextDir, 'server', 'app', '(dashboard)', 'owner', routeFolder)
    const manifest = fs.readdirSync(directory).find(file => file.endsWith('page_client-reference-manifest.js'))
    if (!manifest) throw new Error(`No client-reference manifest found for ${routeFolder}`)
    return path.join(directory, manifest)
}

function readManifest(file) {
    const sandbox = { globalThis: {} }
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file })
    const manifests = sandbox.globalThis.__RSC_MANIFEST ?? {}
    const manifestKey = Object.keys(manifests)[0]
    if (!manifestKey) throw new Error(`Manifest has no route key: ${file}`)
    return manifests[manifestKey]
}

function emittedChunksForRoute(route, routeFolder) {
    const manifest = readManifest(findManifest(routeFolder))
    const targetToken = `static/chunks/app/(dashboard)/owner/${routeFolder}/page-`
    const chunks = new Set()

    for (const clientModule of Object.values(manifest.clientModules ?? {})) {
        if (!Array.isArray(clientModule?.chunks)) continue
        if (!clientModule.chunks.some(chunk => typeof chunk === 'string' && chunk.includes(targetToken))) continue
        for (const chunk of clientModule.chunks) {
            if (typeof chunk === 'string' && chunk.endsWith('.js')) chunks.add(chunk)
        }
    }

    return [...chunks].sort().map(relativePath => {
        const filePath = path.join(nextDir, relativePath)
        const rawBytes = fs.readFileSync(filePath).length
        const gzipBytes = zlib.gzipSync(fs.readFileSync(filePath)).length
        return { path: relativePath, rawBytes, gzipBytes }
    })
}

const routeReports = Object.fromEntries(Object.entries(routes).map(([route, config]) => {
    const chunks = emittedChunksForRoute(route, config.folder)
    const rawBytes = chunks.reduce((total, chunk) => total + chunk.rawBytes, 0)
    const gzipBytes = chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0)
    return [route, {
        label: config.label,
        budgetGzipBytes: config.budgetGzipBytes,
        chunkCount: chunks.length,
        rawBytes,
        gzipBytes,
        budgetStatus: config.budgetGzipBytes === null
            ? 'informational'
            : gzipBytes < config.budgetGzipBytes ? 'pass' : 'over_budget',
        chunks,
    }]
}))

const report = {
    generatedAt: new Date().toISOString(),
    nextDir,
    buildId: fs.existsSync(path.join(nextDir, 'BUILD_ID'))
        ? fs.readFileSync(path.join(nextDir, 'BUILD_ID'), 'utf8').trim()
        : null,
    method: 'Next page_client-reference-manifest.js → deduplicated emitted JS chunks → exact filesystem and gzip byte totals',
    routes: routeReports,
}

const serialized = `${JSON.stringify(report, null, 2)}\n`
if (outputPath) fs.writeFileSync(outputPath, serialized)
else process.stdout.write(serialized)
