'use client'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
export default function StockError({ reset }: { reset: () => void }) {
    const { t } = useTranslation()
    return <div role="alert" className="space-y-4 rounded-xl border p-6"><h1 className="text-xl font-semibold">{t('qualityStock.loadError')}</h1><Button onClick={reset}>{t('qualityStock.retry')}</Button></div>
}
