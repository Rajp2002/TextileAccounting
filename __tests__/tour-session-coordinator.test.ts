import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  hasClaimedSessionAnimation,
  claimSessionAnimation,
  isReducedMotionPreferred,
  __resetSessionAnimationForTesting,
} from '../lib/tours/session-coordinator'

describe('Tour Session Coordinator', () => {
  let mockSessionStorage: Record<string, string> = {}

  beforeEach(() => {
    mockSessionStorage = {}
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key]
      },
      clear: () => {
        mockSessionStorage = {}
      },
    })

    vi.stubGlobal('window', {
      sessionStorage: globalThis.sessionStorage,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows halo animation for fresh tab session when motion is enabled', () => {
    const userId = 'user-123'
    expect(hasClaimedSessionAnimation(userId)).toBe(false)
    expect(claimSessionAnimation(userId)).toBe(true)
  })

  it('consumes grant and blocks subsequent animation grants in same tab session', () => {
    const userId = 'user-123'
    expect(claimSessionAnimation(userId)).toBe(true)
    expect(hasClaimedSessionAnimation(userId)).toBe(true)
    expect(claimSessionAnimation(userId)).toBe(false)
  })

  it('suppresses animation unconditionally when prefers-reduced-motion is reduce', () => {
    vi.stubGlobal('window', {
      sessionStorage: globalThis.sessionStorage,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    expect(isReducedMotionPreferred()).toBe(true)
    const userId = 'user-789'
    expect(claimSessionAnimation(userId)).toBe(false)
  })

  it('different users have independent session animation tracking', () => {
    const userA = 'user-a'
    const userB = 'user-b'

    expect(claimSessionAnimation(userA)).toBe(true)
    expect(hasClaimedSessionAnimation(userA)).toBe(true)

    // User B should still be eligible
    expect(hasClaimedSessionAnimation(userB)).toBe(false)
    expect(claimSessionAnimation(userB)).toBe(true)
    expect(hasClaimedSessionAnimation(userB)).toBe(true)
  })

  it('__resetSessionAnimationForTesting clears the session mark for that user', () => {
    const userId = 'user-reset'
    claimSessionAnimation(userId)
    expect(hasClaimedSessionAnimation(userId)).toBe(true)

    __resetSessionAnimationForTesting(userId)
    expect(hasClaimedSessionAnimation(userId)).toBe(false)
  })

  it('gracefully handles missing or throwing sessionStorage by suppressing motion safely', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('SecurityError')
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    })

    // In a restricted environment, it should suppress motion rather than looping or crashing
    expect(hasClaimedSessionAnimation('user-error')).toBe(true)
    expect(claimSessionAnimation('user-error')).toBe(false)
  })
})
