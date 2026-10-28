import { formatDateOnly, formatTimestampDate } from './format'
import { WEAVLY_LOGO_DATA_URI, WEAVLY_LOGO_HEIGHT, WEAVLY_LOGO_WIDTH } from './estimator-export-logo'
import { calculateBreakEvenPricePerM } from './estimator'
import { type CostingExportModel } from './costing-export-model'
import { validateCostingResultBoundary } from './estimator-validation'
import { documentLabels, fillLabel, type DocumentLabels } from './i18n/document-labels'
import { buildFabricSpec, type FabricSpec } from './fabric-spec'
import { fitLogoInBox } from './document-branding/layout'
import type { DocumentBranding } from './document-branding/types'
import type { Language } from './i18n/context'

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
  /** Printed labels follow the owner's language; typed values print as entered. */
  language?: Language
  /**
   * The factory's logo and business profile, resolved on the server for paid
   * plans. Without it the document keeps the Free layout: Weavly mark and the
   * typed business name.
   */
  branding?: DocumentBranding | null
  /** Print the fabric construction (width, ends, picks, yarns) on the quotation. */
  showFabricSpec?: boolean
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

/** A customer quotation is a document artifact, not a tax invoice. */
export const CUSTOMER_QUOTATION_NOT_TAX_INVOICE_NOTICE =
  'This customer quotation is a document artifact only and is not a GST tax invoice.'

const EXPORT_BUSINESS_NAME_MAX_LENGTH = 160
const EXPORT_CUSTOMER_NAME_MAX_LENGTH = 160
const EXPORT_REFERENCE_MAX_LENGTH = 80
const EXPORT_NOTES_MAX_LENGTH = 2000

function finiteOrZero(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
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
    language: options.language === 'hi' || options.language === 'gu' ? options.language : 'en',
    branding: options.branding ?? null,
    showFabricSpec: options.showFabricSpec !== false,
  }
}

// Kept as a public export for existing callers. The implementation now lives
// in the estimator's canonical calculation module so PDFs cannot drift from
// the estimator break-even formula.
export { calculateBreakEvenPricePerM }
// The model lives in costing-export-model.ts so pages can build it without
// loading this renderer; re-exported for existing callers.
export { createCostingExportModel, shortDocumentReference, type CostingExportModel } from './costing-export-model'

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

/**
 * Weavly navy and saffron on warm neutrals, matching the app (see design.md).
 * On screen (the live preview and the print window) the document sits on a
 * page-sized sheet with the @page margins, so it reads like the PDF instead of
 * running edge to edge. Every screen rule is scoped to `body > .document`, which
 * the PDF renderer never has (it wraps the body in `.costing-pdf-root` inside the
 * app), so a PDF made on a phone keeps the 700px print layout.
 */
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
  .factorylogo{display:block;flex:none}.branded .issuer{min-width:0}.branded .issuer.withlogo{margin-left:16px;padding-left:16px;border-left:1px solid #DED2BD}.branded .issuer:not(.withlogo){margin-left:0;padding-left:0;border-left:0}.issuerline{margin-top:2px;color:#4B5350;font-size:10.5px;line-height:1.4;white-space:pre-line;overflow-wrap:anywhere}.branded .doctype{margin-top:5px}
  .spec{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;border:1px solid #DED2BD;border-radius:8px}.spec div{min-width:0;padding:9px 12px;border-left:1px solid #DED2BD}.spec div:nth-child(4n+1){border-left:0}.spec div:nth-child(n+5){border-top:1px solid #DED2BD}.spec span{display:block;color:#4B5350;font-size:9.5px;font-weight:700;letter-spacing:.06em}.spec strong{display:block;margin-top:3px;color:#18252E;font-size:12px;overflow-wrap:anywhere}.spec .wide{grid-column:span 2}
  .poweredby{display:inline-flex;align-items:center;gap:6px}.poweredby img{display:block}
  html[lang="hi"] body,html[lang="gu"] body,.costing-pdf-root[lang="hi"],.costing-pdf-root[lang="gu"]{font-family:Arial,Helvetica,"Noto Sans Devanagari","Noto Sans Gujarati","Nirmala UI",Mangal,Shruti,sans-serif}
  [lang="hi"] .doctype,[lang="gu"] .doctype,[lang="hi"] .eyebrow,[lang="gu"] .eyebrow,[lang="hi"] th,[lang="gu"] th,[lang="hi"] .sectionhead h2,[lang="gu"] .sectionhead h2,[lang="hi"] .figure span,[lang="gu"] .figure span,[lang="hi"] .parties span,[lang="gu"] .parties span,[lang="hi"] .commercial span,[lang="gu"] .commercial span,[lang="hi"] .note strong,[lang="gu"] .note strong,[lang="hi"] .quotevalue span,[lang="gu"] .quotevalue span{letter-spacing:0;text-transform:none;font-size:11px}
  @media screen{html:has(>body>.document){background:#EEE8DD}body:has(>.document){padding:24px 16px;background:transparent}body>.document{max-width:794px;padding:45px 49px 53px;border-radius:4px;background:#fff;box-shadow:0 1px 2px rgba(24,37,46,.08),0 8px 24px rgba(24,37,46,.08)}}
  @media screen and (max-width:760px){body:has(>.document){padding:12px}body>.document{padding:28px 24px 32px}}
  @media screen and (max-width:480px){body:has(>.document){padding:0}html:has(>body>.document){background:#fff}body>.document{padding:20px 16px 24px;border-radius:0;box-shadow:none}body>.document .figure{padding:10px}body>.document .figure strong{font-size:16px}body>.document th,body>.document td{padding-left:6px;padding-right:6px}body>.document th{letter-spacing:.04em}body>.document th.num{white-space:normal}body>.document td{font-size:11px}}
`

/**
 * Returns the styled body used by jsPDF.html(). The old export extracted only
 * the body and silently dropped the stylesheet from <head>, producing the raw,
 * unformatted PDF that prompted this redesign.
 */
export function extractStyledCostingBody(html: string) {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n')
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  // The PDF renders this fragment without <html>, so the document language rides on the root.
  const language = html.match(/<html[^>]*\blang="([a-z]{2})"/i)?.[1]
  return `<style>${styles}</style><div class="costing-pdf-root"${language ? ` lang="${language}"` : ''}>${body}</div>`
}

const LOGO_DISPLAY_WIDTH = 100
const FOOTER_LOGO_WIDTH = 52

/**
 * Solid segments, not a hard-stop gradient: html2canvas paints the gradient
 * black in the PDF, so only the on-screen preview would ever show the colours.
 */
const TOP_BAR = '<div class="brandbar"><i class="navy"></i><i class="saffron"></i></div>'

type MastheadInput = {
  businessName: string
  docType: string
  metaTitle: string
  meta?: Array<[string, string]>
  metaNote?: string
  branding: DocumentBranding | null
  labels: DocumentLabels
}

/**
 * Free documents lead with the Weavly mark and the typed business name. With
 * custom branding the factory leads: its logo in a fixed box, its name,
 * address, GSTIN and phone, and Weavly moves to a small footer line.
 */
function masthead(input: MastheadInput) {
  const meta = (input.meta ?? []).map(([label, value]) => `<div class="mrow"><span class="ml">${escapeHtml(label)}</span><span class="mv">${escapeHtml(value)}</span></div>`).join('')
  const docmeta = `<div class="docmeta"><strong>${escapeHtml(input.metaTitle)}</strong>${meta}${input.metaNote ? `<p>${escapeHtml(input.metaNote)}</p>` : ''}</div>`
  if (!input.branding) {
    const logo = `<img class="logo" src="${WEAVLY_LOGO_DATA_URI}" width="${LOGO_DISPLAY_WIDTH}" height="${Math.round(LOGO_DISPLAY_WIDTH * WEAVLY_LOGO_HEIGHT / WEAVLY_LOGO_WIDTH)}" alt="Weavly">`
    const issuer = `<div class="issuer">${input.businessName ? `<div class="issuername">${escapeHtml(input.businessName)}</div>` : ''}<div class="doctype">${escapeHtml(input.docType)}</div></div>`
    return `<header class="masthead"><div class="brand">${logo}${issuer}</div>${docmeta}</header>`
  }
  const { logo, profile } = input.branding
  const box = logo ? fitLogoInBox(logo) : null
  const logoMarkup = logo && box && isEmbeddableLogo(logo.src)
    ? `<img class="factorylogo" src="${logo.src}" width="${box.width}" height="${box.height}" alt="${escapeHtml(input.businessName || 'Logo')}">`
    : ''
  const contact = [
    profile.gstin ? `${input.labels.gstin}: ${profile.gstin}` : '',
    profile.phone ? `${input.labels.phone}: ${profile.phone}` : '',
    profile.email ? `${input.labels.email}: ${profile.email}` : '',
  ].filter(Boolean).join('  ·  ')
  const issuer = `<div class="issuer${logoMarkup ? ' withlogo' : ''}">${input.businessName ? `<div class="issuername">${escapeHtml(input.businessName)}</div>` : ''}${profile.address ? `<div class="issuerline">${escapeHtml(profile.address)}</div>` : ''}${contact ? `<div class="issuerline">${escapeHtml(contact)}</div>` : ''}<div class="doctype">${escapeHtml(input.docType)}</div></div>`
  return `<header class="masthead branded"><div class="brand">${logoMarkup}${issuer}</div>${docmeta}</header>`
}

/** Only a PNG data URI resolved by the server is embedded; never a URL. */
function isEmbeddableLogo(src: string) {
  return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(src)
}

function titleBlock(quality: string, aside: string, labels: DocumentLabels) {
  return `<section class="titleblock"><div><div class="eyebrow">${escapeHtml(labels.fabricQuality)}</div><h1>${escapeHtml(quality)}</h1></div>${aside ? `<div class="titleaside">${aside}</div>` : ''}</section>`
}

function footer(left: string, right: string) {
  return `<footer class="footer"><span>${left}</span><span>${escapeHtml(right)}</span></footer>`
}

const GENERATED_BY = 'Generated by <strong>Weavly Cost Estimate</strong>'

function poweredByWeavly(labels: DocumentLabels) {
  const mark = `<img src="${WEAVLY_LOGO_DATA_URI}" width="${FOOTER_LOGO_WIDTH}" height="${Math.round(FOOTER_LOGO_WIDTH * WEAVLY_LOGO_HEIGHT / WEAVLY_LOGO_WIDTH)}" alt="Weavly">`
  const [before, after] = labels.poweredBy.split('{brand}')
  return `<span class="poweredby">${escapeHtml(before ?? '').trim() ? `<span>${escapeHtml((before ?? '').trim())}</span>` : ''}${mark}${escapeHtml((after ?? '').trim()) ? `<span>${escapeHtml((after ?? '').trim())}</span>` : ''}</span>`
}

function fabricSpecBlock(spec: FabricSpec, labels: DocumentLabels) {
  const yarns = (rows: FabricSpec['warp'], amount: (value: number) => string) => rows
    .map(row => [row.count, row.amount ? amount(row.amount) : ''].filter(Boolean).join(' · '))
    .filter(Boolean)
    .join('\n')
  const number = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 })
  type Cell = { label: string; value: string; wide?: boolean }
  const cells: Cell[] = []
  if (spec.widthInches) cells.push({ label: labels.width, value: `${number(spec.widthInches)}" (${number(spec.widthCm ?? 0)} cm)` })
  if (spec.endsPerInch) cells.push({ label: labels.endsPerInch, value: number(spec.endsPerInch) })
  if (spec.picksPerInch) cells.push({ label: labels.picksPerInch, value: number(spec.picksPerInch) })
  if (spec.totalEnds) cells.push({ label: labels.totalEnds, value: number(spec.totalEnds) })
  if (spec.warp.length) cells.push({ label: labels.warp, value: yarns(spec.warp, value => fillLabel(labels.endsCount, { n: number(value) })), wide: true })
  if (spec.weft.length) cells.push({ label: labels.weft, value: yarns(spec.weft, value => fillLabel(labels.ppiCount, { n: number(value) })), wide: true })
  if (!cells.length) return ''
  return `<section class="section"><div class="sectionhead"><h2>${escapeHtml(labels.fabricSpecification)}</h2></div><div class="spec">${cells.map(cell => `<div${cell.wide ? ' class="wide"' : ''}><span>${escapeHtml(cell.label)}</span><strong class="noteline">${escapeHtml(cell.value)}</strong></div>`).join('')}</div></section>`
}

export function buildCostingPrintHtml(model: CostingExportModel, rawOptions: CostingExportOptions) {
  const options = normalizeCostingExportOptions(rawOptions)
  const L = documentLabels(options.language)
  const branding = options.branding ?? null
  const isInternal = options.mode === 'internal'
  const docType = isInternal ? L.internalCostSheet : L.customerQuotation
  const businessName = options.businessName.trim()
  const customer = options.customerName.trim()
  const footerLeft = branding ? poweredByWeavly(L) : GENERATED_BY
  const head = (title: string) => `<!doctype html>
<html lang="${options.language ?? 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>`
  if (model.reconciliationStatus === 'unreconstructable') {
    return `${head(`${model.qualityLabel} — ${L.reviewRequired.toLowerCase()}`)}
<main class="document">
  ${TOP_BAR}
  ${masthead({ businessName, docType, metaTitle: L.reviewRequired, metaNote: L.reviewRequiredNote, branding, labels: L })}
  ${titleBlock(model.qualityLabel, customer ? `${escapeHtml(L.preparedFor)}<b>${escapeHtml(customer)}</b>` : escapeHtml(L.historicalRecord), L)}
  <section class="note"><strong>${escapeHtml(L.financialValuesNotShown)}</strong>${escapeHtml(L.financialValuesNotShownBody)}</section>
  ${footer(footerLeft, L.customerExportBlocked)}
</main></body></html>`
  }
  const state = model.state
  const totals = model.totals
  const parsedCreatedAt = new Date(model.createdAt)
  const date = Number.isFinite(parsedCreatedAt.getTime()) ? formatTimestampDate(parsedCreatedAt, DOCUMENT_DATE_FORMAT) : L.notSpecified
  const validUntil = options.validUntil ? formatDateOnly(options.validUntil, DOCUMENT_DATE_FORMAT) : L.notSpecified
  const notes = options.notes.trim()
  const quantity = model.quantityM > 0 ? `${model.quantityM.toLocaleString('en-IN')} m` : L.notSpecified
  const reference = options.documentReference?.trim() || ''
  const customerDisclaimer = options.showGstNote
    ? `${L.gstNote} ${L.notTaxInvoice}`
    : L.notTaxInvoice
  const hasMatchingLayerDetails = Number.isFinite(totals.totalProductionCostPerM)
    && Math.abs(totals.totalProductionCostPerM - model.result.productionCostPerM) <= 0.01
  const yarnCostItems: [string, number][] = hasMatchingLayerDetails
    ? [
        [L.baseWarpYarn, totals.yarnBaseWarpPerM],
        [L.baseWeftYarn, totals.yarnBaseWeftPerM],
        [L.yarnWastage, totals.yarnShortageCostPerM],
      ]
    : [
        [L.warpSaved, model.result.breakdown.warpCostPerM],
        [L.weftSaved, model.result.breakdown.weftCostPerM],
      ]

  const costItems = [
    ...yarnCostItems,
    [L.machineWeaving, model.result.breakdown.weaveCostPerM],
    [L.warpingSizing, model.result.breakdown.warpingAndSizingPerM],
    ...(model.result.breakdown.windingPerM > 0 ? [[L.winding, model.result.breakdown.windingPerM] as [string, number]] : []),
    ...(model.result.breakdown.processingPerM > 0 ? [[L.processing, model.result.breakdown.processingPerM] as [string, number]] : []),
    ...(model.result.breakdown.finishingPerM > 0 ? [[L.finishing, model.result.breakdown.finishingPerM] as [string, number]] : []),
    [L.factoryExpenses, model.result.breakdown.overheadPerM],
  ] as [string, number][]

  const costRows = costItems.map(([label, value]) => {
    const sharePct = model.productionCostPerM > 0 ? finiteOrZero(value) / model.productionCostPerM * 100 : 0
    const barWidth = Math.min(100, Math.max(0, sharePct))
    return tableRow([
      label,
      raw(`<div class="share"><i class="bar"><b style="width:${decimal(barWidth, 1)}%"></b></i><span>${decimal(sharePct, 1)}%</span></div>`),
      `${money(value)}/m`,
    ], 1)
  }).join('') + tableRow([L.productionCost, '100.0%', `${money(model.productionCostPerM)}/m`], 1, 'total')

  const layerLabel = (label: string | undefined, index: number) => label || fillLabel(L.layer, { n: index + 1 })
  const layerRows = hasMatchingLayerDetails
    ? [
        ...totals.warpRows.map((row, index) => tableRow([
          L.warp, layerLabel(row.label, index), `${decimal(row.baseKgPer100mUsed, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.baseCostPerMeter)}/m`,
        ], 2)),
        ...totals.weftRows.map((row, index) => tableRow([
          L.weft, layerLabel(row.label, index), `${decimal(row.baseKgPer100mUsed, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.baseCostPerMeter)}/m`,
        ], 2)),
      ].join('')
    : tableRow([L.historicalYarnDetails, L.unavailable, L.reenterAndSave, '—', '—'], 2)

  const internalFigures = [
    figure(L.productionCost, `${money(model.productionCostPerM)}/m`),
    figure(L.suggestedSellingPrice, `${money(model.suggestedSellingPricePerM)}/m`, 'accent'),
    figure(L.breakEvenPrice, `${money(model.breakEvenPricePerM)}/m`),
    figure(L.estimatedMargin, `${decimal(model.marginPct, 1)}%`, model.marginPct < 0 ? 'negative' : 'positive'),
    figure(L.orderQuantity, quantity),
    model.expectedProfit != null
      ? figure(model.expectedProfit < 0 ? L.expectedLoss : L.expectedProfit, money(Math.abs(model.expectedProfit), 0), model.expectedProfit < 0 ? 'negative' : 'positive')
      : figure(model.expectedProfitPerM < 0 ? L.lossPerM : L.profitPerM, `${money(Math.abs(model.expectedProfitPerM))}/m`, model.expectedProfitPerM < 0 ? 'negative' : 'positive'),
  ].join('')

  const internalBody = `
  <section class="summary">${internalFigures}</section>
  <section class="section"><div class="sectionhead"><h2>${escapeHtml(L.costBreakdown)}</h2><span>${escapeHtml(L.perMetreFinished)}</span></div>
    <table><thead>${tableHead([L.costComponent, L.share, L.costPerM], 1)}</thead><tbody>${costRows}</tbody></table>
  </section>
  <section class="section"><div class="sectionhead"><h2>${escapeHtml(L.baseYarnCalculation)}</h2><span>${escapeHtml(hasMatchingLayerDetails ? L.wastageShownSeparately : L.detailedHistoricalUnavailable)}</span></div>
    <table><thead>${tableHead([L.use, L.yarnLayer, L.baseKg, L.rate, L.baseCostPerM], 2)}</thead><tbody>${layerRows}</tbody></table>
  </section>
  <section class="section"><div class="sectionhead"><h2>${escapeHtml(L.commercialAssumptions)}</h2></div>
    <div class="commercial"><div><span>${escapeHtml(L.brokerCommission)}</span><strong>${decimal(model.result.commissionPct, 1)}%</strong></div><div><span>${escapeHtml(L.transportCharge)}</span><strong>${money(model.result.transportPerM)}/m</strong></div><div><span>${escapeHtml(L.standardMonthlyProduction)}</span><strong>${finiteOrZero(state.monthlyOutputM).toLocaleString('en-IN')} m</strong></div><div><span>${escapeHtml(L.targetMargin)}</span><strong>${decimal(model.result.targetMarginPct, 1)}%</strong></div></div>
  </section>
  ${notes ? `<section class="note"><strong>${escapeHtml(L.internalNotes)}</strong><div class="noteline">${escapeHtml(notes)}</div></section>` : ''}`

  const quotationValue = model.result.totalOrderValue != null ? money(model.result.totalOrderValue, 2) : L.onConfirmation
  const termLines = notes.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  // With branding the masthead already names the issuer.
  const parties = [
    businessName && !branding ? [L.issuedBy, businessName] : null,
    [L.preparedFor, customer || L.toBeConfirmed],
    [L.validUntil, validUntil],
  ].filter((party): party is string[] => party !== null)
  const spec = options.showFabricSpec ? buildFabricSpec(state) : null
  const bankDetails = branding?.profile.bankDetails.trim() ?? ''

  const customerBody = `
  <section class="parties">${parties.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</section>
  <section class="section">
    <table><thead>${tableHead([L.description, L.orderQuantity, L.quotedPrice, L.amount], 1)}</thead><tbody>${tableRow([
      raw(`<div class="desc"><strong>${escapeHtml(model.qualityLabel)}</strong><small>${escapeHtml(L.pricedPerMetre)}</small></div>`),
      quantity,
      `${money(model.suggestedSellingPricePerM)}/m`,
      quotationValue,
    ], 1)}</tbody></table>
    <div class="quotevalue"><span>${escapeHtml(L.quotationValue)}</span><strong>${escapeHtml(quotationValue)}</strong></div>
  </section>
  ${spec ? fabricSpecBlock(spec, L) : ''}
  ${termLines.length ? `<section class="note"><strong>${escapeHtml(L.notesTerms)}</strong>${termLines.map((line, index) => `<div class="term"><span class="n">${index + 1}.</span><p>${escapeHtml(line)}</p></div>`).join('')}</section>` : ''}
  ${bankDetails ? `<section class="note"><strong>${escapeHtml(L.bankDetails)}</strong><div class="noteline">${escapeHtml(bankDetails)}</div></section>` : ''}
  <p class="gst">${escapeHtml(customerDisclaimer)}</p>
  <section class="signoff"><div><strong>${escapeHtml(L.authorisedSignatory)}</strong>${businessName ? escapeHtml(fillLabel(L.forBusiness, { name: businessName })) : escapeHtml(L.nameAndSignature)}</div><div><strong>${escapeHtml(L.customerAcceptance)}</strong>${escapeHtml(L.nameSignatureDate)}</div></section>`

  const metaRows: Array<[string, string]> = [
    ...(reference ? [[L.reference, reference] as [string, string]] : []),
    [L.prepared, date],
  ]
  const titleAside = isInternal
    ? (customer ? `${escapeHtml(L.preparedFor)}<b>${escapeHtml(customer)}</b>` : `<span class="tag">${escapeHtml(L.confidential)}</span>`)
    : ''

  return `${head(model.qualityLabel)}
<main class="document">
  ${TOP_BAR}
  ${masthead({ businessName, docType, metaTitle: isInternal ? L.costingSnapshot : L.quotation, meta: metaRows, branding, labels: L })}
  ${titleBlock(model.qualityLabel, titleAside, L)}
  ${isInternal ? internalBody : customerBody}
  ${footer(footerLeft, isInternal ? L.historicalRetain : L.thankYou)}
</main></body></html>`
}
