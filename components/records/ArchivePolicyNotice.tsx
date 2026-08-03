'use client'

import { ArchiveRestore } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export function ArchivePolicyNotice() {
    const { t } = useTranslation()

    return (
        <div role="note" className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950">
            <div className="flex items-start gap-3">
                <ArchiveRestore className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
                <div className="space-y-1.5 leading-relaxed">
                    <p className="font-bold">{t('base_plan.archive.title')}</p>
                    <p>{t('base_plan.archive.description')} {t('base_plan.archive.restore')}</p>
                    <p>{t('base_plan.archive.deletion')} {t('base_plan.archive.privacy')}</p>
                </div>
            </div>
        </div>
    )
}
