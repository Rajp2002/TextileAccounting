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

        // Login is a full-document authentication boundary. Do not run
        // service-worker update checks or activation here: an embedded browser
        // can otherwise reload this route while it is establishing its session.
        if (window.location.pathname === '/login') return

        let disposed = false
        let updateActivationStarted = false

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

            // Watch workers that start installing while this tab is open. A
            // worker that is already waiting is handled below without forcing
            // a reload during navigation.
            const handleUpdateFound = () => {
                removeInstallingWorkerListener()
                removeInstallingWorkerListener = watchWorker(registration, registration.installing)
            }
            registration.addEventListener('updatefound', handleUpdateFound)

            // A worker may have finished while this tab was closed, or another
            // tab may have installed it. Surface that state immediately so a
            // normal browser profile cannot keep using an old route bundle
            // silently. The toast is safe for drafts because it never reloads
            // until the user chooses the refresh action.
            if (registration.waiting && navigator.serviceWorker.controller) {
                showUpdateToast(registration)
            }

            // Service-worker update checks are not guaranteed on every page
            // load. Check once after the registration is ready so a long-lived
            // normal browser profile discovers the current route bundle, then
            // recheck when an already-used tab returns to the foreground.
            void registration.update().catch(() => {
                // Update checks are best-effort and must not interrupt app use.
            })

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
