'use client'

import { useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { retryOfflineNavigation } from '@/lib/offline-recovery'

export function OfflineRecovery() {
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)

  function retry() {
    setRetrying(true)
    retryOfflineNavigation(window.location)
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-hairline bg-surface p-5 text-center shadow-xs sm:p-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
        <WifiOff className="h-6 w-6" aria-hidden="true" />
      </div>

      <h1 className="mt-5 text-2xl font-semibold leading-tight text-ink">{t('common.offline_title')}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('common.offline_description')}</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={retry} disabled={retrying} aria-busy={retrying} className="min-h-[44px] whitespace-normal">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span aria-live="polite">{t(retrying ? 'common.offline_retrying' : 'common.offline_retry')}</span>
        </Button>
        <Button asChild variant="outline" className="min-h-[44px] whitespace-normal">
          <a href="/login">{t('common.offline_sign_in')}</a>
        </Button>
      </div>
    </section>
  )
}
