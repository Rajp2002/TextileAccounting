import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  LOGO_ASSET_COLUMNS,
  assetsToDiscardBeforeUpload,
  canRetryProcessing,
  documentLogoObjectPath,
  knownLogoErrorCode,
  logoEnabledFor,
  logoObjectPaths,
  type LogoAssetRow,
} from './assets'
import { validateLogoUpload } from './image-validation'
import { DOCUMENT_BRANDING_BUCKET, type LogoMimeType } from './limits'
import { processLogoImage, type ProcessedLogo } from './process-logo.server'
import { businessProfileFromRow, preferencesFromRow, type DocumentBrandingSettingsRow } from './profile'
import type {
  BrandedDocumentType,
  DocumentBranding,
  DocumentBrandingSettingsView,
  LogoAssetView,
  LogoVariant,
} from './types'

type AdminClient = ReturnType<typeof createAdminClient>

const SETTINGS_COLUMNS = 'org_id, active_logo_asset_id, quotation_logo_enabled, internal_cost_sheet_logo_enabled, delivery_challan_logo_enabled, business_address, gstin, phone, email, bank_details, default_quotation_terms, updated_at'
const PREVIEW_URL_SECONDS = 10 * 60

/**
 * Structured branding events for logs and Sentry breadcrumbs: ids, sizes,
 * timings and codes only, never the logo itself, a storage path or a URL.
 */
export function logBrandingEvent(event: string, fields: Record<string, string | number | boolean | null | undefined> = {}) {
  console.info(JSON.stringify({ scope: 'document_branding', event, ...fields }))
}

const EXTENSIONS: Record<LogoMimeType, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export type LogoUploadResult =
  | { ok: true; assetId: string; tracedOk: boolean }
  | { ok: false; code: string }

/**
 * Store and process a new candidate logo for one organization. The active
 * logo is never touched here: only an explicit approval switches it.
 */
export async function createLogoCandidate(input: { orgId: string; userId: string; bytes: Buffer; claimedType: string | null }): Promise<LogoUploadResult> {
  const check = validateLogoUpload(input.bytes, input.claimedType)
  if (!check.ok) {
    logBrandingEvent('upload_rejected', { org: input.orgId, code: check.code, bytes: input.bytes.length })
    return { ok: false, code: check.code }
  }

  const admin = createAdminClient()
  await discardStaleAssets(admin, input.orgId)

  const assetId = crypto.randomUUID()
  const paths = logoObjectPaths(input.orgId, assetId, EXTENSIONS[check.mimeType])
  const { error: insertError } = await admin.from('document_branding_logo_assets').insert({
    id: assetId,
    org_id: input.orgId,
    created_by: input.userId,
    status: 'uploaded',
    source_mime_type: check.mimeType,
    source_size_bytes: input.bytes.length,
  })
  if (insertError) {
    logBrandingEvent('upload_failed', { org: input.orgId, stage: 'record', code: insertError.code })
    return { ok: false, code: 'storage_failed' }
  }

  const { error: uploadError } = await admin.storage.from(DOCUMENT_BRANDING_BUCKET).upload(paths.original, input.bytes, {
    contentType: check.mimeType,
    upsert: false,
  })
  if (uploadError) {
    await admin.from('document_branding_logo_assets').delete().eq('id', assetId).eq('org_id', input.orgId)
    logBrandingEvent('upload_failed', { org: input.orgId, asset: assetId, stage: 'storage' })
    return { ok: false, code: 'storage_failed' }
  }
  await admin.from('document_branding_logo_assets')
    .update({ original_object_path: paths.original, updated_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('org_id', input.orgId)
  logBrandingEvent('upload_completed', { org: input.orgId, asset: assetId, bytes: input.bytes.length, type: check.mimeType })

  return runProcessing(admin, { orgId: input.orgId, assetId, bytes: input.bytes, fromStatus: 'uploaded', paths })
}

/** Re-run processing on a stored original after a failure; the upload is not repeated. */
export async function retryLogoProcessing(input: { orgId: string; assetId: string }): Promise<LogoUploadResult> {
  const admin = createAdminClient()
  const asset = await loadAsset(admin, input.orgId, input.assetId)
  if (!asset || !asset.original_object_path) return { ok: false, code: 'not_found' }
  if (!canRetryProcessing(asset)) return { ok: false, code: 'not_retryable' }

  const { data: blob, error } = await admin.storage.from(DOCUMENT_BRANDING_BUCKET).download(asset.original_object_path)
  if (error || !blob) {
    logBrandingEvent('retry_failed', { org: input.orgId, asset: input.assetId, stage: 'download' })
    return { ok: false, code: 'storage_failed' }
  }
  const extension = asset.original_object_path.split('.').pop()
  const paths = logoObjectPaths(input.orgId, input.assetId, extension === 'jpg' || extension === 'webp' ? extension : 'png')
  return runProcessing(admin, {
    orgId: input.orgId,
    assetId: input.assetId,
    bytes: Buffer.from(await blob.arrayBuffer()),
    fromStatus: asset.status,
    paths,
  })
}

async function runProcessing(
  admin: AdminClient,
  input: { orgId: string; assetId: string; bytes: Buffer; fromStatus: string; paths: ReturnType<typeof logoObjectPaths> },
): Promise<LogoUploadResult> {
  // Claim the asset: a duplicate click or a second tab finds it already processing.
  const { data: claimed } = await admin.from('document_branding_logo_assets')
    .update({ status: 'processing', error_code: null, updated_at: new Date().toISOString() })
    .eq('id', input.assetId)
    .eq('org_id', input.orgId)
    .eq('status', input.fromStatus)
    .select('id')
  if (!claimed?.length) return { ok: false, code: 'not_retryable' }

  const started = Date.now()
  let processed: Awaited<ReturnType<typeof processLogoImage>>
  try {
    processed = await processLogoImage(input.bytes)
  } catch {
    await markFailed(admin, input.orgId, input.assetId, 'image_unreadable')
    return { ok: false, code: 'image_unreadable' }
  }
  if (!processed.ok) {
    // Not an image we can use at all: remove it so it never shows as a candidate.
    await deleteAssets(admin, input.orgId, [input.assetId])
    logBrandingEvent('validation_failed', { org: input.orgId, asset: input.assetId, code: processed.code })
    return { ok: false, code: processed.code }
  }

  const value = processed.value
  const stored = await storeProcessedFiles(admin, input.paths, value)
  if (!stored) {
    await markFailed(admin, input.orgId, input.assetId, 'storage_failed')
    return { ok: false, code: 'storage_failed' }
  }

  const traced = value.traced
  const { error } = await admin.from('document_branding_logo_assets').update({
    status: 'ready_for_review',
    width: value.width,
    height: value.height,
    display_width: value.displayWidth,
    display_height: value.displayHeight,
    fallback_object_path: input.paths.fallback,
    svg_object_path: traced.ok ? input.paths.svg : null,
    svg_raster_object_path: traced.ok ? input.paths.svgRaster : null,
    svg_size_bytes: traced.ok ? traced.bytes : null,
    svg_path_count: traced.ok ? traced.pathCount : null,
    svg_difference_pct: traced.ok ? traced.differencePct : null,
    recommended_variant: value.recommendedVariant,
    processor_version: value.processorVersion,
    trace_profile: value.traceProfile,
    error_code: traced.ok ? null : traced.code,
    updated_at: new Date().toISOString(),
  }).eq('id', input.assetId).eq('org_id', input.orgId).eq('status', 'processing')
  if (error) {
    await markFailed(admin, input.orgId, input.assetId, 'storage_failed')
    return { ok: false, code: 'storage_failed' }
  }

  logBrandingEvent('processing_completed', {
    org: input.orgId,
    asset: input.assetId,
    ms: Date.now() - started,
    trace_ms: value.traceDurationMs,
    width: value.width,
    height: value.height,
    traced: traced.ok,
    trace_code: traced.ok ? null : traced.code,
    svg_bytes: traced.ok ? traced.bytes : null,
    svg_paths: traced.ok ? traced.pathCount : null,
    difference_pct: traced.ok ? traced.differencePct : null,
    recommended: value.recommendedVariant,
    profile: value.traceProfile,
  })
  return { ok: true, assetId: input.assetId, tracedOk: traced.ok }
}

async function storeProcessedFiles(admin: AdminClient, paths: ReturnType<typeof logoObjectPaths>, value: ProcessedLogo) {
  const bucket = admin.storage.from(DOCUMENT_BRANDING_BUCKET)
  const uploads: Array<[string, Buffer, string]> = [[paths.fallback, value.normalisedPng, 'image/png']]
  if (value.traced.ok) {
    uploads.push([paths.svg, Buffer.from(value.traced.svg), 'image/svg+xml'])
    uploads.push([paths.svgRaster, value.traced.svgRasterPng, 'image/png'])
  }
  const results = await Promise.all(uploads.map(([path, body, contentType]) => bucket.upload(path, body, { contentType, upsert: true })))
  return results.every(result => !result.error)
}

async function markFailed(admin: AdminClient, orgId: string, assetId: string, code: string) {
  await admin.from('document_branding_logo_assets')
    .update({ status: 'failed', error_code: code, updated_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('org_id', orgId)
  logBrandingEvent('processing_failed', { org: orgId, asset: assetId, code })
}

async function loadAsset(admin: AdminClient, orgId: string, assetId: string) {
  const { data } = await admin.from('document_branding_logo_assets')
    .select(LOGO_ASSET_COLUMNS)
    .eq('id', assetId)
    .eq('org_id', orgId)
    .maybeSingle()
  return (data as LogoAssetRow | null) ?? null
}

async function loadSettingsRow(admin: AdminClient, orgId: string) {
  const { data, error } = await admin.from('document_branding_settings')
    .select(SETTINGS_COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error('Document branding settings could not be loaded.')
  return (data as DocumentBrandingSettingsRow | null) ?? null
}

/** Delete asset rows and their files; the active logo is never in the list. */
async function deleteAssets(admin: AdminClient, orgId: string, assetIds: string[]) {
  if (!assetIds.length) return
  const bucket = admin.storage.from(DOCUMENT_BRANDING_BUCKET)
  for (const assetId of assetIds) {
    const folder = `${orgId}/logos/${assetId}`
    const { data: files } = await bucket.list(folder)
    if (files?.length) {
      const { error } = await bucket.remove(files.map(file => `${folder}/${file.name}`))
      if (error) logBrandingEvent('cleanup_failed', { org: orgId, asset: assetId })
    }
  }
  await admin.from('document_branding_logo_assets')
    .delete()
    .eq('org_id', orgId)
    .in('id', assetIds)
    .neq('status', 'active')
  logBrandingEvent('assets_deleted', { org: orgId, count: assetIds.length })
}

async function discardStaleAssets(admin: AdminClient, orgId: string) {
  const [settings, { data: assets }] = await Promise.all([
    loadSettingsRow(admin, orgId),
    admin.from('document_branding_logo_assets').select('id, status').eq('org_id', orgId),
  ])
  const discard = assetsToDiscardBeforeUpload((assets ?? []) as Array<Pick<LogoAssetRow, 'id' | 'status'>>, settings?.active_logo_asset_id ?? null)
  await deleteAssets(admin, orgId, discard.map(asset => asset.id))
}

/** Approve a candidate (or switch the active logo's version) in one transaction. */
export async function activateLogo(input: { orgId: string; userId: string; assetId: string; variant: LogoVariant }) {
  const admin = createAdminClient()
  const { error } = await admin.rpc('activate_document_branding_logo', {
    p_org_id: input.orgId,
    p_asset_id: input.assetId,
    p_variant: input.variant,
    p_actor_id: input.userId,
  })
  if (error) {
    logBrandingEvent('activation_failed', { org: input.orgId, asset: input.assetId, variant: input.variant, code: error.message })
    return { ok: false as const, code: error.message.startsWith('BRANDING_') ? error.message : 'activation_failed' }
  }
  logBrandingEvent('activated', { org: input.orgId, asset: input.assetId, variant: input.variant })
  return { ok: true as const }
}

export async function rejectCandidate(input: { orgId: string; assetId: string }) {
  const admin = createAdminClient()
  const asset = await loadAsset(admin, input.orgId, input.assetId)
  if (!asset || asset.status === 'active') return { ok: false as const, code: 'not_found' }
  await deleteAssets(admin, input.orgId, [input.assetId])
  logBrandingEvent('candidate_rejected', { org: input.orgId, asset: input.assetId })
  return { ok: true as const }
}

export async function clearActiveLogo(input: { orgId: string; userId: string }) {
  const admin = createAdminClient()
  const { error } = await admin.rpc('clear_document_branding_logo', { p_org_id: input.orgId, p_actor_id: input.userId })
  if (error) {
    logBrandingEvent('removal_failed', { org: input.orgId })
    return { ok: false as const, code: 'removal_failed' }
  }
  logBrandingEvent('removed', { org: input.orgId })
  return { ok: true as const }
}

/**
 * Remove every branding file of an organization. Account deletion calls this
 * after the database rows are gone, because Storage bytes are not deleted by
 * SQL.
 */
export async function removeOrganizationBrandingFiles(orgId: string) {
  const admin = createAdminClient()
  const bucket = admin.storage.from(DOCUMENT_BRANDING_BUCKET)
  const { data: assetFolders, error } = await bucket.list(`${orgId}/logos`, { limit: 1000 })
  if (error) {
    logBrandingEvent('account_cleanup_failed', { org: orgId, stage: 'list' })
    return false
  }
  let ok = true
  for (const folder of assetFolders ?? []) {
    const prefix = `${orgId}/logos/${folder.name}`
    const { data: files } = await bucket.list(prefix)
    if (!files?.length) continue
    const { error: removeError } = await bucket.remove(files.map(file => `${prefix}/${file.name}`))
    if (removeError) ok = false
  }
  if (!ok) logBrandingEvent('account_cleanup_failed', { org: orgId, stage: 'remove' })
  return ok
}

async function toAssetView(admin: AdminClient, asset: LogoAssetRow): Promise<LogoAssetView> {
  const bucket = admin.storage.from(DOCUMENT_BRANDING_BUCKET)
  const paths = [asset.original_object_path, asset.fallback_object_path, asset.svg_object_path]
  const signable = paths.filter((path): path is string => Boolean(path))
  const signed = signable.length ? (await bucket.createSignedUrls(signable, PREVIEW_URL_SECONDS)).data ?? [] : []
  const urlFor = (path: string | null) => path ? signed.find(entry => entry.path === path)?.signedUrl ?? null : null
  const difference = asset.svg_difference_pct == null ? null : Number(asset.svg_difference_pct)
  return {
    id: asset.id,
    status: asset.status,
    width: asset.width,
    height: asset.height,
    hasSvg: Boolean(asset.svg_object_path && asset.svg_raster_object_path),
    recommendedVariant: asset.recommended_variant,
    selectedVariant: asset.selected_variant,
    svgDifferencePct: Number.isFinite(difference) ? difference : null,
    errorCode: knownLogoErrorCode(asset.error_code) ?? (asset.error_code ? 'image_unreadable' : null),
    createdAt: asset.created_at,
    previews: {
      original: urlFor(asset.original_object_path),
      raster: urlFor(asset.fallback_object_path),
      svg: urlFor(asset.svg_object_path),
    },
  }
}

/** Everything the Settings screen shows, for one organization. */
export async function loadBrandingSettingsView(input: { orgId: string; businessName: string; entitled: boolean; canManage: boolean }): Promise<DocumentBrandingSettingsView> {
  const admin = createAdminClient()
  const settings = await loadSettingsRow(admin, input.orgId)
  const { data: assets } = input.entitled
    ? await admin.from('document_branding_logo_assets')
      .select(LOGO_ASSET_COLUMNS)
      .eq('org_id', input.orgId)
      .order('created_at', { ascending: false })
      .limit(5)
    : { data: [] }
  const rows = (assets ?? []) as LogoAssetRow[]
  const active = rows.find(asset => asset.id === settings?.active_logo_asset_id && asset.status === 'active') ?? null
  const candidate = rows.find(asset => asset.id !== active?.id && ['uploaded', 'processing', 'ready_for_review', 'failed'].includes(asset.status)) ?? null
  return {
    entitled: input.entitled,
    canManage: input.canManage,
    businessName: input.businessName,
    profile: businessProfileFromRow(settings),
    defaultQuotationTerms: settings?.default_quotation_terms ?? '',
    preferences: preferencesFromRow(settings),
    activeLogo: active ? await toAssetView(admin, active) : null,
    candidate: candidate ? await toAssetView(admin, candidate) : null,
    updatedAt: settings?.updated_at ?? null,
  }
}

/**
 * The shared branding resolver every document uses. It reads the verified
 * organization's settings, applies each document's logo preference, picks the
 * approved version (falling back to the uploaded raster) and returns a small
 * payload: a PNG data URI and the business profile. Branding is optional, so
 * any failure returns the profile without a logo rather than breaking the
 * export.
 */
export async function getDocumentBranding(orgId: string, documentType: BrandedDocumentType): Promise<DocumentBranding> {
  return (await getDocumentBrandingFor(orgId, [documentType]))[documentType] as DocumentBranding
}

/** The resolver for several documents at once (the costing export offers two), with one logo download. */
export async function getDocumentBrandingFor<T extends BrandedDocumentType>(orgId: string, documentTypes: T[]): Promise<Record<T, DocumentBranding>> {
  const admin = createAdminClient()
  let settings: DocumentBrandingSettingsRow | null = null
  try {
    settings = await loadSettingsRow(admin, orgId)
  } catch {
    logBrandingEvent('resolve_failed', { org: orgId, stage: 'settings' })
  }
  const profile = businessProfileFromRow(settings)
  const defaultQuotationTerms = settings?.default_quotation_terms ?? ''
  const preferences = preferencesFromRow(settings)
  const wantsLogo = documentTypes.filter(type => logoEnabledFor(preferences, type))
  const logo = settings?.active_logo_asset_id && wantsLogo.length
    ? await resolveActiveLogo(admin, orgId, settings.active_logo_asset_id)
    : null
  return Object.fromEntries(documentTypes.map(type => [type, {
    logo: wantsLogo.includes(type) ? logo : null,
    profile,
    defaultQuotationTerms,
  }])) as Record<T, DocumentBranding>
}

async function resolveActiveLogo(admin: AdminClient, orgId: string, assetId: string): Promise<DocumentBranding['logo']> {
  try {
    const asset = await loadAsset(admin, orgId, assetId)
    if (!asset || asset.status !== 'active' || asset.org_id !== orgId) return null
    const bucket = admin.storage.from(DOCUMENT_BRANDING_BUCKET)
    const preferred = documentLogoObjectPath(asset)
    let file = preferred ? await bucket.download(preferred) : null
    if ((!file || file.error || !file.data) && asset.fallback_object_path && preferred !== asset.fallback_object_path) {
      logBrandingEvent('resolve_fallback', { org: orgId, asset: asset.id })
      file = await bucket.download(asset.fallback_object_path)
    }
    if (!file || file.error || !file.data) {
      logBrandingEvent('resolve_failed', { org: orgId, asset: asset.id, stage: 'download' })
      return null
    }
    const width = asset.display_width ?? asset.width
    const height = asset.display_height ?? asset.height
    if (!width || !height) return null
    const bytes = Buffer.from(await file.data.arrayBuffer())
    return { src: `data:image/png;base64,${bytes.toString('base64')}`, width, height }
  } catch {
    logBrandingEvent('resolve_failed', { org: orgId, stage: 'logo' })
    return null
  }
}
