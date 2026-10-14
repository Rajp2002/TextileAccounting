import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prepare, captureMessage } = vi.hoisted(() => ({ prepare: vi.fn(() => true), captureMessage: vi.fn() }))
vi.mock('../lib/pwa-refresh-safety', () => ({ prepareForPwaRefresh: prepare }))
vi.mock('@sentry/nextjs', () => ({ captureMessage }))

class FakePort {
    peer!: FakePort
    onmessage: ((event: MessageEvent) => void) | null = null
    close = vi.fn()
    postMessage(data: unknown) { this.peer.onmessage?.({ data } as MessageEvent) }
}

class FakeChannel {
    static instances: FakeChannel[] = []
    port1 = new FakePort()
    port2 = new FakePort()
    constructor() {
        this.port1.peer = this.port2
        this.port2.peer = this.port1
        FakeChannel.instances.push(this)
    }
}

class FakeWorker extends EventTarget {
    state: ServiceWorkerState = 'installed'
    scriptURL = 'https://weavly.test/sw.js'
    throwOnActivation = false
    constructor(readonly buildId: string | null = 'build-a') { super() }
    postMessage = vi.fn((message: { type: string }, ports?: FakePort[]) => {
        if (message.type === 'WEAVLY_GET_BUILD_ID' && this.buildId) {
            ports?.[0].postMessage({ type: 'WEAVLY_BUILD_ID', buildId: this.buildId })
        }
        if (message.type === 'SKIP_WAITING' && this.throwOnActivation) throw new Error('worker unavailable')
    })
    transition(state: ServiceWorkerState) {
        this.state = state
        this.dispatchEvent(new Event('statechange'))
    }
    asWorker() { return this as unknown as ServiceWorker }
}

class FakeRegistration extends EventTarget {
    installing: FakeWorker | null = null
    active: FakeWorker | null = null
    update = vi.fn(async () => undefined)
    constructor(public waiting: FakeWorker | null) { super() }
}

let cleanup: () => void
let reload: ReturnType<typeof vi.fn>
let registration: FakeRegistration
let serviceWorker: EventTarget & { controller: FakeWorker; ready: Promise<FakeRegistration> }
let storage: Map<string, string>
let location: { pathname: string; reload: ReturnType<typeof vi.fn> }
let documentEvents: EventTarget & { visibilityState: string }

async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
async function start(worker = new FakeWorker()) {
    registration.waiting = worker
    const manager = await import('../lib/pwa-update')
    const notify = vi.fn()
    cleanup = manager.watchPwaUpdates(notify)
    await settle()
    return { manager, notify, worker }
}
function installLater(worker: FakeWorker) {
    worker.state = 'installing'
    registration.installing = worker
    registration.dispatchEvent(new Event('updatefound'))
    registration.waiting = worker
    worker.transition('installed')
}

beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    prepare.mockReset().mockReturnValue(true)
    captureMessage.mockReset()
    cleanup = () => {}
    reload = vi.fn()
    location = { pathname: '/owner/estimator', reload }
    storage = new Map()
    FakeChannel.instances = []
    registration = new FakeRegistration(null)
    serviceWorker = Object.assign(new EventTarget(), {
        controller: new FakeWorker('old-build'),
        ready: Promise.resolve(registration),
    })
    documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('window', { location })
    vi.stubGlobal('navigator', { serviceWorker })
    vi.stubGlobal('document', documentEvents)
    vi.stubGlobal('MessageChannel', FakeChannel)
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
    })
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('PWA update discovery', () => {
    it('announces distinct builds at the same script URL and retains each available action', async () => {
        const { manager, notify, worker } = await start()
        expect(notify).toHaveBeenCalledTimes(1)
        expect(manager.getPwaUpdateSnapshot()).toEqual({ status: 'available', buildId: 'build-a' })
        expect(serviceWorker.controller.postMessage).not.toHaveBeenCalled()
        cleanup()
        cleanup = manager.watchPwaUpdates(notify)
        await settle()
        expect(notify).toHaveBeenCalledTimes(1)
        const laterWorker = new FakeWorker('build-b')
        expect(laterWorker.scriptURL).toBe(worker.scriptURL)
        installLater(laterWorker)
        await settle()
        expect(notify).toHaveBeenCalledTimes(2)
        expect(manager.getPwaUpdateSnapshot()).toEqual({ status: 'available', buildId: 'build-b' })
        expect([...storage.keys()]).toEqual([
            'weavly_pwa_update_toast_seen:build-a', 'weavly_pwa_update_toast_seen:build-b',
        ])
        manager.refreshPwaUpdate()
        expect(laterWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
        expect(worker.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    })

    it('deduplicates a known build across document loads while keeping the action available', async () => {
        await start()
        cleanup()
        vi.resetModules()
        const { manager, notify } = await start(new FakeWorker('build-a'))
        expect(notify).not.toHaveBeenCalled()
        expect(manager.getPwaUpdateSnapshot().status).toBe('available')
    })

    it('uses only an in-memory worker identity for legacy workers', async () => {
        const { manager, notify } = await start(new FakeWorker(null))
        expect(manager.getPwaUpdateSnapshot().status).toBe('available')
        await vi.advanceTimersByTimeAsync(1500)
        expect(notify).toHaveBeenCalledTimes(1)
        cleanup()
        cleanup = manager.watchPwaUpdates(notify)
        await settle()
        await vi.advanceTimersByTimeAsync(1500)
        expect(notify).toHaveBeenCalledTimes(1)
        installLater(new FakeWorker(null))
        await vi.advanceTimersByTimeAsync(1500)
        expect(notify).toHaveBeenCalledTimes(2)
        expect(storage.size).toBe(0)
    })

    it('observes an installation already in progress when the registration is ready', async () => {
        const installing = new FakeWorker('already-installing')
        installing.state = 'installing'
        registration.installing = installing
        const manager = await import('../lib/pwa-update')
        const notify = vi.fn()
        cleanup = manager.watchPwaUpdates(notify)
        await settle()
        expect(notify).not.toHaveBeenCalled()
        registration.waiting = installing
        installing.transition('installed')
        await settle()
        expect(notify).toHaveBeenCalledTimes(1)
        expect(manager.getPwaUpdateSnapshot().buildId).toBe('already-installing')
    })

    it('cleans message ports on success, timeout, and abort', async () => {
        const manager = await import('../lib/pwa-update')
        expect(await manager.queryWorkerBuildId(new FakeWorker().asWorker())).toBe('build-a')
        const timeoutQuery = manager.queryWorkerBuildId(new FakeWorker(null).asWorker())
        await vi.advanceTimersByTimeAsync(1500)
        expect(await timeoutQuery).toBeNull()
        const controller = new AbortController()
        const abortedQuery = manager.queryWorkerBuildId(new FakeWorker(null).asWorker(), controller.signal)
        controller.abort()
        expect(await abortedQuery).toBeNull()
        for (const channel of FakeChannel.instances) {
            expect(channel.port1.close).toHaveBeenCalledTimes(1)
            expect(channel.port2.close).toHaveBeenCalledTimes(1)
            expect(channel.port1.onmessage).toBeNull()
        }
        expect(vi.getTimerCount()).toBe(0)
    })

    it('does not let a disposed or stale query announce an earlier worker', async () => {
        const { manager, notify } = await start(new FakeWorker(null))
        const oldChannel = FakeChannel.instances[0]
        installLater(new FakeWorker('build-b'))
        await settle()
        oldChannel.port2.postMessage({ type: 'WEAVLY_BUILD_ID', buildId: 'build-a' })
        await settle()
        expect(manager.getPwaUpdateSnapshot().buildId).toBe('build-b')
        expect(notify).toHaveBeenCalledTimes(1)
        installLater(new FakeWorker(null))
        cleanup()
        await vi.advanceTimersByTimeAsync(1500)
        expect(notify).toHaveBeenCalledTimes(1)
        expect(FakeChannel.instances.at(-1)?.port1.close).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('keeps the newer build when an aborted watcher resolves after remount', async () => {
        const { manager, notify } = await start(new FakeWorker(null))
        cleanup()
        registration.waiting = new FakeWorker('build-b')
        cleanup = manager.watchPwaUpdates(notify)
        await settle()
        expect(manager.getPwaUpdateSnapshot()).toEqual({ status: 'available', buildId: 'build-b' })
        expect(notify).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('does not discover or activate an update on login', async () => {
        location.pathname = '/login'
        const { manager, notify, worker } = await start()
        manager.refreshPwaUpdate()
        expect(registration.update).not.toHaveBeenCalled()
        expect(notify).not.toHaveBeenCalled()
        expect(worker.postMessage).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled()
    })
})

describe('explicit PWA refresh', () => {
    it('waits for the selected worker and reloads exactly once after rechecking safety', async () => {
        const { manager, worker } = await start()
        const removeWorkerListener = vi.spyOn(worker, 'removeEventListener')
        const removeControllerListener = vi.spyOn(serviceWorker, 'removeEventListener')
        manager.refreshPwaUpdate()
        manager.refreshPwaUpdate()
        expect(manager.getPwaUpdateSnapshot().status).toBe('activating')
        serviceWorker.dispatchEvent(new Event('controllerchange'))
        expect(reload).not.toHaveBeenCalled()
        worker.transition('activating')
        expect(reload).not.toHaveBeenCalled()
        worker.transition('activated')
        serviceWorker.controller = worker
        serviceWorker.dispatchEvent(new Event('controllerchange'))
        manager.refreshPwaUpdate()
        expect(reload).toHaveBeenCalledTimes(1)
        expect(prepare).toHaveBeenCalledTimes(2)
        expect(removeWorkerListener).toHaveBeenCalledWith('statechange', expect.any(Function))
        expect(removeControllerListener).toHaveBeenCalledWith('controllerchange', expect.any(Function))
        expect(vi.getTimerCount()).toBe(0)
    })

    it('blocks activation while a registered workflow is unsafe', async () => {
        const { manager, worker } = await start()
        prepare.mockReturnValue(false)
        manager.refreshPwaUpdate()
        expect(manager.getPwaUpdateSnapshot().status).toBe('blocked')
        expect(worker.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
        expect(reload).not.toHaveBeenCalled()
        prepare.mockReturnValue(true)
        manager.refreshPwaUpdate()
        worker.transition('activated')
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('blocks reload if work becomes unsafe during activation, then supports explicit retry', async () => {
        const { manager, worker } = await start()
        manager.refreshPwaUpdate()
        prepare.mockReturnValue(false)
        worker.transition('activated')
        expect(manager.getPwaUpdateSnapshot().status).toBe('blocked')
        expect(reload).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        prepare.mockReturnValue(true)
        manager.refreshPwaUpdate()
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('keeps waiting for an activation slowed by a busy connection', async () => {
        const { manager, worker } = await start()
        manager.refreshPwaUpdate()
        await vi.advanceTimersByTimeAsync(20_000)
        expect(manager.getPwaUpdateSnapshot().status).toBe('activating')
        worker.transition('activated')
        expect(reload).toHaveBeenCalledTimes(1)
        expect(captureMessage).not.toHaveBeenCalled()
    })

    it('applies the newest waiting worker when the offered one was replaced', async () => {
        const { manager, worker } = await start()
        const newer = new FakeWorker('build-b')
        // The replacement finished installing before this page saw its statechange.
        worker.state = 'redundant'
        registration.waiting = newer
        manager.refreshPwaUpdate()
        expect(newer.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
        expect(worker.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
        newer.transition('activated')
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('retries with the replacement after an offered worker went redundant', async () => {
        const { manager, worker } = await start()
        manager.refreshPwaUpdate()
        worker.transition('redundant')
        expect(manager.getPwaUpdateSnapshot().status).toBe('failed')
        const newer = new FakeWorker('build-b')
        registration.waiting = newer
        manager.refreshPwaUpdate()
        newer.transition('activated')
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('reloads when another window already activated the update', async () => {
        const { manager, worker } = await start()
        worker.state = 'redundant'
        registration.waiting = null
        const activated = new FakeWorker('build-b')
        activated.state = 'activated'
        registration.active = activated
        manager.refreshPwaUpdate()
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('reports why an update could not be applied', async () => {
        const { manager } = await start()
        manager.refreshPwaUpdate()
        await vi.advanceTimersByTimeAsync(30_000)
        expect(manager.getPwaUpdateSnapshot().status).toBe('failed')
        expect(captureMessage).toHaveBeenCalledTimes(1)
        expect(captureMessage).toHaveBeenCalledWith('pwa_update_failed', expect.objectContaining({
            level: 'warning',
            tags: { pwa_update_failure: 'timeout' },
            extra: expect.objectContaining({ workerState: 'installed', elapsedMs: 30_000 }),
        }))
    })

    it('times out without forced reload and keeps explicit retry available', async () => {
        const { manager, worker } = await start()
        manager.refreshPwaUpdate()
        await vi.advanceTimersByTimeAsync(29_000)
        expect(reload).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1000)
        expect(manager.getPwaUpdateSnapshot().status).toBe('failed')
        expect(reload).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        worker.transition('activated')
        expect(reload).not.toHaveBeenCalled()
        manager.refreshPwaUpdate()
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it.each(['redundant', 'postMessage failure'] as const)('does not reload after %s', async (failure) => {
        const { manager, worker } = await start()
        worker.throwOnActivation = failure === 'postMessage failure'
        manager.refreshPwaUpdate()
        if (failure === 'redundant') worker.transition('redundant')
        expect(manager.getPwaUpdateSnapshot().status).toBe('failed')
        manager.refreshPwaUpdate()
        expect(manager.getPwaUpdateSnapshot().status).toBe('failed')
        await vi.advanceTimersByTimeAsync(10_000)
        expect(reload).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('cancels a pending refresh and listeners on dispose', async () => {
        const { manager, worker } = await start()
        const removeDocumentListener = vi.spyOn(documentEvents, 'removeEventListener')
        const removeRegistrationListener = vi.spyOn(registration, 'removeEventListener')
        manager.refreshPwaUpdate()
        cleanup()
        worker.transition('activated')
        serviceWorker.controller = worker
        serviceWorker.dispatchEvent(new Event('controllerchange'))
        expect(reload).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        expect(removeDocumentListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
        expect(removeRegistrationListener).toHaveBeenCalledWith('updatefound', expect.any(Function))
    })

    it('does not reload if login opens during activation', async () => {
        const { manager, worker } = await start()
        manager.refreshPwaUpdate()
        location.pathname = '/login'
        worker.transition('activated')
        expect(reload).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
    })
})
