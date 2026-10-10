/** The documents that can carry the factory's branding. Invoices or purchase orders can join this list later. */
export type BrandedDocumentType = 'quotation' | 'internal_cost_sheet' | 'delivery_challan'

export type DocumentBusinessProfile = {
  address: string
  gstin: string
  phone: string
  email: string
  bankDetails: string
}

/**
 * What a document renderer receives: a ready-to-embed logo (a PNG data URI
 * resolved on the server for this organization only) and the business
 * profile. `null` branding means the plan has no custom branding, so the
 * document keeps its existing plan layout.
 */
export type DocumentBranding = {
  logo: { src: string; width: number; height: number } | null
  profile: DocumentBusinessProfile
  defaultQuotationTerms: string
}

export const EMPTY_BUSINESS_PROFILE: DocumentBusinessProfile = {
  address: '',
  gstin: '',
  phone: '',
  email: '',
  bankDetails: '',
}

export type LogoAssetStatus =
  | 'uploaded'
  | 'processing'
  | 'ready_for_review'
  | 'active'
  | 'superseded'
  | 'failed'
  | 'rejected'

export type LogoVariant = 'svg' | 'raster'

/** A logo asset as the Settings screen sees it: no storage paths. */
export type LogoAssetView = {
  id: string
  status: LogoAssetStatus
  width: number | null
  height: number | null
  hasSvg: boolean
  recommendedVariant: LogoVariant | null
  selectedVariant: LogoVariant | null
  svgDifferencePct: number | null
  errorCode: string | null
  createdAt: string
  /** Short-lived signed URLs for review, rendered as images and never inlined. */
  previews: { original: string | null; raster: string | null; svg: string | null }
}

export type DocumentBrandingPreferences = {
  quotationLogoEnabled: boolean
  internalCostSheetLogoEnabled: boolean
  deliveryChallanLogoEnabled: boolean
}

export type DocumentBrandingSettingsView = {
  entitled: boolean
  canManage: boolean
  businessName: string
  profile: DocumentBusinessProfile
  defaultQuotationTerms: string
  preferences: DocumentBrandingPreferences
  activeLogo: LogoAssetView | null
  candidate: LogoAssetView | null
  updatedAt: string | null
}
