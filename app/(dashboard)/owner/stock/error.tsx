'use client'
import { usePathname } from 'next/navigation'
import { resolveStockKind } from '@/lib/stock-navigation'
import { yarnStockText } from '@/lib/i18n/yarn-stock'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
export default function StockError({ reset }: { reset: () => void }) {
    const { t, language } = useTranslation()
    const yarn = resolveStockKind(usePathname()) === 'yarn'
    return (
        <div role="alert" className="space-y-4 rounded-xl border p-6">
            <h1 className="border-b border-hairline/80 pb-5 text-center text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
                {t(yarn ? 'navigation.yarnStock' : 'qualityStock.title')}
            </h1>
            <p>{yarn ? yarnStockText[language].loadError : t('qualityStock.loadError')}</p>
            <Button onClick={reset}>{t('qualityStock.retry')}</Button>
        </div>
    )
}
