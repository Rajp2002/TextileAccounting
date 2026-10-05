// Synthetic component transport only. All server actions are replaced locally.
import { createServer } from 'vite'
import path from 'node:path'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit --enable-synthetic-fixtures required')
const root = path.resolve('scripts/qa/free-supporting-browser')
const stub = path.join(root, 'stubs.tsx')
const server = await createServer({ root, cacheDir: '/tmp/weavly-free-supporting-vite-cache', configFile: false, mode: 'development', esbuild: { jsx: 'automatic' }, resolve: { alias: [
  { find: '@/app/(dashboard)/owner/settings/actions', replacement: stub },
  { find: '@/app/(dashboard)/owner/settings/account-deletion', replacement: stub },
  { find: '../FreeWorkspace', replacement: stub },
  { find: './costing-defaults-card', replacement: stub },
  { find: '../payroll/PayrollCycleSettingsCard', replacement: stub },
  { find: 'next/link', replacement: stub },
  { find: 'next/navigation', replacement: stub },
  { find: '@', replacement: process.cwd() },
] }, server: { host: '127.0.0.1', port: 4192, strictPort: true, hmr: false, watch: { ignored: ['**/*'] }, fs: { allow: [process.cwd()] } } })
await server.listen()
console.info('Synthetic Free supporting components: http://127.0.0.1:4192; no authentication/provider/database evidence')
