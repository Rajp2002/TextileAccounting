'use client'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { resolveStockKind, stockDestinations } from '@/lib/stock-navigation'

/** The stock pages' shape while they load: header, on-hand band, two cards and the recent movements. */
export default function StockLoading() {
    const { t } = useTranslation()
    const kind = resolveStockKind(usePathname())
    const category = stockDestinations.find(item => item.id === kind)
    return <div className="space-y-6" aria-busy="true">
        <h1 className="border-b border-hairline/70 pb-5 text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:pb-6 sm:text-[2rem]">{category ? t(category.titleKey) : t('navigation.stock')}</h1>
        <div role="status" aria-label={t('qualityStock.loading')} className="space-y-6">
            <div className="ui-skeleton h-44 rounded-2xl bg-muted" />
            <div className="grid gap-4 md:grid-cols-2">{[1, 2].map(id => <div key={id} className="ui-skeleton h-56 rounded-2xl bg-muted" />)}</div>
            <div className="ui-skeleton h-48 rounded-2xl bg-muted" />
        </div>
    </div>
}
