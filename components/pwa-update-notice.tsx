'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

const UPDATE_REFRESH_FLAG = 'weavly_pwa_update_refreshing'
const UPDATE_TOAST_ID = 'weavly-pwa-update-ready'

export function PwaUpdateNotice() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

        let disposed = false
        const hadControllerAtMount = Boolean(navigator.serviceWorker.controller)

        const showUpdateToast = (
            registration: ServiceWorkerRegistration,
            allowAlreadyActivatedWorker = false
        ) => {
            if (disposed) return
            // A first install can emit controllerchange without there being an
            // update to accept. Only the controllerchange path for a page that
            // was already controlled may offer a refresh after activation.
            if (!registration.waiting && !allowAlreadyActivatedWorker) return

            toast.info('App update ready', {
                id: UPDATE_TOAST_ID,
                description: 'Save any drafts, then refresh to load the latest version.',
                duration: Infinity,
                action: {
                    label: 'Refresh',
                    onClick: () => {
                        sessionStorage.setItem(UPDATE_REFRESH_FLAG, '1')
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
            if (sessionStorage.getItem(UPDATE_REFRESH_FLAG) === '1') {
                sessionStorage.removeItem(UPDATE_REFRESH_FLAG)
                return
            }
            if (!hadControllerAtMount) return
            void navigator.serviceWorker.ready.then((registration) => {
                showUpdateToast(registration, true)
            })
        }

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

        return () => {
            disposed = true
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        }
    }, [])

    return null
}
