import { afterAll, describe, expect, it } from 'vitest'
import { dateOnlyToLocalDate, formatDate, formatDateOnly } from '../lib/format'

const originalTimezone = process.env.TZ

afterAll(() => {
  process.env.TZ = originalTimezone
})

describe('date-only formatting', () => {
  it.each(['UTC', 'Asia/Kolkata', 'America/Los_Angeles'])(
    'keeps YYYY-MM-DD on the same calendar day in %s',
    (timezone) => {
      process.env.TZ = timezone

      expect(formatDateOnly('2026-03-01', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })).toBe('01 Mar 2026')
      expect(formatDate('2026-03-01')).toBe('1 Mar')

      const localDate = dateOnlyToLocalDate('2026-03-01')
      expect(localDate?.getFullYear()).toBe(2026)
      expect(localDate?.getMonth()).toBe(2)
      expect(localDate?.getDate()).toBe(1)
    }
  )

  it.each(['UTC', 'Asia/Kolkata', 'America/Los_Angeles'])(
    'uses the date-only part of ISO values without shifting the displayed day in %s',
    (timezone) => {
      process.env.TZ = timezone

      expect(formatDateOnly('2026-03-01T00:00:00.000Z', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })).toBe('01 Mar 2026')
    }
  )
})
