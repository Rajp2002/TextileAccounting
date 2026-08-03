'use client'

import { useEffect } from 'react'
import { toast } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'

const UPDATE_REFRESH_FLAG = 'weavly_pwa_update_refreshing'
const UPDATE_TOAST_SHOWN_FLAG = 'weavly_pwa_update_toast_seen'

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

export function PwaUpdateNotice() {
    const { t } = useTranslation()

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

        let disposed = false

        const showUpdateToast = (registration: ServiceWorkerRegistration) => {
            if (disposed) return
            if (readSessionFlag(UPDATE_TOAST_SHOWN_FLAG)) return
            writeSessionFlag(UPDATE_TOAST_SHOWN_FLAG, '1')
            toast.info(t('common.pwa_update_title'), {
                description: t('common.pwa_update_description'),
                // The session flag prevents repeat interruptions; a finite
                // duration lets active costing continue without a persistent toast.
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
