// Generate a synthetic Next production app using the real navigation/localizer.
// No authentication, credentials, business data, or remote services are loaded.
// Usage: node scripts/performance/routing-fixture.mjs [baseline-git-ref]
// Then run the printed build/start commands and inspect with a browser.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve('.')
const destination = mkdtempSync(join(tmpdir(), 'weavly-routing-'))
const write = (file, content) => {
    const path = join(destination, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
}
const copy = file => write(file, readFileSync(join(root, file), 'utf8'))
symlinkSync(join(root, 'node_modules'), join(destination, 'node_modules'), 'dir')
write('package.json', JSON.stringify({ name: 'weavly-routing-fixture', private: true }))
write('next.config.mjs', 'export default { devIndicators: false }\n')
write('tsconfig.json', JSON.stringify({ compilerOptions: {
    target: 'ES2020', lib: ['dom', 'dom.iterable', 'esnext'], strict: true,
    noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler',
    jsx: 'react-jsx', skipLibCheck: true, paths: { '@/*': ['./*'] },
}, include: ['**/*.ts', '**/*.tsx', '.next/types/**/*.ts'] }))
for (const file of [
    'components/navigation/navigation-link.tsx', 'components/navigation/owner-route-loading.tsx',
    'components/performance/route-milestones.tsx', 'lib/utils.ts', 'postcss.config.mjs', 'app/globals.css',
]) copy(file)
for (const file of [
    'context.tsx', 'runtime.ts', 'base-plan-phrases.ts', 'base-continuity-phrases.ts',
    'legacy.ts', 'legacy-generated.ts', 'locales/en.ts', 'locales/hi.ts', 'locales/gu.ts',
]) copy(`lib/i18n/${file}`)
write('lib/i18n/context-baseline.tsx', execFileSync('git', [
    'show', `${process.argv[2] ?? 'HEAD'}:lib/i18n/context.tsx`,
], { cwd: root, encoding: 'utf8' }))

const metricsScript = `
window.routingMetrics = { documentId: crypto.randomUUID(), walks: 0, observers: 0 };
const walk = document.createTreeWalker.bind(document);
document.createTreeWalker = (...args) => { window.routingMetrics.walks++; return walk(...args) };
const observe = MutationObserver.prototype.observe;
const disconnect = MutationObserver.prototype.disconnect;
const active = new WeakSet();
MutationObserver.prototype.observe = function(target, options) {
  if (options.characterData && !active.has(this)) { active.add(this); window.routingMetrics.observers++ }
  return observe.call(this, target, options);
};
MutationObserver.prototype.disconnect = function() {
  if (active.delete(this)) window.routingMetrics.observers--;
  return disconnect.call(this);
};`
write('app/layout.tsx', `import './globals.css'
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body><script dangerouslySetInnerHTML={{__html: ${JSON.stringify(metricsScript)}}}/>{children}</body></html>
}`)

for (const baseline of [false, true]) {
    const shell = `Shell${baseline ? 'Baseline' : ''}`
    write(`components/${shell}.tsx`, `'use client'
import { useState } from 'react'
import { I18nProvider, useTranslation } from '@/lib/i18n/context${baseline ? '-baseline' : ''}'
import { NavigationLink } from '@/components/navigation/navigation-link'
function Content({ children }: { children: React.ReactNode }) {
  const { setLanguage, languageStatus } = useTranslation()
  const [rows, setRows] = useState(0)
  return <div className="mx-auto max-w-4xl space-y-6 p-6">
    <header className="space-y-4 rounded-xl border p-4">
      <p data-i18n-skip="true">Synthetic routing fixture (${baseline ? 'baseline' : 'optimized'})</p>
      <div className="flex gap-3">{(['en','hi','gu'] as const).map(lang => <button className="rounded border p-2" key={lang} onClick={() => void setLanguage(lang)}>{lang}</button>)}</div>
      <output data-i18n-skip="true">{languageStatus}</output>
      <input className="block border p-2" aria-label="Persistent note" placeholder="Persistent note" />
      <nav className="flex flex-wrap gap-3">{['/free','/free/costings','/free/account','/free/billing','/slow'].map(href => <NavigationLink className="rounded border p-3" key={href} href={href} prefetch={href === '/slow' ? false : undefined}>{href}</NavigationLink>)}</nav>
    </header>
    <button className="rounded border p-3" onClick={() => setRows(value => value + 300)}>Add rows</button>
    <div data-fixture-rows>{Array.from({length: rows}, (_, index) => <p key={index}><span>Save</span><input placeholder="Search"/><span data-i18n-skip="true">Customer {index}</span></p>)}</div>
    <main>{children}</main>
  </div>
}
export default function ${shell}({ children }: { children: React.ReactNode }) {
  return <I18nProvider><Content>{children}</Content></I18nProvider>
}`)
    write(`app/(${baseline ? 'baseline' : 'optimized'})/layout.tsx`, `export { default } from '@/components/${shell}'`)
}
for (const route of ['free', 'free/costings', 'free/account', 'free/billing', 'slow']) {
    write(`app/(optimized)/${route}/page.tsx`, `import { connection } from 'next/server'
export default async function Page() {
  await connection()
  await new Promise(resolve => setTimeout(resolve, 1200))
  return <section data-fixture-ready="${route}"><h1 className="text-2xl">Save</h1><p data-i18n-skip="true">${route} ready</p><input placeholder="Search"/></section>
}`)
    if (route !== 'slow') write(`app/(optimized)/${route}/loading.tsx`, readFileSync(join(root, 'app', route, 'loading.tsx'), 'utf8'))
}
write('app/(baseline)/before/page.tsx', 'export default function Page() { return <h1>Save</h1> }')
console.log(JSON.stringify({ directory: destination, commands: [
    `cd '${destination}' && NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack`,
    `cd '${destination}' && NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next start -p 3107`,
] }, null, 2))
