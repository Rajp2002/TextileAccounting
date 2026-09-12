'use client'

import { I18nProvider } from '@/lib/i18n/context'
import { PwaUpdateNotice } from '@/components/pwa-update-notice'
import { PwaInstallNudge } from '@/components/pwa-install-nudge'
import { MobileViewport } from '@/components/mobile-viewport'
import { MobileInputNavigation } from '@/components/mobile-input-navigation'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <MobileViewport />
            <MobileInputNavigation />
            <PwaUpdateNotice />
            <PwaInstallNudge />
            {children}
        </I18nProvider>
    )
}
