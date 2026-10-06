import { formatDateOnly, formatTimestampDate } from './format'
import { WEAVLY_LOGO_DATA_URI, WEAVLY_LOGO_HEIGHT, WEAVLY_LOGO_WIDTH } from './estimator-export-logo'
import {
  buildCostingResult,
  calculateBreakEvenPricePerM,
  normalizeCurrencySnapshot,
  type CostingResultSnapshot,
  type EstimateState,
  type EstimatorV3Totals,
} from './estimator'
import { validateCostingResultBoundary } from './estimator-validation'

export type CostingExportMode = 'internal' | 'customer'

export type CostingExportOptions = {
  mode: CostingExportMode
  businessName: string
  customerName: string
  validUntil: string
  notes: string
  showGstNote: boolean
  documentReference?: string
  allowMissingValidUntil?: boolean
}

/** Where an export's numbers come from; only server-confirmed saved identity is `saved`. */
export type CostingDocumentSource =
  | { kind: 'saved'; qualityLabel: string; version: number; savedAt: string }
  | { kind: 'working' }

/**
 * The one-line source shown above an export, as a translatable template and
 * its values: a saved costing by quality, version and save date, or unsaved
 * working inputs. The mode decides the document name.
 */
export function describeDocumentSource(source: CostingDocumentSource, mode: CostingExportMode): { text: string; values: Record<string, string | number> } {
  if (source.kind === 'working') {
    return {
      text: mode === 'customer' ? 'Customer quotation · unsaved working inputs' : 'Internal estimate · unsaved working inputs',
      values: {},
    }
  }
  return {
    text: mode === 'customer'
      ? 'Customer quotation · based on {quality} costing v{version} · saved {date}'
      : 'Internal cost sheet · based on {quality} costing v{version} · saved {date}',
    values: {
      quality: source.qualityLabel,
      version: Math.max(1, Math.trunc(Number(source.version) || 1)),
      date: formatTimestampDate(source.savedAt, { day: 'numeric', month: 'short', year: 'numeric' }),
    },
  }
}

/**
 * A short reference people can read out over the phone, for records that only
 * have a UUID (Free costings). The full id stays out of the document and the
 * filename: `ec4e031d-69a8-…` becomes `WV-EC4E031D`.
 */
export function shortDocumentReference(id: string | null | undefined, prefix = 'WV') {
  const compact = (id ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
  return compact ? `${prefix}-${compact}` : ''
}

/** A customer quotation is a document artifact, not a tax invoice. */
export const CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE =
  'This customer quotation is a document artifact only and is not a GST tax invoice.'

const EXPORT_BUSINESS_NAME_MAX_LENGTH = 160
const EXPORT_CUSTOMER_NAME_MAX_LENGTH = 160
const EXPORT_REFERENCE_MAX_LENGTH = 80
const EXPORT_NOTES_MAX_LENGTH = 2000

export type CostingExportModel = {
  qualityLabel: string
  createdAt: string
  quantityM: number
  productionCostPerM: number
  suggestedSellingPricePerM: number
  breakEvenPricePerM: number
  landedCostPerM: number
  marginPct: number
  expectedProfit: number | null
  expectedProfitPerM: number
  result: CostingResultSnapshot
  reconciliationStatus: string
  state: EstimateState
  totals: EstimatorV3Totals
}

function finiteOrZero(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function finiteNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function normalizeText(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}

function normalizeQuotationDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const candidate = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return ''
  const parsed = new Date(`${candidate}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : ''
}

/** Normalize the document context shared by preview, print, PDF, and filename generation. */
export function normalizeCostingExportOptions(options: CostingExportOptions): CostingExportOptions {
  return {
    ...options,
    mode: options.mode === 'customer' ? 'customer' : 'internal',
    businessName: normalizeText(options.businessName, EXPORT_BUSINESS_NAME_MAX_LENGTH),
    customerName: normalizeText(options.customerName, EXPORT_CUSTOMER_NAME_MAX_LENGTH),
    validUntil: normalizeQuotationDate(options.validUntil),
    notes: normalizeText(options.notes, EXPORT_NOTES_MAX_LENGTH),
    showGstNote: Boolean(options.showGstNote),
    documentReference: normalizeText(options.documentReference, EXPORT_REFERENCE_MAX_LENGTH) || undefined,
    allowMissingValidUntil: Boolean(options.allowMissingValidUntil),
  }
}

// Kept as a public export for existing callers. The implementation now lives
// in the estimator's canonical calculation module so PDFs cannot drift from
// the estimator break-even formula.
export { calculateBreakEvenPricePerM }

export function createCostingExportModel(input: {
  qualityLabel: string
  createdAt?: string
  state: EstimateState
  totals: EstimatorV3Totals
  result?: CostingResultSnapshot
  reconciliationStatus?: string
  suggestedSellingPricePerM?: number
  landedCostPerM?: number
  marginPct?: number
}): CostingExportModel {
  const calculatedResult = input.result ?? buildCostingResult(input.state, input.totals)
  const hasExplicitLegacyOverrides = input.result == null && (
    input.suggestedSellingPricePerM !== undefined
    || input.landedCostPerM !== undefined
    || input.marginPct !== undefined
  )
  const result = hasExplicitLegacyOverrides
    ? (() => {
        const suggestedSellingPricePerM = normalizeCurrencySnapshot(
          finiteNumber(input.suggestedSellingPricePerM) ?? calculatedResult.suggestedSellingPricePerM,
        )
        const landedCostPerM = normalizeCurrencySnapshot(
          finiteNumber(input.landedCostPerM) ?? calculatedResult.landedCostPerM,
        )
        const profitPerM = normalizeCurrencySnapshot(suggestedSellingPricePerM - landedCostPerM)
        const commissionPerM = normalizeCurrencySnapshot(
          landedCostPerM - calculatedResult.productionCostPerM - calculatedResult.transportPerM,
        )
        const commissionPct = suggestedSellingPricePerM > 0
          ? normalizeCurrencySnapshot(commissionPerM / suggestedSellingPricePerM * 100)
          : calculatedResult.commissionPct
        const quantityM = calculatedResult.quantityM
        const totalOrderValue = quantityM == null ? null : normalizeCurrencySnapshot(suggestedSellingPricePerM * quantityM)
        const totalLandedCost = quantityM == null ? null : normalizeCurrencySnapshot(landedCostPerM * quantityM)
        return {
          ...calculatedResult,
          suggestedSellingPricePerM,
          commissionPct,
          commissionPerM,
          landedCostPerM,
          breakEvenPricePerM: normalizeCurrencySnapshot(calculateBreakEvenPricePerM(
            calculatedResult.productionCostPerM,
            calculatedResult.transportPerM,
            commissionPct,
          )),
          profitPerM,
          totalOrderValue,
          totalLandedCost,
          expectedProfitTotal: totalOrderValue == null || totalLandedCost == null
            ? null
            : normalizeCurrencySnapshot(totalOrderValue - totalLandedCost),
          targetMarginPct: finiteNumber(input.marginPct) ?? calculatedResult.targetMarginPct,
          actualMarginPct: finiteNumber(input.marginPct) ?? calculatedResult.actualMarginPct,
        }
      })()
    : calculatedResult
  const quantityM = result.quantityM == null ? 0 : result.quantityM
  return {
    qualityLabel: input.qualityLabel.trim() || 'Untitled Costing',
    createdAt: input.createdAt ?? new Date().toISOString(),
    quantityM,
    productionCostPerM: result.productionCostPerM,
    suggestedSellingPricePerM: result.suggestedSellingPricePerM,
    breakEvenPricePerM: result.breakEvenPricePerM,
    landedCostPerM: result.landedCostPerM,
    marginPct: result.actualMarginPct,
    expectedProfit: result.expectedProfitTotal,
    expectedProfitPerM: result.profitPerM,
    result,
    reconciliationStatus: input.reconciliationStatus ?? 'verified',
    state: input.state,
    totals: input.totals,
  }
}

export function validateCostingExportInput(model: CostingExportModel | null, rawOptions: CostingExportOptions) {
  const options = normalizeCostingExportOptions(rawOptions)
  if (!model) return ['The costing result is not ready yet.']

  const errors: string[] = []
  if (model.reconciliationStatus !== 'verified') {
    errors.push('This historical costing is not verified for export. Open it, review the assumptions, and save a new current Cost Estimate before exporting.')
  }
  if (options.mode === 'customer'
    && model.reconciliationStatus !== 'verified'
    && model.reconciliationStatus !== 'unreconstructable') {
    errors.push('This saved costing needs owner review before it can be used as a customer quotation. Check the saved numbers or save a new current costing.')
  }
  if (model.reconciliationStatus !== 'unreconstructable') {
    const resultValidation = validateCostingResultBoundary(model.result, model.totals)
    if (!resultValidation.valid) {
      errors.push(resultValidation.issues[0]?.message ?? 'The costing result is not valid for export. Review the calculation before exporting.')
    }
  }
  if (!model.qualityLabel.trim()) errors.push('Quality is required before generating a document.')
  if (!Number.isFinite(model.productionCostPerM) || model.productionCostPerM <= 0) errors.push('Production cost is not valid. Review the costing before exporting.')
  if (!Number.isFinite(model.suggestedSellingPricePerM) || model.suggestedSellingPricePerM <= 0) errors.push('Selling price per metre is not valid. Review the commercial assumptions before exporting.')
  if (typeof rawOptions.notes === 'string' && rawOptions.notes.trim().length > EXPORT_NOTES_MAX_LENGTH) errors.push(`Notes must be ${EXPORT_NOTES_MAX_LENGTH.toLocaleString('en-IN')} characters or fewer.`)

  if (options.mode === 'customer') {
    if (!options.customerName.trim()) errors.push('Enter the party or customer name before creating a quotation.')
    if (!Number.isFinite(model.quantityM) || model.quantityM <= 0) errors.push('Enter an order quantity before creating a Customer Quotation.')
    const hasValidUntil = Boolean(options.validUntil)
    const rawValidity = typeof rawOptions.validUntil === 'string' ? rawOptions.validUntil.trim() : ''
    if ((!hasValidUntil && !options.allowMissingValidUntil) || (rawValidity && !hasValidUntil)) {
      errors.push('Choose a valid quotation validity date.')
    }
  }

  return errors
}

function filenamePart(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48)
  return normalized || fallback
}

function documentDate(value: string) {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export function getCostingExportFilename(model: CostingExportModel, rawOptions: CostingExportOptions) {
  const options = normalizeCostingExportOptions(rawOptions)
  const documentType = options.mode === 'internal' ? 'cost-estimate' : 'quotation'
  const parts = [
    documentType,
    filenamePart(options.documentReference, ''),
    options.mode === 'customer' ? filenamePart(options.customerName, '') : '',
    filenamePart(model.qualityLabel, 'quality'),
    documentDate(model.createdAt),
  ].filter(Boolean)
  return `${parts.join('-')}.pdf`
}

export function buildQuotationShareMessage(model: CostingExportModel, rawOptions: CostingExportOptions) {
  const options = normalizeCostingExportOptions(rawOptions)
  const reference = options.documentReference?.trim() || 'quotation'
  const quantity = model.quantityM > 0 ? `${model.quantityM.toLocaleString('en-IN')} m` : 'quantity to be confirmed'
  const validity = options.validUntil ? new Date(`${options.validUntil}T00:00:00`).toLocaleDateString('en-IN') : 'to be confirmed'
  return [
    `Quotation ${reference}`,
    options.customerName.trim() ? `For: ${options.customerName.trim()}` : null,
    `Quality: ${model.qualityLabel}`,
    `Price: ${money(model.suggestedSellingPricePerM)}/m`,
    `Quantity: ${quantity}`,
    `Valid until: ${validity}`,
    'PDF quotation attached separately.',
  ].filter(Boolean).join('\n')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function money(value: number, digits = 2) {
  return `Rs ${finiteOrZero(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function decimal(value: number, digits: number) {
  return finiteOrZero(value).toFixed(digits)
}

/** "3 Oct 2026": unambiguous for both d/m and m/d readers, unlike 3/10/2026. */
const DOCUMENT_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

/** Markup that its builder has already escaped; every other table cell is escaped on the way in. */
type RawHtml = { html: string }
const raw = (html: string): RawHtml => ({ html })
type Cell = string | RawHtml

/** Columns from `numericFrom` on are numbers: right-aligned in the header and in every row. */
function tableHead(labels: string[], numericFrom = labels.length) {
  return `<tr>${labels.map((label, index) => `<th${index >= numericFrom ? ' class="num"' : ''}>${escapeHtml(label)}</th>`).join('')}</tr>`
}

function tableRow(cells: Cell[], numericFrom = cells.length, className = '') {
  const body = cells.map((cell, index) => `<td${index >= numericFrom ? ' class="num"' : ''}>${typeof cell === 'string' ? escapeHtml(cell) : cell.html}</td>`).join('')
  return `<tr${className ? ` class="${className}"` : ''}>${body}</tr>`
}

function figure(label: string, value: string, tone: 'default' | 'accent' | 'positive' | 'negative' = 'default') {
  return `<div class="figure figure-${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

/** Weavly navy and saffron on warm neutrals, matching the app (see design.md). */
const PRINT_STYLES = `
  @page{size:A4;margin:12mm 13mm 14mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body,.costing-pdf-root{font-family:Arial,Helvetica,sans-serif;color:#2C3331;font-size:12px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .document{width:100%;max-width:100%;margin:0 auto}
  .brandbar{display:flex;height:6px;margin-bottom:20px}.brandbar i{display:block;height:6px}.brandbar .navy{width:88%;background:#18252E}.brandbar .saffron{width:12%;background:#E27025}
  .masthead{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:1px solid #DED2BD}
  .brand{display:flex;align-items:center;min-width:0}.logo{display:block;flex:none}.issuer{min-width:0;margin-left:16px;padding-left:16px;border-left:1px solid #DED2BD}.issuername{color:#18252E;font-size:17px;font-weight:700;line-height:1.2;letter-spacing:-.01em;overflow-wrap:anywhere}.doctype{margin-top:3px;color:#A94713;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
  .docmeta{flex:none;text-align:right}.docmeta strong{display:block;margin-bottom:4px;color:#18252E;font-size:13px}.docmeta p{margin:0;color:#4B5350;font-size:11px}.mrow{display:flex;justify-content:flex-end;gap:8px;font-size:11px;line-height:1.55}.mrow .ml{color:#4B5350}.mrow .mv{color:#1E2528;font-weight:700}
  .titleblock{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:20px 0 16px}.eyebrow{margin-bottom:4px;color:#A94713;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.14em}.titleblock h1{margin:0;color:#18252E;font-size:26px;line-height:1.15;letter-spacing:-.025em;overflow-wrap:anywhere}.titleaside{flex:none;color:#4B5350;font-size:11px;text-align:right}.titleaside b{display:block;margin-top:2px;color:#1E2528;font-size:13px}.tag{display:inline-block;padding:4px 10px;border:1px solid #DED2BD;border-radius:999px;background:#FAF1E2;color:#A94713;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:hidden;border:1px solid #DED2BD;border-radius:8px;background:#FAF1E2}.figure{padding:12px 14px}.figure:nth-child(n+4){border-top:1px solid #DED2BD}.figure:not(:nth-child(3n+1)){border-left:1px solid #DED2BD}.figure span{display:block;color:#4B5350;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.figure strong{display:block;margin-top:5px;color:#18252E;font-size:20px;line-height:1.1;letter-spacing:-.02em;white-space:nowrap}.figure-accent strong{color:#A94713}.figure-positive strong{color:#2F6B43}.figure-negative strong{color:#A6402D}
  .section{margin-top:18px;break-inside:avoid;page-break-inside:avoid}.sectionhead{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:7px}.sectionhead h2{margin:0;color:#18252E;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.sectionhead span{color:#4B5350;font-size:10px}
  table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #DED2BD;border-radius:8px}thead,thead tr{background:#18252E}th{padding:8px 10px;background:#18252E;color:#fff;font-size:9.5px;text-align:left;text-transform:uppercase;letter-spacing:.08em}th.num,td.num{text-align:right;white-space:nowrap}td{padding:8px 10px;border-top:1px solid #EADFCB;color:#2C3331}tbody tr:first-child td{border-top:0}tbody tr:nth-child(even):not(.total),tbody tr:nth-child(even):not(.total) td{background:#FDFAF3}.total,.total td{background:#FAF1E2}.total td{border-top:1.5px solid #18252E;color:#18252E;font-weight:700}
  .share{display:flex;align-items:center;justify-content:flex-end;gap:8px}.bar{display:block;width:64px;height:6px;overflow:hidden;border-radius:3px;background:#EADFCB}.bar b{display:block;height:6px;background:#E27025}
  .commercial{display:grid;grid-template-columns:1fr 1fr 1.45fr 1fr;overflow:hidden;border:1px solid #DED2BD;border-radius:8px;background:#FAF1E2}.commercial div{padding:10px 12px;border-left:1px solid #DED2BD}.commercial div:first-child{border-left:0}.commercial span{display:block;color:#4B5350;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.commercial strong{display:block;margin-top:4px;color:#1E2528;font-size:13px}
  .parties{display:flex;margin-bottom:18px;overflow:hidden;border:1px solid #DED2BD;border-radius:8px}.parties div{flex:1;min-width:0;padding:12px 14px}.parties div+div{border-left:1px solid #DED2BD}.parties span{display:block;color:#4B5350;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.parties strong{display:block;margin-top:4px;color:#18252E;font-size:14px;line-height:1.3;overflow-wrap:anywhere}
  .desc strong{display:block;color:#18252E;font-size:13px;overflow-wrap:anywhere}.desc small{display:block;margin-top:2px;color:#4B5350;font-size:10px}
  .quotevalue{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:10px;padding:14px 16px;border-radius:8px;background:#18252E;color:#fff}.quotevalue span{color:#F9DFC8;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.quotevalue strong{font-size:22px;letter-spacing:-.02em;white-space:nowrap}
  .note{margin-top:18px;padding:12px 14px;border-left:3px solid #E27025;border-radius:0 8px 8px 0;background:#FAF1E2;color:#2C3331}.note strong{display:block;margin-bottom:5px;color:#A94713;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em}.noteline{white-space:pre-wrap}.term{display:flex;gap:8px;margin-top:3px}.term:first-of-type{margin-top:0}.term .n{flex:none;width:16px;color:#A94713;font-weight:700}.term p{margin:0;min-width:0;overflow-wrap:anywhere}
  .signoff{display:flex;gap:32px;margin-top:36px;break-inside:avoid;page-break-inside:avoid}.signoff div{flex:1;padding-top:8px;border-top:1px solid #18252E;color:#4B5350;font-size:10px}.signoff strong{display:block;color:#1E2528;font-size:11px}
  .gst{margin:16px 0 0;color:#4B5350;font-size:10px;line-height:1.5}
  .footer{display:flex;justify-content:space-between;gap:24px;margin-top:22px;padding-top:10px;border-top:1px solid #DED2BD;color:#4B5350;font-size:10px}.footer strong{color:#18252E}
`

/**
 * Returns the styled body used by jsPDF.html(). The old export extracted only
 * the body and silently dropped the stylesheet from <head>, producing the raw,
 * unformatted PDF that prompted this redesign.
 */
export function extractStyledCostingBody(html: string) {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n')
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  return `<style>${styles}</style><div class="costing-pdf-root">${body}</div>`
}

const LOGO_DISPLAY_WIDTH = 100

/**
 * Solid segments, not a hard-stop gradient: html2canvas paints the gradient
 * black in the PDF, so only the on-screen preview would ever show the colours.
 */
const TOP_BAR = '<div class="brandbar"><i class="navy"></i><i class="saffron"></i></div>'

function masthead(input: { businessName: string; docType: string; metaTitle: string; meta?: Array<[string, string]>; metaNote?: string }) {
  const logo = `<img class="logo" src="${WEAVLY_LOGO_DATA_URI}" width="${LOGO_DISPLAY_WIDTH}" height="${Math.round(LOGO_DISPLAY_WIDTH * WEAVLY_LOGO_HEIGHT / WEAVLY_LOGO_WIDTH)}" alt="Weavly">`
  const issuer = `<div class="issuer">${input.businessName ? `<div class="issuername">${escapeHtml(input.businessName)}</div>` : ''}<div class="doctype">${escapeHtml(input.docType)}</div></div>`
  const meta = (input.meta ?? []).map(([label, value]) => `<div class="mrow"><span class="ml">${escapeHtml(label)}</span><span class="mv">${escapeHtml(value)}</span></div>`).join('')
  return `<header class="masthead"><div class="brand">${logo}${issuer}</div><div class="docmeta"><strong>${escapeHtml(input.metaTitle)}</strong>${meta}${input.metaNote ? `<p>${escapeHtml(input.metaNote)}</p>` : ''}</div></header>`
}

function titleBlock(quality: string, aside: string) {
  return `<section class="titleblock"><div><div class="eyebrow">Fabric quality</div><h1>${escapeHtml(quality)}</h1></div>${aside ? `<div class="titleaside">${aside}</div>` : ''}</section>`
}

function footer(left: string, right: string) {
  return `<footer class="footer"><span>${left}</span><span>${escapeHtml(right)}</span></footer>`
}

const GENERATED_BY = 'Generated by <strong>Weavly Cost Estimate</strong>'

export function buildCostingPrintHtml(model: CostingExportModel, rawOptions: CostingExportOptions) {
  const options = normalizeCostingExportOptions(rawOptions)
  const isInternal = options.mode === 'internal'
  const docType = isInternal ? 'Internal Cost Sheet' : 'Customer Quotation'
  const businessName = options.businessName.trim()
  const customer = options.customerName.trim()
  const head = (title: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>`
  if (model.reconciliationStatus === 'unreconstructable') {
    return `${head(`${model.qualityLabel} — review required`)}
<main class="document">
  ${TOP_BAR}
  ${masthead({ businessName, docType, metaTitle: 'Review required', metaNote: 'Prepared from an incomplete historical snapshot' })}
  ${titleBlock(model.qualityLabel, customer ? `Prepared for<b>${escapeHtml(customer)}</b>` : 'Historical record')}
  <section class="note"><strong>Financial values not shown</strong>This historical costing is missing one or more saved assumptions. Re-enter or confirm the costing in Cost Estimate and save a new snapshot before using it as a customer quotation.</section>
  ${footer(GENERATED_BY, 'Customer export is blocked until the costing is reconciled.')}
</main></body></html>`
  }
  const state = model.state
  const totals = model.totals
  const parsedCreatedAt = new Date(model.createdAt)
  const date = Number.isFinite(parsedCreatedAt.getTime()) ? formatTimestampDate(parsedCreatedAt, DOCUMENT_DATE_FORMAT) : 'Not specified'
  const validUntil = options.validUntil ? formatDateOnly(options.validUntil, DOCUMENT_DATE_FORMAT) : 'Not specified'
  const notes = options.notes.trim()
  const quantity = model.quantityM > 0 ? `${model.quantityM.toLocaleString('en-IN')} m` : 'Not specified'
  const reference = options.documentReference?.trim() || ''
  const customerDisclaimer = options.showGstNote
    ? `GST will be charged as applicable on the final tax invoice. ${CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE}`
    : CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE
  const hasMatchingLayerDetails = Number.isFinite(totals.totalProductionCostPerM)
    && Math.abs(totals.totalProductionCostPerM - model.result.productionCostPerM) <= 0.01
  const yarnCostItems: [string, number][] = hasMatchingLayerDetails
    ? [
        ['Base warp yarn', totals.yarnBaseWarpPerM],
        ['Base weft yarn', totals.yarnBaseWeftPerM],
        ['Yarn wastage / crimp', totals.yarnShortageCostPerM],
      ]
    : [
        ['Warp yarn (saved adjusted cost)', model.result.breakdown.warpCostPerM],
        ['Weft yarn (saved adjusted cost)', model.result.breakdown.weftCostPerM],
      ]

  const costItems = [
    ...yarnCostItems,
    ['Machine weaving', model.result.breakdown.weaveCostPerM],
    ['Warping + sizing', model.result.breakdown.warpingAndSizingPerM],
    ...(model.result.breakdown.windingPerM > 0 ? [['Winding', model.result.breakdown.windingPerM] as [string, number]] : []),
    ...(model.result.breakdown.processingPerM > 0 ? [['Processing', model.result.breakdown.processingPerM] as [string, number]] : []),
    ...(model.result.breakdown.finishingPerM > 0 ? [['Finishing', model.result.breakdown.finishingPerM] as [string, number]] : []),
    ['Factory expenses', model.result.breakdown.overheadPerM],
  ] as [string, number][]

  const costRows = costItems.map(([label, value]) => {
    const sharePct = model.productionCostPerM > 0 ? finiteOrZero(value) / model.productionCostPerM * 100 : 0
    const barWidth = Math.min(100, Math.max(0, sharePct))
    return tableRow([
      label,
      raw(`<div class="share"><i class="bar"><b style="width:${decimal(barWidth, 1)}%"></b></i><span>${decimal(sharePct, 1)}%</span></div>`),
      `${money(value)}/m`,
    ], 1)
  }).join('') + tableRow(['Production cost', '100.0%', `${money(model.productionCostPerM)}/m`], 1, 'total')

  const layerRows = hasMatchingLayerDetails
    ? [
        ...totals.warpRows.map((row, index) => tableRow([
          'Warp', row.label || `Layer ${index + 1}`, `${decimal(row.baseKgPer100mUsed, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.baseCostPerMeter)}/m`,
        ], 2)),
        ...totals.weftRows.map((row, index) => tableRow([
          'Weft', row.label || `Layer ${index + 1}`, `${decimal(row.baseKgPer100mUsed, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.baseCostPerMeter)}/m`,
        ], 2)),
      ].join('')
    : tableRow(['Historical yarn details', 'Unavailable', 'Re-enter and save this costing', '—', '—'], 2)

  const internalFigures = [
    figure('Production cost', `${money(model.productionCostPerM)}/m`),
    figure('Suggested selling price', `${money(model.suggestedSellingPricePerM)}/m`, 'accent'),
    figure('Break-even price', `${money(model.breakEvenPricePerM)}/m`),
    figure('Estimated margin at this price', `${decimal(model.marginPct, 1)}%`, model.marginPct < 0 ? 'negative' : 'positive'),
    figure('Order quantity', quantity),
    model.expectedProfit != null
      ? figure(model.expectedProfit < 0 ? 'Expected loss' : 'Expected profit', money(Math.abs(model.expectedProfit), 0), model.expectedProfit < 0 ? 'negative' : 'positive')
      : figure(model.expectedProfitPerM < 0 ? 'Loss / m' : 'Profit / m', `${money(Math.abs(model.expectedProfitPerM))}/m`, model.expectedProfitPerM < 0 ? 'negative' : 'positive'),
  ].join('')

  const internalBody = `
  <section class="summary">${internalFigures}</section>
  <section class="section"><div class="sectionhead"><h2>Cost breakdown</h2><span>Per metre of finished fabric</span></div>
    <table><thead>${tableHead(['Cost component', 'Share', 'Cost / m'], 1)}</thead><tbody>${costRows}</tbody></table>
  </section>
  <section class="section"><div class="sectionhead"><h2>Base yarn calculation</h2><span>${hasMatchingLayerDetails ? 'Wastage is shown separately in the cost breakdown above' : 'Detailed historical values unavailable'}</span></div>
    <table><thead>${tableHead(['Use', 'Yarn / layer', 'Base kg / 100m', 'Rate', 'Base cost / m'], 2)}</thead><tbody>${layerRows}</tbody></table>
  </section>
  <section class="section"><div class="sectionhead"><h2>Commercial assumptions</h2></div>
    <div class="commercial"><div><span>Broker commission</span><strong>${decimal(model.result.commissionPct, 1)}%</strong></div><div><span>Transport charge</span><strong>${money(model.result.transportPerM)}/m</strong></div><div><span>Standard monthly production</span><strong>${finiteOrZero(state.monthlyOutputM).toLocaleString('en-IN')} m</strong></div><div><span>Target margin</span><strong>${decimal(model.result.targetMarginPct, 1)}%</strong></div></div>
  </section>
  ${notes ? `<section class="note"><strong>Internal notes</strong><div class="noteline">${escapeHtml(notes)}</div></section>` : ''}`

  const quotationValue = model.result.totalOrderValue != null ? money(model.result.totalOrderValue, 2) : 'On confirmation'
  const termLines = notes.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const parties = [
    businessName ? ['Issued by', businessName] : null,
    ['Prepared for', customer || 'To be confirmed'],
    ['Valid until', validUntil],
  ].filter((party): party is string[] => party !== null)

  const customerBody = `
  <section class="parties">${parties.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</section>
  <section class="section">
    <table><thead>${tableHead(['Description', 'Order quantity', 'Quoted price', 'Amount'], 1)}</thead><tbody>${tableRow([
      raw(`<div class="desc"><strong>${escapeHtml(model.qualityLabel)}</strong><small>Priced per metre of finished fabric</small></div>`),
      quantity,
      `${money(model.suggestedSellingPricePerM)}/m`,
      quotationValue,
    ], 1)}</tbody></table>
    <div class="quotevalue"><span>Quotation value</span><strong>${escapeHtml(quotationValue)}</strong></div>
  </section>
  ${termLines.length ? `<section class="note"><strong>Notes &amp; terms</strong>${termLines.map((line, index) => `<div class="term"><span class="n">${index + 1}.</span><p>${escapeHtml(line)}</p></div>`).join('')}</section>` : ''}
  <p class="gst">${escapeHtml(customerDisclaimer)}</p>
  <section class="signoff"><div><strong>Authorised signatory</strong>${businessName ? `For ${escapeHtml(businessName)}` : 'Name and signature'}</div><div><strong>Customer acceptance</strong>Name, signature and date</div></section>`

  const metaRows: Array<[string, string]> = [
    ...(reference ? [['Reference', reference] as [string, string]] : []),
    ['Prepared', date],
  ]
  const titleAside = isInternal
    ? (customer ? `Prepared for<b>${escapeHtml(customer)}</b>` : '<span class="tag">Confidential - internal use only</span>')
    : ''

  return `${head(model.qualityLabel)}
<main class="document">
  ${TOP_BAR}
  ${masthead({ businessName, docType, metaTitle: isInternal ? 'Costing snapshot' : 'Quotation', meta: metaRows })}
  ${titleBlock(model.qualityLabel, titleAside)}
  ${isInternal ? internalBody : customerBody}
  ${footer(GENERATED_BY, isInternal ? 'Historical costings retain their saved assumptions.' : 'Thank you for the opportunity to quote.')}
</main></body></html>`
}
