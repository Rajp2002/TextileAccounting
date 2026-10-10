import type { BrandedDocumentType, DocumentBrandingPreferences, LogoAssetStatus, LogoVariant } from './types'

export type LogoAssetRow = {
  id: string
  org_id: string
  status: LogoAssetStatus
  original_object_path: string | null
  fallback_object_path: string | null
  svg_object_path: string | null
  svg_raster_object_path: string | null
  width: number | null
  height: number | null
  display_width: number | null
  display_height: number | null
  svg_difference_pct: number | string | null
  recommended_variant: LogoVariant | null
  selected_variant: LogoVariant | null
  error_code: string | null
  created_at: string
  updated_at: string
}

/** Every column the server reads; object paths stay on the server. */
export const LOGO_ASSET_COLUMNS = 'id, org_id, status, original_object_path, fallback_object_path, svg_object_path, svg_raster_object_path, width, height, display_width, display_height, svg_difference_pct, recommended_variant, selected_variant, error_code, created_at, updated_at'

/** Storage keys use generated ids only, never the uploaded filename. */
export function logoObjectPaths(orgId: string, assetId: string, extension: 'png' | 'jpg' | 'webp') {
  const folder = `${orgId}/logos/${assetId}`
  return {
    folder,
    original: `${folder}/original.${extension}`,
    fallback: `${folder}/fallback.png`,
    svg: `${folder}/approved.svg`,
    svgRaster: `${folder}/approved-svg.png`,
  }
}

/** Processing that started this long ago and never finished may be retried. */
export const STALE_PROCESSING_MS = 2 * 60 * 1000

export function canRetryProcessing(asset: Pick<LogoAssetRow, 'status' | 'updated_at' | 'original_object_path'>, now = Date.now()) {
  if (!asset.original_object_path) return false
  if (asset.status === 'failed' || asset.status === 'uploaded') return true
  if (asset.status !== 'processing') return false
  const updatedAt = Date.parse(asset.updated_at)
  return Number.isFinite(updatedAt) && now - updatedAt > STALE_PROCESSING_MS
}

/**
 * Retention: a factory keeps its active logo and at most one candidate. When a
 * new logo is uploaded, every other asset (an unapproved or failed candidate,
 * a rejected one, a superseded logo) is deleted with its files.
 */
export function assetsToDiscardBeforeUpload(assets: Array<Pick<LogoAssetRow, 'id' | 'status'>>, activeAssetId: string | null) {
  return assets.filter(asset => asset.id !== activeAssetId && asset.status !== 'active')
}

/** The PNG a document embeds for the chosen version; the raster fallback when the traced one is missing. */
export function documentLogoObjectPath(asset: Pick<LogoAssetRow, 'selected_variant' | 'svg_raster_object_path' | 'fallback_object_path'>) {
  if (asset.selected_variant === 'svg' && asset.svg_raster_object_path) return asset.svg_raster_object_path
  return asset.fallback_object_path
}

export function logoEnabledFor(preferences: DocumentBrandingPreferences, documentType: BrandedDocumentType) {
  switch (documentType) {
    case 'quotation': return preferences.quotationLogoEnabled
    case 'internal_cost_sheet': return preferences.internalCostSheetLogoEnabled
    case 'delivery_challan': return preferences.deliveryChallanLogoEnabled
  }
}

/** Stored error codes the review screen knows how to explain; anything else reads as a generic failure. */
export const LOGO_ERROR_CODES = [
  'file_missing',
  'file_too_large',
  'unsupported_format',
  'format_mismatch',
  'image_unreadable',
  'image_too_small',
  'image_too_large',
  'image_animated',
  'trace_failed',
  'svg_rejected',
  'storage_failed',
] as const
export type LogoErrorCode = (typeof LOGO_ERROR_CODES)[number]

export function knownLogoErrorCode(code: string | null | undefined): LogoErrorCode | null {
  return (LOGO_ERROR_CODES as readonly string[]).includes(code ?? '') ? code as LogoErrorCode : null
}
