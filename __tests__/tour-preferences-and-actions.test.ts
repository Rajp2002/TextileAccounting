import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { updateUser: mocks.updateUser } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

import {
  getLocalTourPreferences,
  saveLocalTourPreference,
  getTourStatus,
  persistTourImpression,
  persistTourDismissal,
  persistTourStarted,
  persistTourCompleted,
} from '../lib/tours/tour-preferences'
import { recordTourEventAction } from '../app/actions/tour-preferences'
import type { TourId } from '../lib/tours/tour-types'

describe('Tour Preferences Adapter & Server Action', () => {
  let mockLocalStorage: Record<string, string> = {}

  beforeEach(() => {
    vi.resetAllMocks()
    mockLocalStorage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key]
      },
      clear: () => {
        mockLocalStorage = {}
      },
    })
    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
    })

    mocks.requireRole.mockResolvedValue({
      user: {
        id: 'owner-1',
        user_metadata: { tour_preferences: {} },
      },
    })
    mocks.updateUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Local Preferences Storage', () => {
    it('reads empty preferences when nothing is stored', () => {
      expect(getLocalTourPreferences('user-1')).toEqual({})
    })

    it('saves and reads back local preferences namespaced by user ID', () => {
      const userId = 'user-abc'
      saveLocalTourPreference(userId, 'cost-estimate', {
        dismissed: true,
        firstShown: '2026-09-10T12:00:00Z',
      })

      const prefs = getLocalTourPreferences(userId)
      expect(prefs['cost-estimate']?.dismissed).toBe(true)
      expect(prefs['cost-estimate']?.firstShown).toBe('2026-09-10T12:00:00Z')
      expect(prefs['cost-estimate']?.version).toBe('v1')

      // Another user does not have this preference
      expect(getLocalTourPreferences('other-user')).toEqual({})
    })

    it('never overwrites a stronger state (completed/dismissed) with a weaker state', () => {
      const userId = 'user-sticky'
      saveLocalTourPreference(userId, 'cost-estimate', { completed: true })
      saveLocalTourPreference(userId, 'cost-estimate', { dismissed: false })

      const prefs = getLocalTourPreferences(userId)
      expect(prefs['cost-estimate']?.completed).toBe(true)
    })
  })

  describe('getTourStatus', () => {
    it('returns isFirstEligibleVisit = true when tour has never been shown or dismissed', () => {
      const status = getTourStatus('cost-estimate', {}, 'user-fresh')
      expect(status.isFirstEligibleVisit).toBe(true)
      expect(status.isDismissed).toBe(false)
      expect(status.isCompleted).toBe(false)
      expect(status.isSuppressed).toBe(false)
    })

    it('returns isFirstEligibleVisit = false and isSuppressed = true if impression was recorded', () => {
      const status = getTourStatus(
        'cost-estimate',
        {
          tour_preferences: {
            'cost-estimate': { firstShown: '2026-09-10T00:00:00Z', version: 'v1' },
          },
        },
        'user-revisit'
      )
      expect(status.isFirstEligibleVisit).toBe(false)
      expect(status.isSuppressed).toBe(true)
    })

    it('honors modern tour_preferences dismissed flag', () => {
      const status = getTourStatus(
        'rate-book',
        {
          tour_preferences: {
            'rate-book': { dismissed: true, version: 'v1' },
          },
        },
        'user-dismissed'
      )
      expect(status.isDismissed).toBe(true)
      expect(status.isSuppressed).toBe(true)
      expect(status.isFirstEligibleVisit).toBe(false)
    })

    it('honors legacy cost_estimate_tutorial_dismissed flag', () => {
      const status = getTourStatus(
        'cost-estimate',
        { cost_estimate_tutorial_dismissed: true },
        'user-legacy'
      )
      expect(status.isDismissed).toBe(true)
      expect(status.isSuppressed).toBe(true)
      expect(status.isFirstEligibleVisit).toBe(false)
    })

    it('honors legacy ratebook_tutorial_dismissed flag', () => {
      const status = getTourStatus(
        'rate-book',
        { ratebook_tutorial_dismissed: true },
        'user-legacy'
      )
      expect(status.isDismissed).toBe(true)
      expect(status.isSuppressed).toBe(true)
      expect(status.isFirstEligibleVisit).toBe(false)
    })

    it('honors legacy localStorage done marker for cost estimate', () => {
      mockLocalStorage['weavly:cost-estimate-tutorial:v1:org-1:user-1'] = 'done'
      const status = getTourStatus('cost-estimate', null, 'user-1', 'org-1')
      expect(status.isDismissed).toBe(true)
      expect(status.isSuppressed).toBe(true)
    })

    it('honors legacy localStorage done marker for rate book', () => {
      mockLocalStorage['weavly:ratebook-tutorial:v1:org-2:user-2'] = 'done'
      const status = getTourStatus('rate-book', null, 'user-2', 'org-2')
      expect(status.isDismissed).toBe(true)
      expect(status.isSuppressed).toBe(true)
    })
  })

  describe('Server Action: recordTourEventAction', () => {
    it('records impression (shown) and saves v1 record with firstShown timestamp', async () => {
      const res = await recordTourEventAction({ tourId: 'cost-estimate', action: 'shown' })
      expect(res.success).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tour_preferences: expect.objectContaining({
            'cost-estimate': expect.objectContaining({
              version: 'v1',
              firstShown: expect.any(String),
            }),
          }),
        }),
      })
    })

    it('records dismissal and synchronizes legacy cost_estimate_tutorial_dismissed key', async () => {
      const res = await recordTourEventAction({ tourId: 'cost-estimate', action: 'dismissed' })
      expect(res.success).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cost_estimate_tutorial_dismissed: true,
          tour_preferences: expect.objectContaining({
            'cost-estimate': expect.objectContaining({
              dismissed: true,
              version: 'v1',
            }),
          }),
        }),
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/owner/estimator')
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/free')
    })

    it('records dismissal for rate-book and synchronizes legacy ratebook_tutorial_dismissed key', async () => {
      const res = await recordTourEventAction({ tourId: 'rate-book', action: 'dismissed' })
      expect(res.success).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ratebook_tutorial_dismissed: true,
          tour_preferences: expect.objectContaining({
            'rate-book': expect.objectContaining({
              dismissed: true,
              version: 'v1',
            }),
          }),
        }),
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/owner/rates')
    })

    it('records completed for saved-costings and revalidates quote routes', async () => {
      const res = await recordTourEventAction({ tourId: 'saved-costings', action: 'completed' })
      expect(res.success).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tour_preferences: expect.objectContaining({
            'saved-costings': expect.objectContaining({
              completed: true,
              version: 'v1',
            }),
          }),
        }),
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/owner/quotes')
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/free/costings')
    })
  })

  describe('Client Persistence Helpers', () => {
    it('persistTourImpression updates local storage and dispatches server action', async () => {
      await persistTourImpression('cost-estimate', 'user-1')
      const prefs = getLocalTourPreferences('user-1')
      expect(prefs['cost-estimate']?.firstShown).toBeDefined()
      expect(mocks.updateUser).toHaveBeenCalled()
    })

    it('persistTourDismissal updates local storage and dispatches server action', async () => {
      await persistTourDismissal('rate-book', 'user-2')
      const prefs = getLocalTourPreferences('user-2')
      expect(prefs['rate-book']?.dismissed).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalled()
    })

    it('persistTourStarted updates local storage and dispatches server action', async () => {
      await persistTourStarted('saved-costings', 'user-3')
      const prefs = getLocalTourPreferences('user-3')
      expect(prefs['saved-costings']?.firstStarted).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalled()
    })

    it('persistTourCompleted updates local storage and dispatches server action', async () => {
      await persistTourCompleted('saved-costings', 'user-4')
      const prefs = getLocalTourPreferences('user-4')
      expect(prefs['saved-costings']?.completed).toBe(true)
      expect(mocks.updateUser).toHaveBeenCalled()
    })
  })
})
