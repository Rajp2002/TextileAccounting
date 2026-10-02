import { describe, expect, it, vi } from 'vitest'
import { canSharePreparedFile, sharePreparedDocument } from '../lib/prepared-document-share'

const file = new File(['prepared PDF bytes'], 'customer-quotation.pdf', { type: 'application/pdf' })
const data = { files: [file], title: 'Quotation Q-1', text: 'Customer-facing quotation details' }
const device = (overrides: Partial<Pick<Navigator, 'share' | 'canShare'>> = {}) => ({
  canShare: vi.fn(() => true),
  share: vi.fn().mockResolvedValue(undefined),
  ...overrides,
}) as Pick<Navigator, 'share' | 'canShare'>

describe('prepared PDF sharing', () => {
  it('calls the native handoff during the tap, before yielding, using the exact prepared file', async () => {
    const browser = device()
    const result = sharePreparedDocument(data, browser)
    expect(browser.share).toHaveBeenCalledTimes(1)
    expect(browser.share).toHaveBeenCalledWith(data)
    expect(vi.mocked(browser.share).mock.calls[0][0]?.files?.[0]).toBe(file)
    expect(await result).toBe('shared')
  })

  it.each([
    { share: undefined },
    { canShare: undefined },
    { canShare: () => false },
    { canShare: () => { throw new Error('Capability blocked') } },
  ])('does not promise or initiate sharing when file support is absent: %s', async overrides => {
    const browser = device(overrides as Partial<Pick<Navigator, 'share' | 'canShare'>>)
    expect(canSharePreparedFile(file, browser)).toBe(false)
    expect(await sharePreparedDocument(data, browser)).toBe('unsupported')
    if (typeof browser.share === 'function') expect(browser.share).not.toHaveBeenCalled()
  })

  it('treats cancellation neutrally, including cross-realm AbortError objects', async () => {
    expect(await sharePreparedDocument(data, device({ share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) }))).toBe('cancelled')
    expect(await sharePreparedDocument(data, device({ share: vi.fn().mockRejectedValue({ name: 'AbortError' }) }))).toBe('cancelled')
  })

  it('surfaces share failures without implying the PDF was downloaded or delivered', async () => {
    const failure = new DOMException('Device sharing rejected', 'NotAllowedError')
    await expect(sharePreparedDocument(data, device({ share: vi.fn().mockRejectedValue(failure) }))).rejects.toBe(failure)
    await expect(sharePreparedDocument(data, device({ share: vi.fn(() => { throw failure }) }))).rejects.toBe(failure)
  })

  it('does not call the native picker without a prepared file', async () => {
    const browser = device()
    expect(await sharePreparedDocument({ ...data, files: [] }, browser)).toBe('unsupported')
    expect(browser.share).not.toHaveBeenCalled()
  })
})
