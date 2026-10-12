// Actual client components, synthetic action transport; no remote services.
import { createServer } from 'vite'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit --enable-synthetic-fixtures required')
const root = path.resolve('scripts/qa/lite-records-browser')
const stub = path.join(root, 'stubs.tsx')
const baseline = process.argv.includes('--baseline')
const baselineFiles = ['app/(dashboard)/owner/quotes/QuotesClient.tsx', 'app/(dashboard)/owner/rates/RatesClient.tsx']
const server = await createServer({ root, cacheDir: '/tmp/weavly-lite-records-vite-cache', configFile: false, mode: 'development', esbuild: { jsx: 'automatic' }, plugins: baseline ? [{ name: 'immutable-lite-baseline', enforce: 'pre', transform(code, id) { const relative = path.relative(process.cwd(), id); return baselineFiles.includes(relative) ? { code: execFileSync('git', ['show', `34f37ce223ecd321c1c046901384175ca118b04a:${relative}`], { encoding: 'utf8' }), map: null } : null } }] : [], resolve: { alias: [
  { find: '../estimator/actions', replacement: stub },
  { find: '@/app/(dashboard)/owner/estimator/actions', replacement: stub },
  { find: './actions', replacement: stub },
  { find: '@/app/(dashboard)/owner/settings/document-branding-actions', replacement: stub },
  { find: '@/app/actions/tour-preferences', replacement: stub },
  { find: '@/lib/plan-analytics', replacement: stub },
  { find: 'next/link', replacement: stub },
  { find: 'next/navigation', replacement: stub },
  { find: 'next/dynamic', replacement: path.join(root, 'dynamic.tsx') },
  { find: '@', replacement: process.cwd() },
] }, server: { host: '127.0.0.1', port: 4195, strictPort: true, hmr: false, watch: { ignored: ['**/*'] }, fs: { allow: [process.cwd()] } } })
await server.listen()
console.info('Synthetic Lite records: http://127.0.0.1:4195; no auth/database/device evidence')
