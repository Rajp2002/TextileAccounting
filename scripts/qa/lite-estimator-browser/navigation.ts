import { useSyncExternalStore } from 'react'
const subscribe = (listener: () => void) => {
    window.addEventListener('popstate', listener)
    window.addEventListener('synthetic-navigation', listener)
    return () => { window.removeEventListener('popstate', listener); window.removeEventListener('synthetic-navigation', listener) }
}
const snapshot = () => window.location.pathname + window.location.search
export function navigate(href: string, replace = false) {
    const next = new URL(href, location.href)
    if (next.origin !== location.origin) throw new Error('Synthetic navigation refuses external origins')
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next)
    window.dispatchEvent(new Event('synthetic-navigation'))
}
export function usePathname() { return useSyncExternalStore(subscribe, snapshot).split('?')[0] }
export function useSearchParams() { return new URLSearchParams(useSyncExternalStore(subscribe, snapshot).split('?')[1] ?? '') }
export function useRouter() { return { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh: () => undefined, back: () => history.back(), prefetch: () => undefined } }
