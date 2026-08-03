import type { Language } from '@/lib/i18n/context'

/**
 * Paid Base Plan language promise for the pilot. The locale files and the
 * runtime fallback glossary are maintained together for these three languages.
 */
export const BASE_PLAN_LANGUAGE_POLICY = {
  state: 'all_three' as const,
  supportedLanguages: ['en', 'hi', 'gu'] as const satisfies readonly Language[],
  labels: {
    en: 'English',
    hi: 'हिन्दी',
    gu: 'ગુજરાતી',
  },
  surfaces: [
    'navigation',
    'estimator',
    'saved_costings',
    'quotations',
    'rate_book',
    'settings',
    'billing',
    'export',
    'validation',
    'status_and_toasts',
  ] as const,
} as const

/** Terms retained in the factory's familiar form, with explanations shown in the UI. */
export const BASE_PLAN_FACTORY_GLOSSARY = [
  { term: 'warp', explanation: 'lengthwise yarn in the fabric' },
  { term: 'weft', explanation: 'yarn inserted across the warp' },
  { term: 'PPI', explanation: 'picks per inch: weft density' },
  { term: 'crimp', explanation: 'extra yarn taken up during weaving' },
  { term: 'waste', explanation: 'yarn allowance not expected in finished fabric' },
  { term: 'pick rate', explanation: 'loom charge for each pick' },
  { term: 'costing', explanation: 'internal production-cost calculation' },
  { term: 'quotation', explanation: 'customer-facing price document' },
  { term: 'trader', explanation: 'buyer/customer account' },
  { term: 'margin', explanation: 'planned amount above production cost' },
  { term: 'GST', explanation: 'Goods and Services Tax included in the payment total' },
] as const
