'use client'

import { I18nProvider } from '@/lib/i18n/context'
import { PwaUpdateNotice } from '@/components/pwa-update-notice'
import { PwaInstallNudge } from '@/components/pwa-install-nudge'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <PwaUpdateNotice />
            <PwaInstallNudge />
            {children}
        </I18nProvider>
    )
}
