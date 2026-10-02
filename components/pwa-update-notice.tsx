'use client'

import { useEffect, useEffectEvent, useSyncExternalStore, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { toast as sonnerToast } from 'sonner'
import { toast } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { getPwaUpdateServerSnapshot, getPwaUpdateSnapshot, refreshPwaUpdate, subscribePwaUpdate, watchPwaUpdates } from '@/lib/pwa-update'

export function PwaUpdateNotice() {
    const { t } = useTranslation()
    const isLoginRoute = usePathname() === '/login'
    const { status } = useSyncExternalStore(subscribePwaUpdate, getPwaUpdateSnapshot, getPwaUpdateServerSnapshot)
    const showAvailableNotice = useEffectEvent(() => toast.info(t('common.pwa_update_title'), {
        description: t('common.pwa_update_description'),
        position: 'top-right',
        descriptionClassName: '!text-ink !opacity-100',
        style: {
            '--normal-bg': 'var(--weavly-surface)',
            '--normal-text': 'var(--weavly-ink)',
            '--normal-border': 'var(--weavly-hairline)',
        } as CSSProperties,
        closeButton: true,
        duration: 12000,
        action: { label: t('common.pwa_update_refresh'), onClick: refreshPwaUpdate },
    }))

    useEffect(() => {
        // Login establishes the authentication session across a full document boundary.
        if (window.location.pathname === '/login') return
        let noticeId: string | number | undefined
        const stopWatching = watchPwaUpdates(() => {
            if (noticeId !== undefined) sonnerToast.dismiss(noticeId)
            noticeId = showAvailableNotice()
        })
        return () => {
            stopWatching()
            if (noticeId !== undefined) sonnerToast.dismiss(noticeId)
        }
        // Navigation or translation changes must not cancel a requested activation.
    }, [isLoginRoute])

    useEffect(() => {
        if (isLoginRoute || (status !== 'blocked' && status !== 'failed')) return
        const noticeId = toast.info(t('common.pwa_update_title'), {
            description: t(status === 'blocked' ? 'common.pwa_update_blocked' : 'common.pwa_update_failed'),
            action: { label: t('common.pwa_update_retry'), onClick: refreshPwaUpdate },
        })
        return () => { sonnerToast.dismiss(noticeId) }
    }, [isLoginRoute, status, t])

    return null
}
