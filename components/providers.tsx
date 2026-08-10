'use client'

import { I18nProvider } from '@/lib/i18n/context'
import { PwaSessionGuard } from '@/components/pwa-session-guard'
import { PwaUpdateNotice } from '@/components/pwa-update-notice'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <PwaSessionGuard />
            <PwaUpdateNotice />
            {children}
        </I18nProvider>
    )
}
