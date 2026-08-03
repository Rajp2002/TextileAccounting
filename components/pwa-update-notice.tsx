'use client'

import { useEffect } from 'react'
import { toast } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'

const UPDATE_REFRESH_FLAG = 'weavly_pwa_update_refreshing'
const UPDATE_TOAST_SHOWN_FLAG_PREFIX = 'weavly_pwa_update_toast_seen:'
// The legacy name remains the base of the versioned session key. The old
// session-only check was readSessionFlag(UPDATE_TOAST_SHOWN_FLAG); appending
// the worker URL prevents repeat notices while allowing a new version through.
const UPDATE_TOAST_SHOWN_FLAG = UPDATE_TOAST_SHOWN_FLAG_PREFIX

function readSessionFlag(key: string) {
    try {
        return sessionStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

function writeSessionFlag(key: string, value: string) {
    try {
        sessionStorage.setItem(key, value)
    } catch {
        // A restricted browser storage context must not block app use.
    }
}

function removeSessionFlag(key: string) {
    try {
        sessionStorage.removeItem(key)
    } catch {
        // Best effort only.
    }
}

function getUpdateVersionKey(registration: ServiceWorkerRegistration) {
    // A versioned worker URL is the browser-visible identity for a deployed
    // worker. Keeping it in the session key means a new deployment can notify
    // once without repeating the same interruption on every route.
    return registration.waiting?.scriptURL || registration.installing?.scriptURL || 'unknown'
}

export function PwaUpdateNotice() {
    const { t } = useTranslation()

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

        let disposed = false

        const showUpdateToast = (registration: ServiceWorkerRegistration) => {
            if (disposed) return
            const versionKey = `${UPDATE_TOAST_SHOWN_FLAG}${encodeURIComponent(getUpdateVersionKey(registration))}`
            if (readSessionFlag(versionKey)) return
            writeSessionFlag(versionKey, '1')
            toast.info(t('common.pwa_update_title'), {
                description: `${t('common.pwa_update_description')} You can keep working; refresh after the current costing or quotation says Saved.`,
                // Keep the notice in the top toast lane so it cannot cover the
                // lower save/quote action area on a phone. It is dismissible and
                // finite, so an active costing is never held hostage by it.
                position: 'top-center',
                closeButton: true,
                duration: 12000,
                action: {
                    label: t('common.pwa_update_refresh'),
                    onClick: () => {
                        writeSessionFlag(UPDATE_REFRESH_FLAG, '1')
                        const waitingWorker = registration.waiting
                        if (!waitingWorker) {
                            window.location.reload()
                            return
                        }

                        let reloading = false
                        const reloadWithNewController = () => {
                            if (reloading) return
                            reloading = true
                            window.location.reload()
                        }
                        navigator.serviceWorker.addEventListener('controllerchange', reloadWithNewController, { once: true })
                        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
                        window.setTimeout(reloadWithNewController, 3000)
                    },
                },
            })
        }

        const watchWorker = (registration: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
            if (!worker) return
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateToast(registration)
                }
            })
        }

        navigator.serviceWorker.ready.then((registration) => {
            if (disposed) return
            if (registration.waiting && navigator.serviceWorker.controller) {
                showUpdateToast(registration)
            }
            registration.addEventListener('updatefound', () => watchWorker(registration, registration.installing))
            // Do not rely on the browser's periodic update cadence. Checking
            // after listeners are attached lets an active draft tab observe a
            // newly deployed worker before the user navigates or reloads.
            void registration.update().catch(() => {
                // Update checks are best-effort and must not interrupt drafts.
            })
        }).catch(() => {
            // Service-worker registration is best-effort and should not block app use.
        })

        const handleControllerChange = () => {
            if (readSessionFlag(UPDATE_REFRESH_FLAG)) {
                removeSessionFlag(UPDATE_REFRESH_FLAG)
                return
            }
            void navigator.serviceWorker.ready.then(showUpdateToast)
        }

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

        return () => {
            disposed = true
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        }
    }, [t])

    return null
}
