export const stockDestinations = [
    { id: 'fabric', href: '/owner/stock', labelKey: 'navigation.fabric', titleKey: 'qualityStock.title' },
] as const

export function resolveStockKind(pathname: string) {
    const path = pathname.split(/[?#]/)[0].replace(/\/$/, '')
    if (path === '/owner/stock' || path.startsWith('/owner/stock/')) return 'fabric'
    return null
}
