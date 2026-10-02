'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { getPwaUpdateServerSnapshot, getPwaUpdateSnapshot, refreshPwaUpdate, subscribePwaUpdate } from '@/lib/pwa-update'

export function PwaUpdateAction({ className }: { className?: string }) {
    const { t } = useTranslation()
    const pathname = usePathname()
    const { status } = useSyncExternalStore(subscribePwaUpdate, getPwaUpdateSnapshot, getPwaUpdateServerSnapshot)
    if (pathname === '/login' || status === 'idle') return null
    const retry = status === 'failed' || status === 'blocked'

    return (
        <div className={className}>
            {retry && (
                <p className="mb-2 text-xs text-inherit opacity-90" role="status">
                    {t(status === 'blocked' ? 'common.pwa_update_blocked' : 'common.pwa_update_failed')}
                </p>
            )}
            <Button type="button" variant="outline" className="h-auto min-h-[44px] w-full whitespace-normal py-2" disabled={status === 'activating'} onClick={refreshPwaUpdate}>
                <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
                {t(status === 'activating' ? 'common.pwa_update_applying' : retry ? 'common.pwa_update_retry' : 'common.pwa_update_refresh')}
            </Button>
        </div>
    )
}
