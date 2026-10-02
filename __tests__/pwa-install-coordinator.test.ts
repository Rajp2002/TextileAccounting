import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPwaInstallCoordinator, isPwaInstallWorkspace, requestPwaInstallation, type PwaInstallPrompt } from '../lib/pwa-install-nudge'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function fixture() {
    let allowed = true
    let preference = { dismissed: false, lastShownAt: 0 }
    const visible = vi.fn()
    const write = vi.fn((next: typeof preference) => { preference = next })
    const controller = createPwaInstallCoordinator({
        canShow: () => allowed, readPreference: () => preference, writePreference: write,
        onVisibility: visible, now: () => 1_800_000_000_000,
    })
    return { controller, visible, write, block: (value: boolean) => { allowed = !value; controller.recheck() } }
}

describe('success-triggered install reminders', () => {
    it('does not show simply because time passed', () => {
        const f = fixture(); f.controller.recheck(); vi.advanceTimersByTime(60_000)
        expect(f.visible).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled()
    })
    it('waits for editing, keyboard, or dialog blockers to clear and records only visibility', () => {
        const f = fixture(); f.block(true); f.controller.workflowSucceeded(); vi.advanceTimersByTime(60_000)
        expect(f.visible).not.toHaveBeenCalled()
        f.block(false); vi.advanceTimersByTime(1500)
        expect(f.visible).toHaveBeenLastCalledWith(true); expect(f.write).not.toHaveBeenCalled()
        expect(f.controller.confirmVisible()).toBe(true); expect(f.write).toHaveBeenCalledTimes(1)
        f.controller.confirmVisible(); expect(f.write).toHaveBeenCalledTimes(1)
        f.controller.interrupt(); f.controller.workflowSucceeded(); vi.advanceTimersByTime(60_000)
        expect(f.visible).toHaveBeenLastCalledWith(false)
    })
    it('discards a pending reminder when editing resumes', () => {
        const f = fixture(); f.controller.workflowSucceeded(); f.controller.interrupt(); vi.advanceTimersByTime(60_000)
        expect(f.visible).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled()
    })
    it('does not count a card hidden before its impression', () => {
        const f = fixture(); f.controller.workflowSucceeded(); vi.advanceTimersByTime(1500); f.block(true)
        expect(f.controller.confirmVisible()).toBe(false); expect(f.write).not.toHaveBeenCalled()
        f.block(false); vi.advanceTimersByTime(1500)
        expect(f.controller.confirmVisible()).toBe(true)
    })
    it('persists opt-out and suppresses reminders for this session', () => {
        const f = fixture(); f.controller.dismissForever(); f.controller.workflowSucceeded(); vi.advanceTimersByTime(60_000)
        expect(f.write).toHaveBeenCalledWith({ dismissed: true, lastShownAt: 0 })
        expect(f.visible).not.toHaveBeenCalled()
    })
    it('does not interrupt work when frequency storage is unavailable', () => {
        const visible = vi.fn()
        const controller = createPwaInstallCoordinator({ canShow: () => true, readPreference: () => { throw Error('blocked') }, writePreference: vi.fn(), onVisibility: visible })
        controller.workflowSucceeded(); vi.advanceTimersByTime(60_000)
        expect(visible).not.toHaveBeenCalled()
    })
    it('cancels timers at unmount', () => {
        const f = fixture(); f.controller.workflowSucceeded(); f.controller.dispose(); vi.advanceTimersByTime(60_000)
        expect(f.visible).not.toHaveBeenCalled()
    })
    it.each(['/free', '/free/costings', '/owner/estimator', '/owner/payroll'])('supports entitled workspace %s', route => expect(isPwaInstallWorkspace(route)).toBe(true))
    it.each(['/login', '/install', '/free-fake', '/owner-fake'])('does not interrupt public route %s', route => expect(isPwaInstallWorkspace(route)).toBe(false))
    it.each(['accepted', 'dismissed'] as const)('returns native %s without recording installation', async outcome => {
        const prompt = vi.fn().mockResolvedValue(undefined)
        const result = requestPwaInstallation({ prompt, userChoice: Promise.resolve({ outcome }) } as unknown as PwaInstallPrompt)
        expect(prompt).toHaveBeenCalledTimes(1)
        expect(await result).toBe(outcome)
    })
    it('offers recovery from native prompt failure', async () => {
        expect(await requestPwaInstallation({ prompt: () => Promise.reject(Error('blocked')) } as unknown as PwaInstallPrompt)).toBe('unavailable')
    })
})
