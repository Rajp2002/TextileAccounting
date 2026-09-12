import { describe, expect, it } from 'vitest'
import { resolveStockKind, stockDestinations } from '../lib/stock-navigation'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'

describe('stock destinations', () => {
    it.each([
        ['/owner/stock', 'fabric'], ['/owner/stock/', 'fabric'],
        ['/owner/stock?quality=123', 'fabric'], ['/owner/stock/123', 'fabric'],
        ['/owner/stock/yarn', 'yarn'], ['/owner/stock/yarn/123', 'yarn'],
        ['/owner/rates', null], ['/owner/stockpile', null], ['/owner/dispatches', null],
    ])('resolves %s without activating adjacent modules', (path, expected) => {
        expect(resolveStockKind(path)).toBe(expected)
    })
    it('retains distinct existing page URLs', () => {
        expect(stockDestinations.map(item => item.href)).toEqual(['/owner/stock', '/owner/stock/yarn'])
    })
    it.each([en, hi, gu])('provides category labels and full headings', locale => {
        expect(locale.navigation.stock).toBeTruthy()
        expect(locale.navigation.fabric).toBeTruthy()
        expect(locale.navigation.yarn).toBeTruthy()
        expect(locale.navigation.yarnStock).toBeTruthy()
        expect(locale.qualityStock.title).toBeTruthy()
    })
})
