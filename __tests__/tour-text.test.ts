import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatTourText } from '../lib/tours/tour-text'
afterEach(() => vi.unstubAllEnvs())
describe('tour copy tokens', () => {
    it('fills control labels and values without recursively interpreting inserted text', () => {
        expect(formatTourText('Use {c:save}; {n}/{total}; {c:save}', { save: 'સાચવો {raw}' }, { n: 0, total: 6 })).toBe('Use સાચવો {raw}; 0/6; સાચવો {raw}')
    })
    it.each(['{c:missing}', '{missing}', '{toString}'])('throws for unknown development token %s', token => {
        vi.stubEnv('NODE_ENV', 'development')
        expect(() => formatTourText(token, {})).toThrow('Unknown tour text token')
    })
    it('keeps unknown production tokens visible for diagnosis', () => {
        vi.stubEnv('NODE_ENV', 'production')
        expect(formatTourText('{c:missing} {value}', {})).toBe('{c:missing} {value}')
    })
})
