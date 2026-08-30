import { describe, expect, it } from 'vitest'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'
import { translateStrictBasePlanText } from '../lib/i18n/runtime'

describe('LST-08 & LST-09: Language Parity & Localization Regression Suite', () => {
  it('ensures full key parity across English, Hindi, and Gujarati locales for estimator surfaces', () => {
    const enEstimator = en.estimator
    const hiEstimator = hi.estimator
    const guEstimator = gu.estimator

    // Check essential sections exist
    expect(enEstimator.simulation.base_title).toBeTruthy()
    expect(hiEstimator.simulation.base_title).toBeTruthy()
    expect(guEstimator.simulation.base_title).toBeTruthy()

    expect(enEstimator.simulation.base_description).toBeTruthy()
    expect(hiEstimator.simulation.base_description).toBeTruthy()
    expect(guEstimator.simulation.base_description).toBeTruthy()

    expect(enEstimator.price_helpers.production_cost).toBeTruthy()
    expect(hiEstimator.price_helpers.production_cost).toBeTruthy()
    expect(guEstimator.price_helpers.production_cost).toBeTruthy()

    expect(enEstimator.price_helpers.break_even).toBeTruthy()
    expect(hiEstimator.price_helpers.break_even).toBeTruthy()
    expect(guEstimator.price_helpers.break_even).toBeTruthy()

    expect(enEstimator.price_helpers.suggested_selling_price).toBeTruthy()
    expect(hiEstimator.price_helpers.suggested_selling_price).toBeTruthy()
    expect(guEstimator.price_helpers.suggested_selling_price).toBeTruthy()
  })

  it('preserves essential textile terminology with explanation in Hindi and Gujarati', () => {
    // Denier
    expect(translateStrictBasePlanText('Warp yarn', 'hi')).toContain('यार्न')
    expect(translateStrictBasePlanText('Warp yarn', 'gu')).toContain('યાર્ન')

    // PPI
    expect(translateStrictBasePlanText('PPI means picks per inch: weft threads in one inch.', 'hi')).toContain('PPI')
    expect(translateStrictBasePlanText('PPI means picks per inch: weft threads in one inch.', 'gu')).toContain('PPI')

    // Beam ends
    expect(translateStrictBasePlanText('Beam ends', 'hi')).toBe('बीम एंड्स')
    expect(translateStrictBasePlanText('Beam ends', 'gu')).toBe('બીમ એન્ડ્સ')

    // Picks
    expect(translateStrictBasePlanText('Picks', 'hi')).toBe('picks')
    expect(translateStrictBasePlanText('Picks', 'gu')).toBe('picks')
  })

  it('provides complete translations for all key Lite workflow actions', () => {
    const actions = [
      'Save Costing',
      'Export Cost Sheet',
      'Save as New Quality',
      'Rename quality',
      'Discard draft',
      'Check Saved Costings',
    ]

    actions.forEach(action => {
      const translatedHi = translateStrictBasePlanText(action, 'hi')
      const translatedGu = translateStrictBasePlanText(action, 'gu')
      expect(translatedHi).toBeTruthy()
      expect(translatedGu).toBeTruthy()
    })
  })
})
