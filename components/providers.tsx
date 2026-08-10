'use client'

import { I18nProvider } from '@/lib/i18n/context'
import { PwaUpdateNotice } from '@/components/pwa-update-notice'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <PwaUpdateNotice />
            {children}
        </I18nProvider>
    )
}
