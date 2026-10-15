'use client'

import { captureMessage } from '@sentry/nextjs'
import { prepareForPwaRefresh } from '@/lib/pwa-refresh-safety'

export type PwaUpdateStatus = 'idle' | 'available' | 'activating' | 'ready' | 'blocked'
export type PwaUpdateSnapshot = { status: PwaUpdateStatus; buildId: string | null }
type PwaUpdateFailure = 'timeout' | 'redundant' | 'post_message'

const BUILD_ID_TIMEOUT_MS = 1500
// Activation waits for the old worker to go idle, which on one Windows PC never
// happened within 30 seconds. Documents are network-only, so after this wait a
// plain reload still loads the new build; the worker swaps in once it can.
const ACTIVATION_TIMEOUT_MS = 5_000
const UPDATE_NOTICE_KEY_PREFIX = 'weavly_pwa_update_toast_seen:'
const serverSnapshot: PwaUpdateSnapshot = { status: 'idle', buildId: null }
let snapshot = serverSnapshot
let target: { registration: ServiceWorkerRegistration; worker: ServiceWorker } | null = null
let cancelActivation: (() => void) | null = null
let reloadIssued = false
const subscribers = new Set<() => void>()
const announcedBuilds = new Set<string>()
const announcedLegacyWorkers = new WeakSet<ServiceWorker>()

export function getPwaUpdateSnapshot() { return snapshot }
export function getPwaUpdateServerSnapshot() { return serverSnapshot }
export function subscribePwaUpdate(callback: () => void) {
    subscribers.add(callback)
    return () => { subscribers.delete(callback) }
}

function setSnapshot(status: PwaUpdateStatus, buildId = snapshot.buildId) {
    if (snapshot.status === status && snapshot.buildId === buildId) return
    snapshot = { status, buildId }
    subscribers.forEach((callback) => callback())
}

function isLogin() { return window.location.pathname === '/login' }

// Defined by Next's webpack configuration, like the worker's copy.
declare const __WEAVLY_BUILD_ID__: string | undefined
function pageBuildId() { return typeof __WEAVLY_BUILD_ID__ === 'string' ? __WEAVLY_BUILD_ID__ : null }

/** Ask this worker, not the current controller: every deployment uses /sw.js. */
export function queryWorkerBuildId(worker: ServiceWorker, signal?: AbortSignal): Promise<string | null> {
    if (signal?.aborted) return Promise.resolve(null)
    return new Promise((resolve) => {
        let channel: MessageChannel
        try { channel = new MessageChannel() } catch { resolve(null); return }
        let settled = false
        const finish = (buildId: string | null) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            signal?.removeEventListener('abort', abort)
            channel.port1.onmessage = null
            channel.port1.close()
            channel.port2.close()
            resolve(buildId)
        }
        const abort = () => finish(null)
        const timeout = setTimeout(abort, BUILD_ID_TIMEOUT_MS)
        channel.port1.onmessage = (event) => {
            const value = event.data
            if (value?.type === 'WEAVLY_BUILD_ID' && typeof value.buildId === 'string' && value.buildId.trim()) {
                finish(value.buildId)
            }
        }
        signal?.addEventListener('abort', abort, { once: true })
        try { worker.postMessage({ type: 'WEAVLY_GET_BUILD_ID' }, [channel.port2]) } catch { finish(null) }
    })
}

function shouldAnnounce(worker: ServiceWorker, buildId: string | null) {
    if (!buildId) {
        // Older deployed workers do not understand the handshake. Suppress only
        // this worker object in memory; never persist /sw.js or "unknown".
        if (announcedLegacyWorkers.has(worker)) return false
        announcedLegacyWorkers.add(worker)
        return true
    }
    if (announcedBuilds.has(buildId)) return false
    announcedBuilds.add(buildId)
    const key = `${UPDATE_NOTICE_KEY_PREFIX}${encodeURIComponent(buildId)}`
    try {
        if (sessionStorage.getItem(key) === '1') return false
        sessionStorage.setItem(key, '1')
    } catch {
        // In-memory deduplication also works with restricted storage.
    }
    return true
}

function reloadWhenSafe() {
    if (reloadIssued) return
    setSnapshot('ready')
    // The user may have started editing during worker activation. Registered
    // draft flushes and blockers must be checked again immediately before reload.
    if (isLogin() || !prepareForPwaRefresh()) {
        setSnapshot('blocked')
        return
    }
    reloadIssued = true
    window.location.reload()
}

function reportFailure(reason: PwaUpdateFailure, worker: ServiceWorker, registration: ServiceWorkerRegistration, startedAt: number) {
    try {
        captureMessage('pwa_update_failed', {
            level: 'warning',
            tags: { pwa_update_failure: reason },
            extra: {
                elapsedMs: Date.now() - startedAt,
                workerState: worker.state,
                waitingState: registration.waiting?.state ?? null,
                installingState: registration.installing?.state ?? null,
                activeState: registration.active?.state ?? null,
                buildId: snapshot.buildId,
            },
        })
    } catch {
        // Reporting is diagnostic only.
    }
}

/** Only an explicit user action can activate an update and reload this page. */
export function refreshPwaUpdate() {
    if (typeof window === 'undefined' || isLogin() || !target || reloadIssued || snapshot.status === 'activating') return
    if (!prepareForPwaRefresh()) {
        setSnapshot('blocked')
        return
    }
    const { registration } = target
    // A newer deployment can replace the offered worker before this page sees
    // its statechange, so apply whichever version is waiting now.
    const waiting = registration.waiting
    if (waiting && waiting !== target.worker && target.worker.state !== 'activated') target = { registration, worker: waiting }
    const worker = target.worker
    const serviceWorker = navigator.serviceWorker
    if (worker.state === 'activated' || serviceWorker.controller === worker) {
        reloadWhenSafe()
        return
    }
    const startedAt = Date.now()
    if (worker.state === 'redundant') {
        // Another window may already have applied the update.
        const active = registration.active
        if (active && active.state === 'activated' && active !== serviceWorker.controller) {
            reloadWhenSafe()
            return
        }
        reportFailure('redundant', worker, registration, startedAt)
        reloadWhenSafe()
        return
    }

    let finished = false
    const cleanup = () => {
        clearTimeout(timeout)
        worker.removeEventListener('statechange', checkActivation)
        serviceWorker.removeEventListener('controllerchange', checkActivation)
        cancelActivation = null
    }
    const fail = (reason: PwaUpdateFailure) => {
        if (finished) return
        finished = true
        cleanup()
        reportFailure(reason, worker, registration, startedAt)
        reloadWhenSafe()
    }
    const checkActivation = () => {
        if (finished) return
        if (worker.state === 'redundant') { fail('redundant'); return }
        // clientsClaim is disabled, so activation can finish without this tab's
        // controller changing. An unrelated controller change is not success.
        if (worker.state !== 'activated' && serviceWorker.controller !== worker) return
        finished = true
        cleanup()
        reloadWhenSafe()
    }
    const timeout = setTimeout(() => fail('timeout'), ACTIVATION_TIMEOUT_MS)
    cancelActivation = () => {
        finished = true
        cleanup()
        setSnapshot(worker.state === 'activated' ? 'ready' : 'available')
    }
    setSnapshot('activating')
    worker.addEventListener('statechange', checkActivation)
    serviceWorker.addEventListener('controllerchange', checkActivation)
    try {
        worker.postMessage({ type: 'SKIP_WAITING' })
        checkActivation()
    } catch { fail('post_message') }
}

/** One shell-level watcher owns listeners; menu controls consume the shared store. */
export function watchPwaUpdates(onAvailable: () => void) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || isLogin()) return () => {}
    let disposed = false
    let cleanupRegistration = () => {}
    let removeInstallingListener = () => {}
    const queries = new Set<AbortController>()

    const offerWorker = async (registration: ServiceWorkerRegistration, worker: ServiceWorker) => {
        if (disposed || isLogin() || !navigator.serviceWorker.controller) return
        if (target?.worker !== worker) {
            cancelActivation?.()
            target = { registration, worker }
            setSnapshot('available', null)
        }
        const query = new AbortController()
        queries.add(query)
        const buildId = await queryWorkerBuildId(worker, query.signal)
        queries.delete(query)
        if (disposed || isLogin() || target?.worker !== worker) return
        if (buildId && buildId === pageBuildId()) {
            // Documents are network-only, so a page loaded after the deploy already
            // runs this build. The worker takes over when every window has closed.
            target = null
            setSnapshot('idle', null)
            return
        }
        setSnapshot(snapshot.status, buildId)
        if (shouldAnnounce(worker, buildId)) onAvailable()
    }

    navigator.serviceWorker.ready.then((registration) => {
        if (disposed || isLogin()) return
        const watchInstalling = () => {
            removeInstallingListener()
            const worker = registration.installing
            if (!worker) return
            const onStateChange = () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    void offerWorker(registration, registration.waiting ?? worker)
                }
            }
            worker.addEventListener('statechange', onStateChange)
            removeInstallingListener = () => worker.removeEventListener('statechange', onStateChange)
            onStateChange()
        }
        registration.addEventListener('updatefound', watchInstalling)
        // Catch installation already in progress before ready resolves.
        watchInstalling()
        if (registration.waiting && navigator.serviceWorker.controller) {
            void offerWorker(registration, registration.waiting)
        }
        const checkForUpdate = () => { void registration.update().catch(() => {}) }
        checkForUpdate()
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isLogin()) checkForUpdate()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        cleanupRegistration = () => {
            registration.removeEventListener('updatefound', watchInstalling)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            removeInstallingListener()
        }
    }).catch(() => {
        // Service workers are optional; an unavailable registration must not block work.
    })

    return () => {
        disposed = true
        cleanupRegistration()
        queries.forEach((query) => query.abort())
        queries.clear()
        cancelActivation?.()
    }
}
