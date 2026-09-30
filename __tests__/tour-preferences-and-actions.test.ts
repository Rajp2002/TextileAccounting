import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), updateUser: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { updateUser: mocks.updateUser } }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

import { getLocalTourPreferences, saveLocalTourPreference, getTourPresentation, persistTourImpression, persistTourDismissal, persistTourStarted, persistTourCompleted } from '../lib/tours/tour-preferences'
import { recordTourEventAction } from '../app/actions/tour-preferences'
import { supportedTours, getTourDefinition } from '../lib/tours/tour-registry'

let storage: Record<string, string>
beforeEach(() => {
    vi.resetAllMocks()
    storage = {}
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage[key] ?? null, setItem: (key: string, value: string) => { storage[key] = value } })
    vi.stubGlobal('window', { localStorage: globalThis.localStorage })
    mocks.requireRole.mockResolvedValue({ user: { id: 'owner-1', user_metadata: { tour_preferences: {} } } })
    mocks.updateUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null })
})
afterEach(() => { expect(mocks.revalidatePath).not.toHaveBeenCalled(); vi.unstubAllGlobals() })

describe('Local preferences', () => {
    it('isolates users and keeps sticky decisions and the original impression', () => {
        expect(getLocalTourPreferences('owner-1')).toEqual({})
        saveLocalTourPreference('owner-1', 'cost-estimate', { firstShown: 'original', firstStarted: true, dismissed: true, completed: true, completedVersion: 'v2' })
        saveLocalTourPreference('owner-1', 'cost-estimate', { firstShown: 'later', firstStarted: false, dismissed: false, completed: false })
        expect(getLocalTourPreferences('owner-1')['cost-estimate']).toEqual({ firstShown: 'original', firstStarted: true, dismissed: true, completed: true, completedVersion: 'v2', version: 'v1' })
        expect(getLocalTourPreferences('other-owner')).toEqual({})
    })
    it.each(['broken', 'null', '[]'])('tolerates invalid stored preferences: %s', value => {
        storage['weavly:tour-prefs:v1:owner-1'] = value
        expect(getLocalTourPreferences('owner-1')).toEqual({})
    })
    it('tolerates inaccessible storage and still honors account decisions', () => {
        vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
        expect(() => saveLocalTourPreference('owner-1', 'dispatch', { dismissed: true })).not.toThrow()
        expect(getTourPresentation('dispatch', { tour_preferences: { dispatch: { completed: true } } }, 'owner-1')).toBe('replay')
    })
})

describe('getTourPresentation', () => {
    it('keeps a fresh or merely shown invitation across visits', () => {
        expect(getTourPresentation('cost-estimate', null, 'owner-1')).toBe('invite')
        const metadata = { tour_preferences: { 'cost-estimate': { firstShown: '2026-09-27', version: 'v1' } } }
        saveLocalTourPreference('owner-1', 'cost-estimate', { firstShown: true })
        expect(getTourPresentation('cost-estimate', metadata, 'owner-1')).toBe('invite')
    })
    it.each(['dismissed', 'firstStarted', 'completed'] as const)('replays for account or local %s independently', flag => {
        expect(getTourPresentation('saved-costings', { tour_preferences: { 'saved-costings': { [flag]: true } } }, 'owner-1')).toBe('replay')
        saveLocalTourPreference('owner-1', 'saved-costings', { [flag]: true })
        expect(getTourPresentation('saved-costings', { tour_preferences: { 'saved-costings': { [flag]: false } } }, 'owner-1')).toBe('replay')
    })
    it('does not re-invite for a different completion or policy version', () => {
        expect(getTourPresentation('saved-costings', { tour_preferences: { 'saved-costings': { completed: true, completedVersion: 'v0', version: 'v99' } } })).toBe('replay')
    })
    it.each([
        ['cost-estimate', 'cost_estimate_tutorial_dismissed', 'weavly:cost-estimate-tutorial:v1:org:owner-1'],
        ['rate-book', 'ratebook_tutorial_dismissed', 'weavly:ratebook-tutorial:v1:org:owner-1'],
    ] as const)('preserves both legacy reads for %s without writing them', (tourId, flag, key) => {
        expect(getTourPresentation(tourId, { [flag]: true }, 'owner-1', 'org')).toBe('replay')
        storage[key] = 'done'
        expect(getTourPresentation(tourId, null, 'owner-1', 'org')).toBe('replay')
        expect(getTourPresentation(tourId, null, 'another-owner', 'org')).toBe('invite')
        expect(storage[key]).toBe('done')
    })
})

describe('recordTourEventAction', () => {
    it('records firstShown once, preserves existing preferences and authenticates the owner', async () => {
        mocks.requireRole.mockResolvedValue({ user: { user_metadata: { tour_preferences: { dispatch: { firstShown: 'original', dismissed: true }, workers: { completed: true } } } } })
        expect(await recordTourEventAction({ tourId: 'dispatch', action: 'shown' })).toMatchObject({ success: true })
        expect(mocks.requireRole).toHaveBeenCalledWith(['owner'], { allowFreeAccount: true })
        expect(mocks.updateUser).toHaveBeenCalledWith({ data: { tour_preferences: { dispatch: { firstShown: 'original', dismissed: true, version: 'v1' }, workers: { completed: true } } } })
    })
    it.each(supportedTours)('records completion/version for %s without a refresh', async tourId => {
        const res = await recordTourEventAction({ tourId, action: 'completed', contentVersion: 'v2' })
        expect(res.success).toBe(true)
        expect(mocks.updateUser).toHaveBeenCalledWith({ data: { tour_preferences: { [tourId]: { completed: true, completedVersion: 'v2', version: 'v1', firstShown: expect.any(String) } } } })
    })
    it.each(['cost-estimate', 'rate-book'] as const)('records %s dismissal only in modern preferences', async tourId => {
        expect((await recordTourEventAction({ tourId, action: 'dismissed' })).success).toBe(true)
        expect(mocks.updateUser).toHaveBeenCalledWith({ data: { tour_preferences: { [tourId]: { dismissed: true, version: 'v1', firstShown: expect.any(String) } } } })
    })
    it('accepts omitted versions for existing callers and stores a version only on completion', async () => {
        await recordTourEventAction({ tourId: 'dispatch', action: 'completed' })
        expect(mocks.updateUser.mock.calls[0][0].data.tour_preferences.dispatch).not.toHaveProperty('completedVersion')
        await recordTourEventAction({ tourId: 'dispatch', action: 'started', contentVersion: 'v2' })
        expect(mocks.updateUser.mock.calls[1][0].data.tour_preferences.dispatch).toMatchObject({ firstStarted: true })
        expect(mocks.updateUser.mock.calls[1][0].data.tour_preferences.dispatch).not.toHaveProperty('completedVersion')
    })
    it.each(['', '2', 'v-1', 'V2', 'v2x', 'v1234567890123456', null, 2])('rejects invalid contentVersion %s without writing', async contentVersion => {
        const res = await recordTourEventAction({ tourId: 'dispatch', action: 'completed', contentVersion: contentVersion as string })
        expect(res.success).toBe(false)
        expect(mocks.updateUser).not.toHaveBeenCalled()
    })
    it('accepts the 16-character boundary', async () => {
        expect((await recordTourEventAction({ tourId: 'dispatch', action: 'completed', contentVersion: 'v123456789012345' })).success).toBe(true)
    })
    it('does not write on an auth failure and reports unsuccessful account writes', async () => {
        mocks.requireRole.mockRejectedValueOnce(Error('Access denied'))
        expect((await recordTourEventAction({ tourId: 'dispatch', action: 'started' })).success).toBe(false)
        expect(mocks.updateUser).not.toHaveBeenCalled()
        mocks.updateUser.mockResolvedValueOnce({ data: { user: null }, error: null })
        expect((await recordTourEventAction({ tourId: 'dispatch', action: 'started' })).success).toBe(false)
        mocks.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'offline' } })
        expect((await recordTourEventAction({ tourId: 'dispatch', action: 'started' })).success).toBe(false)
    })
    it('contains no route invalidation at all', () => {
        expect(readFileSync('app/actions/tour-preferences.ts', 'utf8')).not.toContain('revalidatePath')
    })
})

describe('Persistence helpers', () => {
    it('records the impression once without changing invitation state', async () => {
        await persistTourImpression('dispatch', 'owner-1')
        await persistTourImpression('dispatch', 'owner-1')
        expect(getLocalTourPreferences('owner-1').dispatch?.firstShown).toEqual(expect.any(String))
        expect(mocks.updateUser).toHaveBeenCalledTimes(1)
        expect(getTourPresentation('dispatch', null, 'owner-1')).toBe('invite')
    })
    it('writes decisions locally before a failed account request', async () => {
        mocks.requireRole.mockImplementation(async () => {
            expect(getLocalTourPreferences('owner-1').dispatch?.dismissed).toBe(true)
            throw Error('offline')
        })
        await persistTourDismissal('dispatch', 'owner-1')
        expect(getTourPresentation('dispatch', null, 'owner-1')).toBe('replay')
    })
    it('persists start and a completed version locally and remotely', async () => {
        await persistTourStarted('saved-costings', 'owner-1')
        expect(getLocalTourPreferences('owner-1')['saved-costings']?.firstStarted).toBe(true)
        await persistTourCompleted('saved-costings', 'owner-1', 'v2')
        expect(getLocalTourPreferences('owner-1')['saved-costings']).toMatchObject({ firstStarted: true, completed: true, completedVersion: 'v2' })
        expect(mocks.updateUser.mock.lastCall?.[0].data.tour_preferences['saved-costings']).toMatchObject({ completed: true, completedVersion: 'v2' })
    })
    it('defaults an untouched caller to the registry content version', async () => {
        await persistTourCompleted('dispatch', 'owner-1')
        expect(getLocalTourPreferences('owner-1').dispatch?.completedVersion).toBe(getTourDefinition('dispatch').contentVersion)
    })
})
