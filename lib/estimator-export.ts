import type { EstimateState, EstimatorV3Totals } from './estimator'

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

export function calculateBreakEvenPricePerM(productionCostPerM: number, transportPerM: number, commissionPct: number) {
  const safeProductionCostPerM = finiteOrZero(productionCostPerM)
  const safeTransportPerM = finiteOrZero(transportPerM)
  const safeCommissionPct = finiteOrZero(commissionPct)
  const denominator = 1 - safeCommissionPct / 100
  if (!Number.isFinite(denominator) || denominator <= 0) return 0
  return (safeProductionCostPerM + safeTransportPerM) / denominator
}

export function createCostingExportModel(input: {
  qualityLabel: string
  createdAt?: string
  state: EstimateState
  totals: EstimatorV3Totals
  suggestedSellingPricePerM?: number
  landedCostPerM?: number
  marginPct?: number
}): CostingExportModel {
  const quantityM = finiteOrZero(input.state.orderQuantityM)
  const rawProductionCostPerM = finiteNumber(input.totals.totalProductionCostPerM)
  const productionCostPerM = rawProductionCostPerM ?? 0
  const rawSuggestedSellingPricePerM = input.suggestedSellingPricePerM ?? input.totals.orderQuote?.quotePricePerM ?? 0
  const suggestedSellingPricePerM = finiteNumber(rawSuggestedSellingPricePerM) ?? 0
  const hasSafeCommercialInputs = rawProductionCostPerM !== null
    && finiteNumber(rawSuggestedSellingPricePerM) !== null
  const calculatedLandedCostPerM = hasSafeCommercialInputs
    ? finiteOrZero(
        input.totals.orderQuote?.landedCostPerM
          ?? (
            productionCostPerM
            + finiteOrZero(input.state.transportPerM)
            + suggestedSellingPricePerM * finiteOrZero(input.state.commissionPct) / 100
          ),
      )
    : 0
  const landedCostPerM = finiteNumber(input.landedCostPerM) ?? calculatedLandedCostPerM
  const expectedProfitPerM = suggestedSellingPricePerM - landedCostPerM
  return {
    qualityLabel: input.qualityLabel.trim() || 'Untitled Costing',
    createdAt: input.createdAt ?? new Date().toISOString(),
    quantityM,
    productionCostPerM,
    suggestedSellingPricePerM,
    breakEvenPricePerM: calculateBreakEvenPricePerM(
      productionCostPerM,
      input.state.transportPerM,
      input.state.commissionPct,
    ),
    landedCostPerM,
    marginPct: finiteNumber(input.marginPct) ?? finiteOrZero(input.totals.orderQuote?.actualMarginPct ?? input.state.profitPct),
    expectedProfit: quantityM > 0 ? expectedProfitPerM * quantityM : null,
    expectedProfitPerM,
    state: input.state,
    totals: input.totals,
  }
}

export function validateCostingExportInput(model: CostingExportModel | null, options: CostingExportOptions) {
  if (!model) return ['The costing result is not ready yet.']

  const errors: string[] = []
  if (!model.qualityLabel.trim()) errors.push('Quality is required before generating a document.')
  if (!Number.isFinite(model.productionCostPerM) || model.productionCostPerM <= 0) errors.push('Production cost is not valid. Review the costing before exporting.')
  if (!Number.isFinite(model.suggestedSellingPricePerM) || model.suggestedSellingPricePerM <= 0) errors.push('Selling price per metre is not valid. Review the commercial assumptions before exporting.')

  if (options.mode === 'customer') {
    if (!options.customerName.trim()) errors.push('Enter the party or customer name before creating a quotation.')
    if (!Number.isFinite(model.quantityM) || model.quantityM <= 0) errors.push('Enter an order quantity before creating a Customer Quotation.')
    const hasValidUntil = /^\d{4}-\d{2}-\d{2}$/.test(options.validUntil)
      && Number.isFinite(Date.parse(`${options.validUntil}T00:00:00Z`))
    if ((!options.validUntil && !options.allowMissingValidUntil) || (options.validUntil && !hasValidUntil)) {
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

export function getCostingExportFilename(model: CostingExportModel, options: CostingExportOptions) {
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

export function buildQuotationShareMessage(model: CostingExportModel, options: CostingExportOptions) {
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

export function buildCostingPrintHtml(model: CostingExportModel, options: CostingExportOptions) {
  const isInternal = options.mode === 'internal'
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

  const costItems = [
    ['Warp yarn', totals.warpCostPerM],
    ['Weft yarn', totals.weftCostPerM],
    ['Machine weaving', totals.weaveCostPerM],
    ['Warping + sizing', totals.warpingAndSizingPerM],
    ...(totals.windingPerM > 0 ? [['Winding', totals.windingPerM] as [string, number]] : []),
    ...(totals.processingPerM > 0 ? [['Processing', totals.processingPerM] as [string, number]] : []),
    ...(totals.finishingPerM > 0 ? [['Finishing', totals.finishingPerM] as [string, number]] : []),
    ['Factory overhead', totals.overheadPerM],
  ] as [string, number][]

  const costRows = costItems.map(([label, value]) => tableRow([
    label,
    model.productionCostPerM > 0 ? `${decimal(finiteOrZero(value) / model.productionCostPerM * 100, 1)}%` : '0.0%',
    `${money(value)}/m`,
  ])).join('') + tableRow(['Production cost', '100.0%', `${money(model.productionCostPerM)}/m`], 'total')

  const layerRows = [
    ...totals.warpRows.map((row, index) => tableRow([
      'Warp', row.label || `Layer ${index + 1}`, `${decimal(row.finalKgPer100m, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.costPerMeter)}/m`,
    ])),
    ...totals.weftRows.map((row, index) => tableRow([
      'Weft', row.label || `Layer ${index + 1}`, `${decimal(row.finalKgPer100m, 3)} kg`, `${money(row.ratePerKg, 0)}/kg`, `${money(row.costPerMeter)}/m`,
    ])),
  ].join('')

  const summary = isInternal
    ? [
        metric('Production cost', `${money(model.productionCostPerM)}/m`),
        metric('Suggested selling price', `${money(model.suggestedSellingPricePerM)}/m`, 'accent'),
        metric('Break-even price', `${money(model.breakEvenPricePerM)}/m`),
        metric('Margin', `${decimal(model.marginPct, 1)}%`, model.marginPct < 0 ? 'negative' : 'positive'),
        metric('Order quantity', quantity),
        model.expectedProfit != null
          ? metric(model.expectedProfit < 0 ? 'Expected loss' : 'Expected profit', money(Math.abs(model.expectedProfit), 0), model.expectedProfit < 0 ? 'negative' : 'positive')
          : metric(model.expectedProfitPerM < 0 ? 'Loss / m' : 'Profit / m', `${money(Math.abs(model.expectedProfitPerM))}/m`, model.expectedProfitPerM < 0 ? 'negative' : 'positive'),
      ].join('')
    : [
        metric('Quoted price', `${money(model.suggestedSellingPricePerM)}/m`, 'accent'),
        metric('Order quantity', quantity),
        metric('Quotation value', model.quantityM > 0 ? money(model.suggestedSellingPricePerM * model.quantityM, 0) : 'On confirmation'),
      ].join('')

  const internalSections = `
    <section class="section"><div class="sectionhead"><h2>Cost breakdown</h2><span>Per metre of finished fabric</span></div>
      <table><thead><tr><th>Cost component</th><th class="num">Share</th><th class="num">Cost / m</th></tr></thead><tbody>${costRows}</tbody></table>
    </section>
    <section class="section"><div class="sectionhead"><h2>Yarn assumptions</h2><span>Saved with this costing snapshot</span></div>
      <table><thead><tr><th>Use</th><th>Yarn / layer</th><th class="num">Consumption / 100m</th><th class="num">Rate</th><th class="num">Cost / m</th></tr></thead><tbody>${layerRows}</tbody></table>
    </section>
    <section class="section"><div class="sectionhead"><h2>Commercial assumptions</h2></div>
      <div class="commercial"><div><span>Commission</span><strong>${decimal(state.commissionPct, 1)}%</strong></div><div><span>Transport</span><strong>${money(state.transportPerM)}/m</strong></div><div><span>Monthly output</span><strong>${finiteOrZero(state.monthlyOutputM).toLocaleString('en-IN')} m</strong></div><div><span>Target margin</span><strong>${decimal(state.profitPct, 1)}%</strong></div></div>
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
  ${!isInternal && options.showGstNote ? '<p class="gst">GST will be charged as applicable on the final tax invoice. This quotation is not a tax invoice.</p>' : ''}
  <footer class="footer"><span>Generated by <strong>Weavly Cost Estimate</strong></span><span>${isInternal ? 'Historical costings retain their saved assumptions.' : 'Thank you for the opportunity to quote.'}</span></footer>
</main></body></html>`
}
