import { describe, expect, it } from 'vitest'
import { formatTourText } from '../lib/tours/tour-text'
describe('formatTourText', () => {
  it('fills control and value tokens', () => expect(formatTourText('Press {c:save} for {count}.', { save: 'Save' }, { count: 2 })).toBe('Press Save for 2.'))
  it('rejects unknown tokens outside production', () => expect(() => formatTourText('{missing}', {})).toThrow('Unknown tour token'))
})
