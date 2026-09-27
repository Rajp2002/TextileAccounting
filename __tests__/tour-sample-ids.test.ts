import { describe, expect, it } from 'vitest'
import { isSampleRecordId } from '../lib/tours/sample-ids'
describe('sample ids', () => { it('recognizes only supported sample formats', () => { expect(isSampleRecordId('tour-yarn')).toBe(true); expect(isSampleRecordId('demo-sample-yarn-rate')).toBe(true); expect(isSampleRecordId('real-id')).toBe(false); expect(isSampleRecordId(null)).toBe(false) }) })
