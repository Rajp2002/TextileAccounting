'use client'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { resolveStockKind, stockDestinations } from '@/lib/stock-navigation'

export default function StockLoading() {
    const { t } = useTranslation()
    const kind = resolveStockKind(usePathname())
    const category = stockDestinations.find(item => item.id === kind)
    return <div className="space-y-5">
        <h1 className="text-3xl font-semibold">{category ? t(category.titleKey) : t('navigation.stock')}</h1>
        <div role="status" aria-label={t('qualityStock.loading')} className="animate-pulse space-y-5 motion-reduce:animate-none">
            <div className="h-28 rounded-xl bg-muted" />
            <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(id => <div key={id} className="h-40 rounded-xl bg-muted" />)}</div>
        </div>
    </div>
}
