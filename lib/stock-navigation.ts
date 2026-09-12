export const stockDestinations = [
    { id: 'fabric', href: '/owner/stock', labelKey: 'navigation.fabric', titleKey: 'qualityStock.title' },
    { id: 'yarn', href: '/owner/stock/yarn', labelKey: 'navigation.yarn', titleKey: 'navigation.yarnStock' },
] as const

export function resolveStockKind(pathname: string) {
    const path = pathname.split(/[?#]/)[0].replace(/\/$/, '')
    if (path === '/owner/stock/yarn' || path.startsWith('/owner/stock/yarn/')) return 'yarn'
    if (path === '/owner/stock' || path.startsWith('/owner/stock/')) return 'fabric'
    return null
}
