'use client'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { resolveStockKind, stockDestinations } from '@/lib/stock-navigation'
export default function StockPageTitle() {
    const pathname = usePathname()
    const { t } = useTranslation()
    const category = stockDestinations.find(item => item.id === resolveStockKind(pathname))
    useLocalizedPageTitle(category ? `${t(category.titleKey)} | Weavly` : null)
    return null
}
