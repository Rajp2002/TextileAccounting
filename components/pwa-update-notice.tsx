'use client'

import { useEffect, type CSSProperties } from 'react'
import { toast } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'

const UPDATE_TOAST_SHOWN_FLAG_PREFIX = 'weavly_pwa_update_toast_seen:'
// The versioned session key prevents repeat notices for the same worker while
// allowing a later deployment to notify once. The legacy session-only check
// was readSessionFlag(UPDATE_TOAST_SHOWN_FLAG); versioning it avoids suppressing
// notices for future deployments.
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
        let updateActivationStarted = false

        // Password AutoFill populates the login controls before the worker is
        // ready. Login is still a safe update boundary: credentials remain in
        // the password manager and no authenticated business draft is open.
        const isLoginRefreshBoundary = () => window.location.pathname === '/login'

        const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
            const waitingWorker = registration.waiting
            if (!waitingWorker || !navigator.serviceWorker.controller) return false
            if (updateActivationStarted) return true

            updateActivationStarted = true
            let reloading = false
            const reloadWithNewController = () => {
                if (reloading) return
                reloading = true
                window.location.reload()
            }

            navigator.serviceWorker.addEventListener('controllerchange', reloadWithNewController, { once: true })
            waitingWorker.postMessage({ type: 'SKIP_WAITING' })
            window.setTimeout(reloadWithNewController, 3000)
            return true
        }

        const showUpdateToast = (registration: ServiceWorkerRegistration) => {
            if (disposed) return

            // The login page has no draft state to protect. Activate a waiting
            // worker before credentials cross the auth boundary; otherwise an
            // old login bundle can navigate into a newer RSC/loading boundary
            // and leave a PWA stuck on its spinner.
            if (isLoginRefreshBoundary() && activateWaitingWorker(registration)) return

            const versionKey = `${UPDATE_TOAST_SHOWN_FLAG}${encodeURIComponent(getUpdateVersionKey(registration))}`
            if (readSessionFlag(versionKey)) return
            writeSessionFlag(versionKey, '1')
            toast.info(t('common.pwa_update_title'), {
                description: `${t('common.pwa_update_description')} You can keep working; refresh after the current costing or quotation says Saved.`,
                // Keep the notice in a predictable corner instead of covering
                // the page's main content. The explicit colors also keep the
                // description readable on white public/auth screens.
                position: 'top-right',
                descriptionClassName: '!text-ink !opacity-100',
                style: {
                    '--normal-bg': 'var(--weavly-surface)',
                    '--normal-text': 'var(--weavly-ink)',
                    '--normal-border': 'var(--weavly-hairline)',
                } as CSSProperties,
                closeButton: true,
                duration: 12000,
                action: {
                    label: t('common.pwa_update_refresh'),
                    onClick: () => {
                        if (!activateWaitingWorker(registration)) {
                            window.location.reload()
                        }
                    },
                },
            })
        }

        const watchWorker = (registration: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
            if (!worker) return () => {}

            const handleStateChange = () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateToast(registration)
                }
            }

            worker.addEventListener('statechange', handleStateChange)
            return () => worker.removeEventListener('statechange', handleStateChange)
        }

        let removeInstallingWorkerListener = () => {}
        let cleanupRegistrationListeners = () => {}

        navigator.serviceWorker.ready.then((registration) => {
            if (disposed) return

            if (registration.waiting && isLoginRefreshBoundary()) {
                activateWaitingWorker(registration)
            }

            // A waiting worker can be left behind by another tab. Do not turn
            // a fresh navigation into an interruption; only announce workers
            // that finish installing while this tab is already open.
            const handleUpdateFound = () => {
                removeInstallingWorkerListener()
                removeInstallingWorkerListener = watchWorker(registration, registration.installing)
            }
            registration.addEventListener('updatefound', handleUpdateFound)

            // A fresh tab should not trigger an update check just to display a
            // refresh prompt. Recheck when an already-used tab returns to the
            // foreground, which still lets long-lived tabs pick up deployments
            // without interrupting their initial navigation.
            let hasCompletedInitialVisibility = document.visibilityState === 'visible'
            let wasHiddenAfterInitialVisibility = false
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    if (hasCompletedInitialVisibility) wasHiddenAfterInitialVisibility = true
                    return
                }

                if (!hasCompletedInitialVisibility) {
                    hasCompletedInitialVisibility = true
                    return
                }

                if (!wasHiddenAfterInitialVisibility) return
                wasHiddenAfterInitialVisibility = false
                void registration.update().catch(() => {
                    // Update checks are best-effort and must not interrupt drafts.
                })
            }

            document.addEventListener('visibilitychange', handleVisibilityChange)

            cleanupRegistrationListeners = () => {
                registration.removeEventListener('updatefound', handleUpdateFound)
                document.removeEventListener('visibilitychange', handleVisibilityChange)
                removeInstallingWorkerListener()
            }
        }).catch(() => {
            // Service-worker registration is best-effort and should not block app use.
        })

        return () => {
            disposed = true
            cleanupRegistrationListeners()
            removeInstallingWorkerListener()
        }
    }, [t])

    return null
}
