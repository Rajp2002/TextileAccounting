export function usePathname() { return window.location.pathname }
export function useSearchParams() { return new URLSearchParams(window.location.search) }
export function useRouter() {
    return { push: (href: string) => {
        const fixtureWindow = window as unknown as { __fixtureHoldSaveNavigation?: boolean; __fixtureSavedNavigation?: string }
        if (fixtureWindow.__fixtureHoldSaveNavigation && href.startsWith('/free/costings?costing=')) { fixtureWindow.__fixtureSavedNavigation = href; return }
        window.location.assign(href)
    }, replace: (href: string) => window.location.replace(href), refresh: () => undefined, back: () => window.history.back(), prefetch: () => undefined }
}
