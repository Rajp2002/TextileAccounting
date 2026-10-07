'use client'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { resolveStockKind, stockDestinations } from '@/lib/stock-navigation'

export default function StockLoading() {
    const { t } = useTranslation()
    const kind = resolveStockKind(usePathname())
    const category = stockDestinations.find(item => item.id === kind)
    return <div className="space-y-5" aria-busy="true">
        <h1 className="border-b border-hairline/80 pb-5 text-center text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">{category ? t(category.titleKey) : t('navigation.stock')}</h1>
        <div role="status" aria-label={t('qualityStock.loading')} className="space-y-5">
            <div className="ui-skeleton h-28 rounded-xl bg-muted" />
            <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(id => <div key={id} className="ui-skeleton h-40 rounded-xl bg-muted" />)}</div>
        </div>
    </div>
}
