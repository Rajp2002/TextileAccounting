export function useRouter() {
    return {
        push: (href: string) => window.location.assign(href), replace: (href: string) => window.location.replace(href),
        refresh: () => window.dispatchEvent(new Event('synthetic-formal-refresh')),
    }
}
