'use client'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
export default function StockError({ reset }: { reset: () => void }) {
    const { t } = useTranslation()
    return (
        <div role="alert" className="space-y-4 rounded-xl border p-6">
            <h1 className="border-b border-hairline/80 pb-5 text-center text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
                {t('qualityStock.title')}
            </h1>
            <p>{t('qualityStock.loadError')}</p>
            <Button onClick={reset}>{t('qualityStock.retry')}</Button>
        </div>
    )
}
