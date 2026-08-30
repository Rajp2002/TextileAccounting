import { describe, expect, it } from 'vitest'
import { isBasePlanSurfacePath } from '../lib/i18n/base-plan-phrases'
import { translateStrictBasePlanText } from '../lib/i18n/runtime'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'

describe('LST-01: Plan-copy regression & terminology leakage', () => {
  it('strictly ensures no Base workspace or Base plan terminology leaks to user-facing strings', () => {
    const forbiddenPhrases = [
      'Base workspace',
      'Base plan',
      'Base users',
      'Estimator Plan',
      'Selling and quantity (optional for Base)',
    ]

    // Check English locales
    const enSimulation = en.estimator.simulation
    expect(enSimulation.base_title).toBe('Selling price and quantity')
    expect(enSimulation.base_description).toBe(
      'Optional for a per-metre cost; complete when you want a customer price or total value.',
    )

    forbiddenPhrases.forEach(forbidden => {
      expect(enSimulation.base_title).not.toContain(forbidden)
      expect(enSimulation.base_description).not.toContain(forbidden)
    })

    // Check Hindi locales
    const hiSimulation = hi.estimator.simulation
    expect(hiSimulation.base_title).toBe('बिक्री मूल्य और मात्रा')
    expect(hiSimulation.base_description).toBe(
      'प्रति-मीटर लागत के लिए वैकल्पिक; जब आपको ग्राहक मूल्य या कुल मूल्य चाहिए तब पूरा करें।',
    )

    // Check Gujarati locales
    const guSimulation = gu.estimator.simulation
    expect(guSimulation.base_title).toBe('વેચાણ કિંમત અને જથ્થો')
    expect(guSimulation.base_description).toBe(
      'દર-મીટર ખર્ચ માટે વૈકલ્પિક; જ્યારે તમને ગ્રાહક કિંમત અથવા કુલ કિંમત જોઈતી હોય ત્યારે પૂર્ણ કરો.',
    )
  })

  it('translates Selling price and quantity and its explanation accurately in Hindi and Gujarati', () => {
    expect(translateStrictBasePlanText('Selling price and quantity', 'hi')).toBe('बिक्री मूल्य और मात्रा')
    expect(translateStrictBasePlanText('Selling price and quantity', 'gu')).toBe('વેચાણ કિંમત અને જથ્થો')

    expect(
      translateStrictBasePlanText(
        'Optional for a per-metre cost; complete when you want a customer price or total value.',
        'hi',
      ),
    ).toBe('प्रति-मीटर लागत के लिए वैकल्पिक; जब आपको ग्राहक मूल्य या कुल मूल्य चाहिए तब पूरा करें।')

    expect(
      translateStrictBasePlanText(
        'Optional for a per-metre cost; complete when you want a customer price or total value.',
        'gu',
      ),
    ).toBe('દર-મીટર ખર્ચ માટે વૈકલ્પિક; જ્યારે તમને ગ્રાહક કિંમત અથવા કુલ કિંમત જોઈતી હોય ત્યારે પૂર્ણ કરો.')
  })

  it('translates Quick and Detailed mode descriptions accurately in Hindi and Gujarati', () => {
    expect(
      translateStrictBasePlanText('Essential construction inputs · same calculation engine', 'hi'),
    ).toBe('आवश्यक बनावट इनपुट · वही गणना इंजन')
    expect(
      translateStrictBasePlanText('Essential construction inputs · same calculation engine', 'gu'),
    ).toBe('જરૂરી બનાવટ ઇનપુટ · એજ ગણતરીનું એન્જિન')

    expect(
      translateStrictBasePlanText(
        'Full technical inputs & factory assumptions · same calculation engine',
        'hi',
      ),
    ).toBe('पूर्ण तकनीकी इनपुट और फ़ैक्टरी धारणाएँ · वही गणना इंजन')
    expect(
      translateStrictBasePlanText(
        'Full technical inputs & factory assumptions · same calculation engine',
        'gu',
      ),
    ).toBe('સંપૂર્ણ તકનીકી ઇનપુટ અને ફેક્ટરી ધારણાઓ · એજ ગણતરીનું એન્જિન')
  })

  it('confirms Lite surface route paths are registered as strict base-plan surfaces', () => {
    expect(isBasePlanSurfacePath('/owner/estimator')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/rates')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/quotes')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/settings')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/billing')).toBe(true)
  })
})
