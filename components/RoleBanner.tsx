'use client'

import Link from 'next/link'
import { ArrowRight, UserRound } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface RoleBannerProps {
    href: string
}

export function RoleBanner({ href }: RoleBannerProps) {
    const { t } = useTranslation()

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-amber-900">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                        <UserRound className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{t('floor.ownerBanner.message')}</p>
                    </div>
                </div>
                <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-amber-900 transition-colors hover:text-amber-700"
                >
                    {t('floor.ownerBanner.switch')}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </div>
    )
}
