import { describe, expect, it } from 'vitest'
import { tourCommonCopy } from '../lib/i18n/tour-common'
describe('shared tour copy', () => { it('has key parity and native Gujarati/Hindi scripts', () => { expect(Object.keys(tourCommonCopy.gu)).toEqual(Object.keys(tourCommonCopy.en)); expect(Object.keys(tourCommonCopy.hi)).toEqual(Object.keys(tourCommonCopy.en)); expect(Object.values(tourCommonCopy.gu).join(' ')).toMatch(/[\u0A80-\u0AFF]/); expect(Object.values(tourCommonCopy.hi).join(' ')).toMatch(/[\u0900-\u097F]/) }) })
