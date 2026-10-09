import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '../..')
const stub = (name) => path.resolve(import.meta.dirname, 'stubs', name)

// Replace every 'use server' module with no-op async stubs that record calls.
function stubServerModules() {
  return {
    name: 'stub-server-modules',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0]
      if (!file.startsWith(repo) || file.includes('node_modules') || file.includes('scratch/')) return null
      if (!/\.(ts|tsx)$/.test(file)) return null
      let src
      try { src = readFileSync(file, 'utf8') } catch { return null }
      if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(src)) return null
      const names = new Set()
      for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1])
      for (const m of src.matchAll(/export\s+const\s+(\w+)/g)) names.add(m[1])
      const body = [...names].map(n => `export const ${n} = async (...args) => { (window.__serverCalls ||= []).push({ fn: ${JSON.stringify(n)}, file: ${JSON.stringify(path.relative(repo, file))} }); console.warn('[harness] server action called', ${JSON.stringify(n)}); return window.__harnessFixtures?.[${JSON.stringify(n)}]?.(...args) ?? { success: false, error: 'harness', data: null } }`)
      return body.join('\n') + '\nexport default {}\n'
    },
  }
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [stubServerModules()],
  resolve: {
    alias: [
      { find: 'next/navigation', replacement: stub('next-navigation.ts') },
      { find: 'next/link', replacement: stub('next-link.tsx') },
      { find: 'next/dynamic', replacement: stub('next-dynamic.tsx') },
      { find: 'next/image', replacement: stub('next-image.tsx') },
      { find: 'next/cache', replacement: stub('empty.ts') },
      { find: 'next/headers', replacement: stub('empty.ts') },
      { find: 'server-only', replacement: stub('empty.ts') },
      { find: /^@\/lib\/supabase\/client$/, replacement: stub('supabase-client.ts') },
      { find: /^@\//, replacement: repo + '/' },
    ],
  },
  define: { 'process.env.NODE_ENV': '"development"' },
  server: { port: 5199, strictPort: true, fs: { allow: [repo] } },
  oxc: { jsx: { runtime: 'automatic' } },
})
