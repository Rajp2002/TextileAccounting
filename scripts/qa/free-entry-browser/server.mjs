// Real customer components with local synthetic action boundaries. No remote credentials/data.
import { createServer } from 'vite'
import path from 'node:path'
if (!process.argv.includes('--enable-synthetic-fixtures')) throw new Error('Explicit --enable-synthetic-fixtures required')
const root = path.resolve('scripts/qa/free-entry-browser')
const server = await createServer({ root, cacheDir: '/tmp/weavly-free-entry-vite-cache', publicDir: path.resolve('public'), configFile: false, mode: 'development', esbuild: { jsx: 'automatic' }, resolve: { alias: [
  { find: '@/app/(auth)/actions/auth', replacement: path.join(root, 'actions.ts') },
  { find: '@/app/(auth)/onboarding/plans/actions', replacement: path.join(root, 'actions.ts') },
  { find: '@/components/auth/auth-transition', replacement: path.join(root, 'transition.tsx') },
  { find: '@/app/(dashboard)/owner/estimator/EstimatorClient', replacement: path.join(root, 'transition.tsx') },
  { find: '@/lib/supabase/client', replacement: path.join(root, 'auth-client.ts') },
  { find: 'next/link', replacement: path.join(root, 'link.tsx') },
  { find: 'next/image', replacement: path.join(root, 'image.tsx') },
  { find: 'next/navigation', replacement: path.join(root, 'navigation.ts') },
  { find: '@', replacement: process.cwd() },
]}, server: { host: '127.0.0.1', port: 4188, strictPort: true, hmr: false, fs: { allow: [process.cwd()] } } })
await server.listen()
console.info('Synthetic Free entry fixture: http://127.0.0.1:4188 (no authentication/payment evidence)')
