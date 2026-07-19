import type { EstimateState, EstimatorV3Totals } from './estimator'

export type CostingExportMode = 'internal' | 'customer'

export type CostingExportOptions = {
  mode: CostingExportMode
  businessName: string
  customerName: string
  validUntil: string
  notes: string
  showGstNote: boolean
}

export type CostingExportModel = {
  qualityLabel: string
  createdAt: string
  quantityM: number
  productionCostPerM: number
  suggestedSellingPricePerM: number
  breakEvenPricePerM: number
  marginPct: number
  expectedProfit: number
  state: EstimateState
  totals: EstimatorV3Totals
}

export function calculateBreakEvenPricePerM(productionCostPerM: number, transportPerM: number, commissionPct: number) {
  const denominator = 1 - commissionPct / 100
  if (!Number.isFinite(denominator) || denominator <= 0) return 0
  return (productionCostPerM + transportPerM) / denominator
}

export function createCostingExportModel(input: {
  qualityLabel: string
  createdAt?: string
  state: EstimateState
  totals: EstimatorV3Totals
  suggestedSellingPricePerM?: number
}): CostingExportModel {
  const quantityM = Number(input.state.orderQuantityM ?? 0)
  const suggestedSellingPricePerM = Number(
    input.suggestedSellingPricePerM ?? input.totals.orderQuote?.quotePricePerM ?? 0,
  )
  return {
    qualityLabel: input.qualityLabel.trim() || 'Untitled Costing',
    createdAt: input.createdAt ?? new Date().toISOString(),
    quantityM,
    productionCostPerM: input.totals.totalProductionCostPerM,
    suggestedSellingPricePerM,
    breakEvenPricePerM: calculateBreakEvenPricePerM(
      input.totals.totalProductionCostPerM,
      input.state.transportPerM,
      input.state.commissionPct,
    ),
    marginPct: input.totals.orderQuote?.actualMarginPct ?? input.state.profitPct,
    expectedProfit: input.totals.orderQuote?.grossProfitRupees ?? 0,
    state: input.state,
    totals: input.totals,
  }
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
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function printRow(label: string, value: string, strong = false) {
  return `<tr${strong ? ' class="strong"' : ''}><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
}

export function buildCostingPrintHtml(model: CostingExportModel, options: CostingExportOptions) {
  const isInternal = options.mode === 'internal'
  const state = model.state
  const totals = model.totals
  const date = new Date(model.createdAt).toLocaleDateString('en-IN')
  const validUntil = options.validUntil
    ? new Date(`${options.validUntil}T00:00:00`).toLocaleDateString('en-IN')
    : '—'

  const costRows = [
    printRow('Warp yarn', `${money(totals.warpCostPerM)}/m`),
    printRow('Weft yarn', `${money(totals.weftCostPerM)}/m`),
    printRow('Machine weaving', `${money(totals.weaveCostPerM)}/m`),
    printRow('Warping + sizing', `${money(totals.warpingAndSizingPerM)}/m`),
    totals.windingPerM > 0 ? printRow('Winding', `${money(totals.windingPerM)}/m`) : '',
    totals.processingPerM > 0 ? printRow('Processing', `${money(totals.processingPerM)}/m`) : '',
    totals.finishingPerM > 0 ? printRow('Finishing', `${money(totals.finishingPerM)}/m`) : '',
    printRow('Factory overhead', `${money(totals.overheadPerM)}/m`),
    printRow('Production cost', `${money(model.productionCostPerM)}/m`, true),
  ].join('')

  const layerRows = [
    ...totals.warpRows.map((row, index) => printRow(
      `Warp · ${row.label || `Layer ${index + 1}`}`,
      `${row.finalKgPer100m.toFixed(3)} kg/100m · ${money(row.ratePerKg, 0)}/kg · ${money(row.costPerMeter)}/m`,
    )),
    ...totals.weftRows.map((row, index) => printRow(
      `Weft · ${row.label || `Layer ${index + 1}`}`,
      `${row.finalKgPer100m.toFixed(3)} kg/100m · ${money(row.ratePerKg, 0)}/kg · ${money(row.costPerMeter)}/m`,
    )),
  ].join('')

  const customer = options.customerName.trim()
  const notes = options.notes.trim()
  const businessName = options.businessName.trim() || 'Weavly Cost Estimate'

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(model.qualityLabel)}</title>
<style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18202a;margin:0;font-size:12px;line-height:1.45}
  header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #df6f16;padding-bottom:14px;margin-bottom:20px}h1{font-size:24px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#52606d}
  .muted{color:#6b7280}.meta{text-align:right}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.metric{border:1px solid #dde2e7;padding:12px}.metric span{display:block;color:#6b7280;font-size:10px;text-transform:uppercase}.metric strong{display:block;font-size:18px;margin-top:3px}.accent{color:#d96b1c}.positive{color:#147a45}
  table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #e6e9ed;padding:7px 4px}td:last-child{text-align:right;font-family:monospace}.strong td{font-weight:700;border-top:2px solid #cfd5db}
  .note{margin-top:18px;padding:12px;border:1px solid #e6d4b3;background:#fffaf0;white-space:pre-wrap}.footer{margin-top:24px;border-top:1px solid #dde2e7;padding-top:10px;color:#6b7280;font-size:10px}
</style></head><body>
<header><div><h1>${escapeHtml(businessName)}</h1><div class="muted">${isInternal ? 'Internal Cost Sheet' : 'Customer Quotation'}</div></div><div class="meta"><strong>${escapeHtml(model.qualityLabel)}</strong><br><span class="muted">Prepared ${escapeHtml(date)}</span>${customer ? `<br>Customer: ${escapeHtml(customer)}` : ''}${!isInternal ? `<br>Valid until: ${escapeHtml(validUntil)}` : ''}</div></header>
<section class="summary">
  ${isInternal ? `<div class="metric"><span>Production cost</span><strong>${escapeHtml(money(model.productionCostPerM))}/m</strong></div>` : ''}
  <div class="metric"><span>${isInternal ? 'Suggested selling price' : 'Quoted price'}</span><strong class="accent">${escapeHtml(money(model.suggestedSellingPricePerM))}/m</strong></div>
  ${isInternal ? `<div class="metric"><span>Break-even price</span><strong>${escapeHtml(money(model.breakEvenPricePerM))}/m</strong></div><div class="metric"><span>Margin</span><strong class="positive">${model.marginPct.toFixed(1)}%</strong></div>` : ''}
  <div class="metric"><span>Quantity</span><strong>${model.quantityM > 0 ? `${model.quantityM.toLocaleString('en-IN')} m` : 'Not specified'}</strong></div>
  ${isInternal ? `<div class="metric"><span>Expected profit</span><strong class="positive">${escapeHtml(money(model.expectedProfit, 0))}</strong></div>` : ''}
</section>
${isInternal ? `<h2>Cost breakdown</h2><table>${costRows}</table><h2>Yarn assumptions</h2><table>${layerRows}</table><h2>Commercial assumptions</h2><table>${printRow('Commission', `${state.commissionPct.toFixed(1)}%`)}${printRow('Transport', `${money(state.transportPerM)}/m`)}${printRow('Monthly output', `${state.monthlyOutputM.toLocaleString('en-IN')} m`)}${printRow('Target margin', `${state.profitPct.toFixed(1)}%`)}</table>` : ''}
${notes ? `<div class="note"><strong>Notes</strong><br>${escapeHtml(notes)}</div>` : ''}
${!isInternal && options.showGstNote ? '<p class="footer">GST will be charged as applicable on the final tax invoice. This quotation is not a tax invoice.</p>' : ''}
<p class="footer">Generated by Weavly Cost Estimate · Historical costings retain the assumptions saved with their snapshot.</p>
</body></html>`
}
