import type { UrlObject } from 'node:url'

/**
 * The page a navigation link was just tapped towards. Navigation chrome shows it as
 * current at once, so a tab or drawer item responds to the tap rather than to the
 * server's answer. It applies only while the router is still on the page it left.
 */
export type NavigationIntent = { path: string; from: string }

/** The `href` a Next link accepts. */
type LinkHref = string | UrlObject
type LinkClick = {
    button: number; defaultPrevented: boolean
    metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean
}

const pathOf = (href: LinkHref) => (typeof href === 'string' ? href : href.pathname ?? '').split(/[?#]/)[0]

/** A plain left tap to another page; new-tab, prevented and same-page taps return null. */
export function navigationIntentForClick(event: LinkClick, href: LinkHref, pathname: string): NavigationIntent | null {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
    const path = pathOf(href)
    return path && path !== pathname ? { path, from: pathname } : null
}

/** Once the router commits any page (the destination, another link, or Back) the intent is spent. */
export function resolveNavigationPathname(pathname: string, intent: NavigationIntent | null) {
    return intent && intent.from === pathname ? intent.path : pathname
}

let current: NavigationIntent | null = null
const listeners = new Set<() => void>()

export function startNavigationIntent(intent: NavigationIntent | null) {
    if (!intent) return
    current = intent
    listeners.forEach(listener => listener())
}

export function clearNavigationIntent() {
    if (!current) return
    current = null
    listeners.forEach(listener => listener())
}

export const getNavigationIntent = () => current
export const getServerNavigationIntent = () => null

export function subscribeNavigationIntent(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}
