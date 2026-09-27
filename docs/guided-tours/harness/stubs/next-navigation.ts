/* eslint-disable -- guided-tour harness: a local diagnostic tool, not application code. */
import { useSyncExternalStore } from 'react'
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => { listeners.add(l); window.addEventListener('popstate', l); return () => { listeners.delete(l); window.removeEventListener('popstate', l) } }
const fakePath = () => (window as any).__harnessPath ?? '/owner/production'
export function usePathname() { return useSyncExternalStore(subscribe, fakePath, fakePath) }
export function useSearchParams() { return new URLSearchParams((window as any).__harnessSearch ?? '') }
export function useRouter() {
  const record = (kind: string) => (href?: string) => { ((window as any).__navigations ||= []).push({ kind, href }); console.warn('[harness] router', kind, href) }
  return { push: record('push'), replace: record('replace'), refresh: record('refresh'), back: record('back'), prefetch: () => {} }
}
export function redirect(href: string) { throw new Error('redirect ' + href) }
export function notFound() { throw new Error('notFound') }
export function useParams() { return {} }
export function useSelectedLayoutSegment() { return null }
