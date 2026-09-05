// Isolated UI fixture using real components, mocked navigation/actions, and no backend.
// node scripts/qa/base-fixed-salary-preview.mjs → http://127.0.0.1:4319/?view=operations|payroll|overhead
import { createServer } from 'vite'
import tailwind from '@tailwindcss/postcss'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const actions = [...readFileSync(new URL('../../app/(dashboard)/owner/production/actions.ts', import.meta.url), 'utf8').matchAll(/export async function (\w+)/g)].map(match => match[1])
const mocks = {
    navigation: `const params=new URLSearchParams(); const router={refresh(){},push(url){window.__navigation=url}}; export const useRouter=()=>router; export const useSearchParams=()=>params; export const usePathname=()=>'/owner/payroll';`,
    link: `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`,
    i18n: `export const useTranslation=()=>({tx:x=>x,t:x=>x,language:'en'});`,
    analytics: `export const trackPlanEvent=async()=>{};`,
    actions: actions.map(name => `export async function ${name}(payload){window.__lastAction={name:${JSON.stringify(name)},payload}; return {success:true}}`).join('\n'),
}
const server = await createServer({
    root, configFile: false, server: { host: '127.0.0.1', port: 4319, strictPort: true },
    resolve: { alias: { '@': root.replace(/\/$/, '') } },
    esbuild: { jsx: 'automatic' }, css: { postcss: { plugins: [tailwind()] } },
    plugins: [{ name: 'salary-fixture', enforce: 'pre',
        resolveId(source, importer) {
            const name = source === 'next/navigation' ? 'navigation' : source === 'next/link' ? 'link'
                : /(?:@|.*)\/lib\/i18n\/context(?:\.tsx)?$/.test(source) ? 'i18n' : /(?:@|.*)\/lib\/plan-analytics(?:\.ts)?$/.test(source) ? 'analytics'
                    : source === './actions' && importer?.includes('/owner/production/') ? 'actions' : null
            return name ? `\0salary-mock:${name}` : null
        },
        load(id) { return id.startsWith('\0salary-mock:') ? mocks[id.split(':')[1]] : null },
        configureServer(vite) { vite.middlewares.use((req,res,next) => {
            if (req.url?.split('?')[0] !== '/') return next()
            res.setHeader('Content-Type','text/html')
            res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Salary QA fixture</title></head><body><div id="root"></div><script type="module" src="/scripts/qa/base-fixed-salary-preview.jsx"></script></body></html>')
        }) },
    }],
})
await server.listen()
console.log('Isolated salary UI fixture: http://127.0.0.1:4319')
