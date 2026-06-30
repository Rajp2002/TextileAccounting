'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

const UPDATE_REFRESH_FLAG = 'weavly_pwa_update_refreshing'

export function PwaUpdateNotice() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

        let disposed = false

        const showUpdateToast = () => {
            if (disposed) return
            toast.info('App update ready', {
                description: 'Save any drafts, then refresh to load the latest version.',
                duration: Infinity,
                action: {
                    label: 'Refresh',
                    onClick: () => {
                        sessionStorage.setItem(UPDATE_REFRESH_FLAG, '1')
                        window.location.reload()
                    },
                },
            })
        }

        const watchWorker = (worker: ServiceWorker | null) => {
            if (!worker) return
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateToast()
                }
            })
        }

        navigator.serviceWorker.ready.then((registration) => {
            if (disposed) return
            if (registration.waiting && navigator.serviceWorker.controller) {
                showUpdateToast()
            }
            registration.addEventListener('updatefound', () => watchWorker(registration.installing))
        }).catch(() => {
            // Service-worker registration is best-effort and should not block app use.
        })

        const handleControllerChange = () => {
            if (sessionStorage.getItem(UPDATE_REFRESH_FLAG) === '1') {
                sessionStorage.removeItem(UPDATE_REFRESH_FLAG)
                return
            }
            showUpdateToast()
        }

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

        return () => {
            disposed = true
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        }
    }, [])

    return null
}
