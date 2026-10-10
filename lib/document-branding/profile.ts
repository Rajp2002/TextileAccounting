import { z } from 'zod'
import type { DocumentBusinessProfile, DocumentBrandingPreferences } from './types'

/** 15 characters: state code, PAN, entity number, Z, check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const text = (maximum: number) => z.string().trim().max(maximum)

/**
 * The factory details printed on documents. Every field is optional; a blank
 * field is simply left off the page. Limits match the table constraints in
 * the document_branding migration.
 */
export const BusinessProfileSchema = z.object({
  address: text(400),
  gstin: z.string().trim().toUpperCase().refine(value => value === '' || GSTIN_PATTERN.test(value), 'gstin_invalid'),
  phone: z.string().trim().max(40).refine(value => value === '' || /^[0-9+()\-\s/,]{6,40}$/.test(value), 'phone_invalid'),
  email: z.string().trim().max(160).refine(value => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'email_invalid'),
  bankDetails: text(400),
  defaultQuotationTerms: text(2000),
}).strict()

export type BusinessProfileInput = z.input<typeof BusinessProfileSchema>

export const BrandingPreferencesSchema = z.object({
  quotationLogoEnabled: z.boolean(),
  internalCostSheetLogoEnabled: z.boolean(),
  deliveryChallanLogoEnabled: z.boolean(),
}).strict()

/** Profile fields as stored: blanks become NULL so a cleared field stays cleared. */
export function businessProfileToRow(profile: z.output<typeof BusinessProfileSchema>) {
  const orNull = (value: string) => value === '' ? null : value
  return {
    business_address: orNull(profile.address),
    gstin: orNull(profile.gstin),
    phone: orNull(profile.phone),
    email: orNull(profile.email),
    bank_details: orNull(profile.bankDetails),
    default_quotation_terms: orNull(profile.defaultQuotationTerms),
  }
}

export type DocumentBrandingSettingsRow = {
  org_id: string
  active_logo_asset_id: string | null
  quotation_logo_enabled: boolean
  internal_cost_sheet_logo_enabled: boolean
  delivery_challan_logo_enabled: boolean
  business_address: string | null
  gstin: string | null
  phone: string | null
  email: string | null
  bank_details: string | null
  default_quotation_terms: string | null
  updated_at: string | null
}

export function businessProfileFromRow(row: Partial<DocumentBrandingSettingsRow> | null | undefined): DocumentBusinessProfile {
  return {
    address: row?.business_address ?? '',
    gstin: row?.gstin ?? '',
    phone: row?.phone ?? '',
    email: row?.email ?? '',
    bankDetails: row?.bank_details ?? '',
  }
}

export function preferencesFromRow(row: Partial<DocumentBrandingSettingsRow> | null | undefined): DocumentBrandingPreferences {
  return {
    quotationLogoEnabled: row?.quotation_logo_enabled ?? true,
    internalCostSheetLogoEnabled: row?.internal_cost_sheet_logo_enabled ?? true,
    deliveryChallanLogoEnabled: row?.delivery_challan_logo_enabled ?? true,
  }
}
