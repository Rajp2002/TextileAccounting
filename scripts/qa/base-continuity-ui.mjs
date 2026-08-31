/** Actual Base components with synthetic data and disabled server writes.
 * Run: node scripts/qa/base-continuity-ui.mjs
 * This is a UI fixture, not authenticated end-to-end verification.
 */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
const fixture = await mkdtemp(join(tmpdir(), 'weavly-base-continuity-'))
const port = Number(process.env.BASE_QA_PORT ?? 4179)
for (const name of ['actions.ts', 'fixture.tsx', 'index.html', 'link.tsx', 'navigation.tsx']) {
    const source = await readFile(new URL(`./fixtures/base-continuity/${name}.txt`, import.meta.url), 'utf8')
    await writeFile(join(fixture, name), source)
}

const server = await createServer({
    root: fixture,
    configFile: false,
    esbuild: { jsx: 'automatic' },
    resolve: { alias: [
        ...['react', 'react-dom', 'sonner'].map(name => ({ find: name, replacement: join(root, 'node_modules', name) })),
        { find: 'next/navigation', replacement: join(fixture, 'navigation.tsx') },
        { find: 'next/link', replacement: join(fixture, 'link.tsx') },
        { find: '@', replacement: root },
    ] },
    plugins: [{
        name: 'isolate-base-actions',
        enforce: 'pre',
        resolveId(source, importer) {
            if (source === './actions' && importer?.includes('/owner/production/')) return join(fixture, 'actions.ts')
        },
        configureServer(instance) {
            instance.middlewares.use('/api', (_request, response) => {
                response.statusCode = 204
                response.end()
            })
        },
    }],
    css: { postcss: root },
    server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root, fixture] } },
})

await server.listen()
console.log(`Base continuity UI fixture: http://localhost:${port}/owner/production — no server writes`)
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0) })
