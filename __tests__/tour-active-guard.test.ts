import { describe, expect, it } from 'vitest'
import { acquireTour, releaseTour } from '../lib/tours/active-tour'
describe('active tour guard', () => { it('refuses a second tour until release', () => { expect(acquireTour('machines')).toBe(true); expect(acquireTour('workers')).toBe(false); releaseTour('machines'); expect(acquireTour('workers')).toBe(true); releaseTour('workers') }) })
