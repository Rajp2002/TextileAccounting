import { describe, expect, it, vi } from 'vitest'

import { retryOfflineNavigation } from '@/lib/offline-recovery'

function recoveryLocation(href: string) {
  const url = new URL(href, 'https://weavly.example')
  return {
    pathname: url.pathname,
    href: url.href,
    assign: vi.fn(),
    reload: vi.fn(),
  }
}

describe('offline document recovery', () => {
  it.each([
    '/owner/production?tab=payroll&period=2026-10#settlement',
    '/owner/estimator?quality=sample%2Fblend&mode=detailed#weft',
    '/owner/stock?search=%E0%A4%AF%E0%A4%BE%E0%A4%B0%E0%A5%8D%E0%A4%A8',
    '/login?next=%2Fowner%2Fproduction',
    '/free#costing',
    '/',
  ])('reloads the interrupted document without replacing %s', (href) => {
    const location = recoveryLocation(href)
    const originalHref = location.href

    retryOfflineNavigation(location)

    expect(location.reload).toHaveBeenCalledOnce()
    expect(location.assign).not.toHaveBeenCalled()
    expect(location.href).toBe(originalHref)
  })

  it.each(['/offline', '/offline/', '/_offline', '/_offline/?source=pwa#retry'])(
    'takes a direct fallback visit at %s to sign in instead of reloading the fallback',
    (href) => {
      const location = recoveryLocation(href)

      retryOfflineNavigation(location)

      expect(location.assign).toHaveBeenCalledExactlyOnceWith('/login')
      expect(location.reload).not.toHaveBeenCalled()
    },
  )

  it('does not treat a fallback-named workflow segment as a direct fallback', () => {
    const location = recoveryLocation('/owner/offline?tab=settings')

    retryOfflineNavigation(location)

    expect(location.reload).toHaveBeenCalledOnce()
    expect(location.assign).not.toHaveBeenCalled()
  })

  it('does not follow an untrusted returnTo parameter from a direct fallback', () => {
    const location = recoveryLocation('/offline?returnTo=https%3A%2F%2Funtrusted.example')

    retryOfflineNavigation(location)

    expect(location.assign).toHaveBeenCalledExactlyOnceWith('/login')
    expect(location.reload).not.toHaveBeenCalled()
  })
})
