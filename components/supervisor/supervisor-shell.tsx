'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import LogoutButton from '@/components/auth/logout-button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useTranslation } from '@/lib/i18n/context'
import { supervisorText } from '@/lib/i18n/supervisor-access'

/** The whole supervisor workspace: no owner navigation, one page at a time. */
export function SupervisorShell({ factoryName, fullName, children }: { factoryName: string | null; fullName: string; children: ReactNode }) {
    const { language } = useTranslation()
    return (
        <div className="safe-area-page min-h-svh bg-background">
            <header className="sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="relative block h-8 w-16 shrink-0">
                            <Image src="/images/WeavlyLogo.png" alt="Weavly" fill sizes="4rem" className="object-contain" priority />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-ink" data-i18n-skip="true">{factoryName ?? 'Weavly'}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                                <span data-i18n-skip="true">{fullName}</span> · {supervisorText(language, 'supervisorRole')}
                            </span>
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <LanguageSwitcher align="right" placement="bottom" className="min-h-[44px] border border-hairline bg-surface text-ink" />
                        <LogoutButton variant="header" className="min-h-[44px]" />
                    </div>
                </div>
            </header>
            <main className="mx-auto w-full max-w-3xl px-4 py-4 sm:py-6">{children}</main>
        </div>
    )
}
