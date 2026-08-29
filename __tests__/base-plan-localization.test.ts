import { describe, expect, it } from 'vitest'
import { BASE_PLAN_PHRASES, isBasePlanSurfacePath } from '../lib/i18n/base-plan-phrases'
import { translateStrictBasePlanText } from '../lib/i18n/runtime'

describe('Base Plan strict localization', () => {
  it('localizes the legacy estimator labels without dropping the factory vocabulary', () => {
    expect(translateStrictBasePlanText('Pricing assumptions', 'hi')).toBe('कीमत धारणाएँ')
    expect(translateStrictBasePlanText('Save quality/recipe: reusable construction and assumptions.', 'hi')).toBe(
      'सेव करें क्वालिटी/रेसिपी: दोबारा उपयोग योग्य बनावट और धारणाएँ.',
    )
    expect(translateStrictBasePlanText('PPI means picks per inch: weft threads in one inch.', 'gu')).toBe(
      'PPI એટલે picks per inch: weft દોરા માં એક ઇંચ.',
    )
    expect(translateStrictBasePlanText('Warp layer 1 (Warp yarn) denier must be greater than 0.', 'hi')).toBe(
      'Warp लेयर 1 (Warp यार्न) डेनियर का मान 0 से अधिक होना चाहिए।',
    )
    expect(translateStrictBasePlanText('Pricing assumptions. 4 active. 10% target margin. 0% commission.', 'gu')).toBe(
      'કિંમતની ધારણાઓ. 4 સક્રિય · 10% લક્ષ્ય margin · 0% કમિશન.',
    )
    expect(translateStrictBasePlanText('Pay ₹8,260 & Activate', 'hi')).toBe('₹8,260 भुगतान करें और सक्रिय करें')
    expect(translateStrictBasePlanText('Renew for ₹2,360', 'gu')).toBe('₹2,360 માટે રિન્યુ કરો')
  })

  it('covers the Base upgrade wall with complete phrases', () => {
    expect(BASE_PLAN_PHRASES.hi['Unlock Party Orders']).toBe('पार्टी ऑर्डर अनलॉक करें')
    expect(BASE_PLAN_PHRASES.gu['Unlock Party Orders']).toBe('પાર્ટી ઑર્ડર અનલૉક કરો')
  })

  it('limits strict cleanup to Base-plan surfaces', () => {
    expect(isBasePlanSurfacePath('/owner/estimator')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/orders')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/operations')).toBe(true)
    expect(isBasePlanSurfacePath('/owner/payroll')).toBe(true)
  })
})
