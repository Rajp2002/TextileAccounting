// Explicit synthetic transport for real login/verification components. No Auth
// accounts, factors, credentials, grants or hosted services are changed.
import { createServer } from 'vite'
import path from 'node:path'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit synthetic fixture flag required')
const root = path.resolve('scripts/qa/founder-auth-browser')
const server = await createServer({ root, configFile: false, esbuild: { jsx: 'automatic' }, resolve: { alias: [
    { find: '@/app/(admin-auth)/admin/login/actions', replacement: path.join(root, 'actions.ts') },
    { find: '@/app/(admin-auth)/admin/verify/actions', replacement: path.join(root, 'actions.ts') },
    { find: 'next/link', replacement: path.resolve('scripts/qa/support-browser/link.tsx') },
    { find: '@', replacement: process.cwd() },
] }, server: { host: '127.0.0.1', port: 4188, strictPort: true, fs: { allow: [process.cwd()] } } })
await server.listen()
console.info('Synthetic founder-auth components: http://127.0.0.1:4188 (no real Auth/MFA evidence)')
