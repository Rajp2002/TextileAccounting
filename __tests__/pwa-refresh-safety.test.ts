import { describe, expect, it, vi } from 'vitest'
import { prepareForPwaRefresh, registerPwaRefreshGuard } from '@/lib/pwa-refresh-safety'

describe('explicit PWA refresh safety', () => {
  it('flushes mounted editors and blocks when any editor cannot recover its work', () => {
    const saveDraft = vi.fn(() => true)
    let savingPayment = true
    const removeDraft = registerPwaRefreshGuard(saveDraft)
    const removePayment = registerPwaRefreshGuard(() => !savingPayment)
    try {
      expect(prepareForPwaRefresh()).toBe(false)
      expect(saveDraft).toHaveBeenCalledOnce()
      savingPayment = false
      expect(prepareForPwaRefresh()).toBe(true)
    } finally { removeDraft(); removePayment() }
  })

  it('treats unexpected draft persistence failures as unsafe and removes unmounted guards', () => {
    const remove = registerPwaRefreshGuard(() => { throw new Error('Storage unavailable') })
    expect(prepareForPwaRefresh()).toBe(false)
    remove()
    remove()
    expect(prepareForPwaRefresh()).toBe(true)
  })
})
