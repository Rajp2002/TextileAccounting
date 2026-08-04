'use client'

import { ArchiveRestore, ChevronDown } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export function ArchivePolicyNotice() {
    const { t } = useTranslation()

    return (
        <details className="group overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/70 text-sm text-indigo-950">
            <summary className="estimator-touch-target flex cursor-pointer list-none items-center gap-3 px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
                <ArchiveRestore className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
                <span className="min-w-0 flex-1 font-bold">{t('base_plan.archive.title')}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-indigo-500 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div role="note" className="space-y-1.5 border-t border-indigo-200 px-4 pb-4 pt-3 leading-relaxed">
                <p>{t('base_plan.archive.description')} {t('base_plan.archive.restore')}</p>
                <p>{t('base_plan.archive.deletion')} {t('base_plan.archive.privacy')}</p>
            </div>
        </details>
    )
}
