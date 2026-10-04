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

function metric(label: string, value: string, tone: 'default' | 'accent' | 'positive' | 'negative' = 'default') {
  return `<div class="metric metric-${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function tableRow(cells: string[], className = '') {
  return `<tr${className ? ` class="${className}"` : ''}>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
}

const PRINT_STYLES = `
  @page{size:A4;margin:13mm 14mm 14mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body,.costing-pdf-root{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:10px;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .document{width:100%;max-width:100%;margin:0 auto}
  .brandbar{height:6px;background:linear-gradient(90deg,#1d4ed8 0 78%,#f97316 78% 100%);margin-bottom:18px}
  .masthead{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:1px solid #dbe3ef}
  .brand{display:flex;align-items:center;gap:10px}.brandmark{display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:8px;background:#1d4ed8;color:#fff;font-size:17px;font-weight:800}.brandname{font-size:17px;font-weight:800;letter-spacing:-.02em;color:#0f172a}.doctype{margin-top:2px;color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.13em;font-weight:700}
  .docmeta{text-align:right;color:#64748b}.docmeta strong{display:block;color:#0f172a;font-size:11px;margin-bottom:3px}.docmeta span{display:block}
  .titleblock{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:17px 0 14px}.eyebrow{margin-bottom:4px;color:#1d4ed8;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.14em}.titleblock h1{margin:0;color:#0f172a;font-size:23px;line-height:1.15;letter-spacing:-.035em}.titleaside{text-align:right;color:#64748b;white-space:nowrap}.titleaside b{color:#334155}
  .summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:17px}.metric{min-height:58px;padding:10px 11px;border:1px solid #dbe3ef;border-radius:8px;background:#f8fafc}.metric span{display:block;color:#64748b;font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.metric strong{display:block;margin-top:5px;color:#0f172a;font-size:15px;line-height:1.15;letter-spacing:-.02em;white-space:nowrap}.metric-accent{border-color:#fed7aa;background:#fff7ed}.metric-accent strong{color:#c2410c}.metric-positive{border-color:#bbf7d0;background:#f0fdf4}.metric-positive strong{color:#15803d}.metric-negative{border-color:#fecaca;background:#fef2f2}.metric-negative strong{color:#b91c1c}
  .section{margin-top:15px;break-inside:avoid;page-break-inside:avoid}.sectionhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.sectionhead h2{margin:0;color:#0f172a;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.sectionhead span{color:#94a3b8;font-size:8px}
  table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dbe3ef;border-radius:7px;overflow:hidden}th{padding:6px 8px;background:#eef3f9;color:#475569;font-size:7.5px;text-align:left;text-transform:uppercase;letter-spacing:.06em}th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}td{padding:6px 8px;border-top:1px solid #e7edf5;color:#334155}tbody tr:first-child td{border-top:0}tbody tr:nth-child(even):not(.total) td{background:#fbfdff}.total td{border-top:1.5px solid #94a3b8;background:#eff6ff;color:#0f172a;font-weight:800}.label-main{font-weight:700;color:#172033}
  .commercial{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #dbe3ef;border-radius:7px;overflow:hidden}.commercial div{padding:8px 10px;border-left:1px solid #e7edf5}.commercial div:first-child{border-left:0}.commercial span{display:block;color:#64748b;font-size:7.5px;text-transform:uppercase;letter-spacing:.06em}.commercial strong{display:block;margin-top:3px;color:#172033;font-size:11px}
  .note{margin-top:15px;padding:10px 12px;border-left:3px solid #f97316;background:#fff7ed;color:#475569;white-space:pre-wrap}.note strong{display:block;margin-bottom:3px;color:#9a3412;font-size:8px;text-transform:uppercase;letter-spacing:.08em}
  .quote-details{display:grid;grid-template-columns:repeat(3,1fr);margin:2px 0 17px;border:1px solid #dbe3ef;border-radius:8px;overflow:hidden}.quote-details div{padding:11px 12px}.quote-details div+div{border-left:1px solid #e7edf5}.quote-details span{display:block;color:#64748b;font-size:7.5px;text-transform:uppercase;letter-spacing:.07em}.quote-details strong{display:block;margin-top:3px;color:#172033;font-size:11px}
  .footer{display:flex;justify-content:space-between;gap:24px;margin-top:18px;padding-top:9px;border-top:1px solid #dbe3ef;color:#94a3b8;font-size:7.5px}.footer strong{color:#64748b}.gst{margin:14px 0 0;color:#64748b;font-size:8.5px}
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

export function buildCostingPrintHtml(model: CostingExportModel, rawOptions: CostingExportOptions) {
  const options = normalizeCostingExportOptions(rawOptions)
  const isInternal = options.mode === 'internal'
  if (model.reconciliationStatus === 'unreconstructable') {
    const businessName = options.businessName.trim() || 'Weavly Cost Estimate'
    const customer = options.customerName.trim()
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(model.qualityLabel)} — review required</title><style>${PRINT_STYLES}</style></head><body>
<main class="document">
  <div class="brandbar"></div>
  <header class="masthead"><div class="brand"><div class="brandmark">W</div><div><div class="brandname">${escapeHtml(businessName)}</div><div class="doctype">${isInternal ? 'Internal Cost Sheet' : 'Customer Quotation'}</div></div></div><div class="docmeta"><strong>Review required</strong><span>Prepared from an incomplete historical snapshot</span></div></header>
  <section class="titleblock"><div><div class="eyebrow">Fabric quality</div><h1>${escapeHtml(model.qualityLabel)}</h1></div><div class="titleaside">${customer ? `Prepared for<br><b>${escapeHtml(customer)}</b>` : 'Historical record'}</div></section>
  <section class="note"><strong>Financial values not shown</strong>This historical costing is missing one or more saved assumptions. Re-enter or confirm the costing in Cost Estimate and save a new snapshot before using it as a customer quotation.</section>
  <footer class="footer"><span>Generated by <strong>Weavly Cost Estimate</strong></span><span>Customer export is blocked until the costing is reconciled.</span></footer>
</main></body></html>`
  }
  const state = model.state
  const totals = model.totals
  const parsedCreatedAt = new Date(model.createdAt)
  const date = Number.isFinite(parsedCreatedAt.getTime()) ? parsedCreatedAt.toLocaleDateString('en-IN') : 'Not specified'
  const parsedValidUntil = options.validUntil ? new Date(`${options.validUntil}T00:00:00`) : null
  const validUntil = parsedValidUntil && Number.isFinite(parsedValidUntil.getTime())
    ? parsedValidUntil.toLocaleDateString('en-IN')
    : 'Not specified'
  const customer = options.customerName.trim()
  const notes = options.notes.trim()
  const businessName = options.businessName.trim() || 'Weavly Cost Estimate'
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

  const costRows = costItems.map(([label, value]) => tableRow([
    label,
    model.productionCostPerM > 0 ? `${decimal(finiteOrZero(value) / model.productionCostPerM * 100, 1)}%` : '0.0%',
    `${money(value)}/m`,
  ])).join('') + tableRow(['Production cost', '100.0%', `${money(model.productionCostPerM)}/m`], 'total')

  const layerRows = hasMatchingLayerDetails
    ? [
        ...totals.warpRows.map((row, index) => tableRow([
          'Warp', row.label || `Layer ${index + 1}`, `${decimal(row.baseKgPer100mUsed, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.baseCostPerMeter)}/m`,
        ])),
        ...totals.weftRows.map((row, index) => tableRow([
          'Weft', row.label || `Layer ${index + 1}`, `${decimal(row.baseKgPer100mUsed, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.baseCostPerMeter)}/m`,
        ])),
      ].join('')
    : tableRow(['Historical yarn details', 'Unavailable', 'Re-enter and save this costing', '—', '—'])

  const summary = isInternal
    ? [
        metric('Production cost', `${money(model.productionCostPerM)}/m`),
        metric('Suggested selling price', `${money(model.suggestedSellingPricePerM)}/m`, 'accent'),
        metric('Break-even price', `${money(model.breakEvenPricePerM)}/m`),
        metric('Estimated margin at this price', `${decimal(model.marginPct, 1)}%`, model.marginPct < 0 ? 'negative' : 'positive'),
        metric('Order quantity', quantity),
        model.expectedProfit != null
          ? metric(model.expectedProfit < 0 ? 'Expected loss' : 'Expected profit', money(Math.abs(model.expectedProfit), 0), model.expectedProfit < 0 ? 'negative' : 'positive')
          : metric(model.expectedProfitPerM < 0 ? 'Loss / m' : 'Profit / m', `${money(Math.abs(model.expectedProfitPerM))}/m`, model.expectedProfitPerM < 0 ? 'negative' : 'positive'),
      ].join('')
    : [
        metric('Quoted price', `${money(model.suggestedSellingPricePerM)}/m`, 'accent'),
        metric('Order quantity', quantity),
        metric('Quotation value', model.result.totalOrderValue != null ? money(model.result.totalOrderValue, 2) : 'On confirmation'),
      ].join('')

  const internalSections = `
    <section class="section"><div class="sectionhead"><h2>Cost breakdown</h2><span>Per metre of finished fabric</span></div>
      <table><thead><tr><th>Cost component</th><th class="num">Share</th><th class="num">Cost / m</th></tr></thead><tbody>${costRows}</tbody></table>
    </section>
    <section class="section"><div class="sectionhead"><h2>Base yarn calculation</h2><span>${hasMatchingLayerDetails ? 'Wastage is shown separately in the cost breakdown above' : 'Detailed historical values unavailable'}</span></div>
      <table><thead><tr><th>Use</th><th>Yarn / layer</th><th class="num">Base kg / 100m</th><th class="num">Rate</th><th class="num">Base cost / m</th></tr></thead><tbody>${layerRows}</tbody></table>
    </section>
    <section class="section"><div class="sectionhead"><h2>Commercial assumptions</h2></div>
      <div class="commercial"><div><span>Broker commission</span><strong>${decimal(model.result.commissionPct, 1)}%</strong></div><div><span>Transport charge</span><strong>${money(model.result.transportPerM)}/m</strong></div><div><span>Standard monthly production</span><strong>${finiteOrZero(state.monthlyOutputM).toLocaleString('en-IN')} m</strong></div><div><span>Target margin</span><strong>${decimal(model.result.targetMarginPct, 1)}%</strong></div></div>
    </section>`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(model.qualityLabel)}</title><style>${PRINT_STYLES}</style></head><body>
<main class="document">
  <div class="brandbar"></div>
  <header class="masthead"><div class="brand"><div class="brandmark">W</div><div><div class="brandname">${escapeHtml(businessName)}</div><div class="doctype">${isInternal ? 'Internal Cost Sheet' : 'Customer Quotation'}</div></div></div><div class="docmeta"><strong>${isInternal ? 'Costing snapshot' : 'Quotation'}</strong>${reference ? `<span>Reference ${escapeHtml(reference)}</span>` : ''}<span>Prepared ${escapeHtml(date)}</span>${!isInternal ? `<span>Valid until ${escapeHtml(validUntil)}</span>` : ''}</div></header>
  <section class="titleblock"><div><div class="eyebrow">Fabric quality</div><h1>${escapeHtml(model.qualityLabel)}</h1></div><div class="titleaside">${customer ? `Prepared for<br><b>${escapeHtml(customer)}</b>` : isInternal ? 'Confidential - internal use only' : 'Prepared for your review'}</div></section>
  ${!isInternal ? `<section class="quote-details"><div><span>Customer</span><strong>${escapeHtml(customer || 'To be confirmed')}</strong></div><div><span>Reference</span><strong>${escapeHtml(reference || 'Document only')}</strong></div><div><span>Validity</span><strong>Until ${escapeHtml(validUntil)}</strong></div></section>` : ''}
  <section class="summary">${summary}</section>
  ${isInternal ? internalSections : ''}
  ${notes ? `<section class="note"><strong>${isInternal ? 'Internal notes' : 'Notes & terms'}</strong>${escapeHtml(notes)}</section>` : ''}
  ${!isInternal ? `<p class="gst">${escapeHtml(customerDisclaimer)}</p>` : ''}
  <footer class="footer"><span>Generated by <strong>Weavly Cost Estimate</strong></span><span>${isInternal ? 'Historical costings retain their saved assumptions.' : 'Thank you for the opportunity to quote.'}</span></footer>
</main></body></html>`
}
