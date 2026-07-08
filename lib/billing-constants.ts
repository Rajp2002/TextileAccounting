/**
 * Server-side billing constants for Weavly Full Suite checkout
 * Using Order-based one-time billing model.
 */

export const FIRST_YEAR_BASE_PAISE = 1500000 // ₹15,000
export const FIRST_YEAR_GST_PAISE = 270000   // ₹2,700 (18% of ₹15,000)
export const FIRST_YEAR_TOTAL_PAISE = 1770000 // ₹17,700

export const RENEWAL_BASE_PAISE = 700000     // ₹7,000
export const RENEWAL_GST_PAISE = 126000      // ₹1,260 (18% of ₹7,000)
export const RENEWAL_TOTAL_PAISE = 826000     // ₹8,260

export const GST_RATE = 0.18

export const BILLING_MODEL = 'upfront_first_year_plus_annual_renewal'
export const ACCESS_DAYS = 365
