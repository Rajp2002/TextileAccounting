/* eslint-disable -- harness fixture data for previewing the stock, dispatch, Rate Book and Saved Costings redesigns. */
// Dates are relative to now, so "this week" and the trend lines always have data.
const at = (daysAgo: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString() }
const day = (daysAgo: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toLocaleDateString('en-CA') }

export function fabricBoard() {
  const qualities = [
    { id: 'q1', quality_label: 'D.345', quality_key: 'd.345', meters: 860, production_meters: 1155, opening_recorded: true },
    { id: 'q2', quality_label: 'Demo - Signature Polyester', quality_key: 'demo - signature polyester', meters: 818, production_meters: 592, opening_recorded: true },
  ]
  const label: Record<string, string> = { q1: 'D.345', q2: 'Demo - Signature Polyester' }
  const rows: [string, string, string, number, number, string, string][] = [
    ['f1', 'q1', 'production', 125, 860, 'Production updated', at(1, 18, 40)],
    ['f2', 'q2', 'production', 100, 818, 'Production updated', at(2, 19, 5)],
    ['f3', 'q1', 'dispatch', -295, 735, 'Dispatch DC000000000002', at(3, 11, 20)],
    ['f4', 'q2', 'correction', -18, 718, 'Counted after rewinding', at(4, 17, 15)],
    ['f5', 'q1', 'production', 210, 1030, 'Production updated', at(5, 18, 50)],
    ['f6', 'q2', 'production', 156, 736, 'Production updated', at(6, 19, 10)],
    ['f7', 'q1', 'production', 320, 820, 'Production updated', at(7, 19, 0)],
    ['f8', 'q2', 'production', 180, 580, 'Production updated', at(8, 19, 0)],
    ['f9', 'q1', 'opening', 500, 500, 'Counted on first day', at(20, 19, 44)],
    ['f10', 'q2', 'opening', 400, 400, 'Counted on first day', at(20, 19, 44)],
  ]
  const activity = rows.map(([id, quality_id, kind, meters_delta, balance_after, reason, created_at]) => ({ id, quality_id, kind, meters_delta, balance_after, reason, source_table: null, source_id: null, created_at }))
  const movements = activity.map(row => ({ ...row, quality_label: label[row.quality_id], created_by: null, production_before: null, production_after: null }))
  return { qualities, total_meters: 1678, movements, nextCursor: null, cutover: null, activity }
}

export function challans() {
  const base = { selling_rate: 25, adjustment_amount: 0, version: 1, archived_at: null, payment_terms: '' }
  return [
    { ...base, id: 'd6', number: 'DC000000000006', quality_id: 'q1', quality_label: 'D.345', document: { date: day(1), customer_name: 'Shree Ambika Fabrics' }, lines: [{ lot: 'L-118', meters: 160 }, { lot: 'L-119', meters: 160 }], sent_meters: 320, chargeable_meters: 320, acknowledged_meters: null, delivery_status: 'sent', difference_status: 'none', paid_amount: 0, balance: 8000, payment_due_date: day(-59), issued_at: at(1, 11, 0), created_at: at(1, 11, 0) },
    { ...base, id: 'd5', number: 'DC000000000005', quality_id: 'q2', quality_label: 'Demo - Signature Polyester', selling_rate: 22.5, document: { date: day(2), customer_name: 'Laxmi Textiles' }, lines: [{ lot: 'L-212', meters: 270 }], sent_meters: 270, chargeable_meters: 270, acknowledged_meters: null, delivery_status: 'sent', difference_status: 'none', paid_amount: 0, balance: 6075, payment_due_date: day(-43), issued_at: at(2, 11, 0), created_at: at(2, 11, 0) },
    { ...base, id: 'd2', number: 'DC000000000002', quality_id: 'q1', quality_label: 'D.345', document: { date: day(3), customer_name: 'amit' }, lines: [{ lot: 'L-101', meters: 150 }, { lot: 'L-102', meters: 145 }], sent_meters: 295, chargeable_meters: 295, acknowledged_meters: 295, delivery_status: 'received', difference_status: 'none', paid_amount: 2625, balance: 4750, payment_due_date: day(-51), payment_terms: '30 days from dispatch', issued_at: at(3, 11, 20), created_at: at(3, 11, 20) },
    { ...base, id: 'd4', number: 'DC000000000004', quality_id: 'q2', quality_label: 'Demo - Signature Polyester', selling_rate: 22.5, document: { date: day(18), customer_name: 'Om Sai Traders' }, lines: [{ lot: 'L-190', meters: 140 }], sent_meters: 140, chargeable_meters: 140, acknowledged_meters: 134, delivery_status: 'received', difference_status: 'review', paid_amount: 0, balance: 3150, payment_due_date: day(12), issued_at: at(18, 11, 0), created_at: at(18, 11, 0) },
  ]
}

export function challanEvents(id: string) {
  if (id !== 'd2') return [{ id: `${id}-e1`, action: 'confirm', payload: { data: {} }, amount: null, reverses_id: null, created_at: at(3, 11, 20), created_by: 'u1' }]
  return [
    { id: 'e1', action: 'confirm', payload: { data: {} }, amount: null, reverses_id: null, created_at: at(3, 11, 20), created_by: 'u1' },
    { id: 'e2', action: 'receipt', payload: { data: { meters: 295 } }, amount: null, reverses_id: null, created_at: at(2, 10, 2), created_by: 'u1' },
    { id: 'e3', action: 'payment', payload: { data: { date: day(1), method: 'Bank transfer' } }, amount: 2625, reverses_id: null, created_at: at(1, 16, 10), created_by: 'u1' },
  ]
}

/** Server-action answers for the showcase; any other action falls back to the harness stub. */
export function installShowcase() {
  ;(window as any).__harnessFixtures = {
    getQualityStockBoard: () => ({ data: fabricBoard() }),
    listChallans: () => ({ data: challans() }),
    getChallan: (id: string) => ({ data: challans().find(c => c.id === id), events: challanEvents(id) }),
    getCostRateUsage: () => ({ data: rateUsage(), conflicts: [] }),
  }
}

// Rate Book and Saved Costings (2026-10-10 redesign): the yarns and qualities of the owner's own test factory.
type Yarn = [name: string, category: 'yarn_warp' | 'yarn_weft', price: number, previous: number | null, effectiveAgo: number, reviewedAgo: number, source: string | null, history: [number, number][]]

export function rateBook(due = false) {
  const yarns: Yarn[] = [
    ['40 span', 'yarn_weft', 115, 107, 5, 5, null, [[40, 107], [5, 115]]],
    ['Demo Polyester Warp 75D', 'yarn_warp', 130, 125, 8, due ? 31 : 8, null, [[35, 125], [8, 130]]],
    ['Demo Polyester Weft 150D', 'yarn_weft', 140, 128, 8, due ? 31 : 1, 'Demo supplier quotation', [[28, 128], [8, 140], [1, 140]]],
    ['jari', 'yarn_warp', 125, 118, 3, 3, null, [[30, 118], [3, 125]]],
    ['mulati', 'yarn_warp', 140, null, 1, 1, null, [[1, 140]]],
    ['test', 'yarn_warp', 145, 145, 5, 5, null, [[20, 145], [5, 145]]],
    ['testing', 'yarn_warp', 145, null, 5, 1, null, [[5, 145]]],
    ['testing', 'yarn_weft', 145, null, 5, 5, null, [[5, 145]]],
    ['Weft yarn 1', 'yarn_weft', 140, null, 3, 1, null, [[3, 140]]],
  ]
  return yarns.map(([name, category, price, previous, effectiveAgo, reviewedAgo, source, history], index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`, name, category, unit: 'per_kg' as const,
    current_value: price, previous_value: previous, effective_date: day(effectiveAgo), last_reviewed_at: day(reviewedAgo),
    review_interval_days: 30, source, notes: null, apply_as_default: false, updated_at: at(reviewedAgo, 10, 0), is_active: true,
    is_reviewed: !(due && name === 'mulati'), discovery_source: source ? null : 'saved_quality', fabric_names: [], saved_quality_count: 0,
    price_points: history.map(([ago, value]) => ({ date: day(ago), value })),
  }))
}

const usage: Record<string, string[]> = {
  'yarn_weft:40 span': ['D.345'], 'yarn_warp:demo polyester warp 75d': ['Demo - Signature Polyester', 'Test'],
  'yarn_weft:demo polyester weft 150d': ['Demo - Signature Polyester'], 'yarn_warp:jari': ['D2.456'],
  'yarn_warp:test': ['Test', 'D2.456', 'Demo - Signature Polyester'], 'yarn_warp:testing': ['D.345'],
  'yarn_weft:testing': ['D2.456'], 'yarn_weft:weft yarn 1': ['Test'],
}

export function rateUsage() {
  return Object.entries(usage).map(([key, fabricNames]) => {
    const [category, normalizedName] = key.split(':')
    return { category, normalizedName, yarnName: normalizedName, fabricNames, savedQualityCount: fabricNames.length, rates: [], discoverySource: 'saved_quality' }
  })
}

export function savedQualities() {
  const recipe = (warp: string[], weft: string[]) => ({ warp_rows: warp.map(label => ({ label })), weft_rows: weft.map(label => ({ label })) })
  return [
    { id: 't1', name: 'Test', updated_at: at(2, 11, 0), is_active: true, ...recipe(['Demo Polyester Warp 75D', 'test'], ['Weft yarn 1']) },
    { id: 't2', name: 'D2.456', updated_at: at(2, 12, 0), is_active: true, ...recipe(['jari', 'test'], ['testing']) },
    { id: 't3', name: 'Demo - Signature Polyester', updated_at: at(2, 13, 0), is_active: true, ...recipe(['Demo Polyester Warp 75D'], ['Demo Polyester Weft 150D']) },
    { id: 't4', name: 'D.345', updated_at: at(3, 11, 0), is_active: true, ...recipe(['testing'], ['40 span']) },
  ]
}

type Costing = [id: string, template: string, quality: string, version: number, cost: number, sell: number, margin: number, metres: number, savedAgo: number, favourite: boolean, mix: [number, number, number, number, number, number]]

export function savedCostings() {
  const rows: Costing[] = [
    ['c-test', 't1', 'Test', 1, 42, 47.04, 10.71, 5000, 2, false, [16.35, 15.45, 5.4, 1.9, 1.2, 1.7]],
    ['c-d2456', 't2', 'D2.456', 1, 38.52, 44.3, 13.05, 8000, 2, false, [15.1, 13.58, 5, 1.74, 1.5, 1.6]],
    ['c-demo-2', 't3', 'Demo - Signature Polyester', 2, 35.22, 41.56, 15.26, 10000, 2, true, [13.84, 12.56, 4.8, 1.62, 0.9, 1.5]],
    ['c-d345', 't4', 'D.345', 1, 33.15, 36.47, 9.1, 6000, 3, false, [12.66, 11.82, 4.6, 1.55, 1.02, 1.5]],
    ['c-demo-1', 't3', 'Demo - Signature Polyester', 1, 33.61, 39.66, 15.25, 10000, 12, false, [13.29, 11.5, 4.8, 1.62, 0.9, 1.5]],
  ]
  return rows.map(([id, template_id, quality_label, version_number, cost, sell, margin, meters, savedAgo, is_favorite, [warp, weft, weave, sizing, processing, overhead]]) => ({
    id, status: 'draft' as const, party_name: null, quality_label, quote_price_per_meter: sell, landed_cost_per_meter: cost,
    intended_margin_percent: Math.round(((sell - cost) / cost) * 100), created_at: at(savedAgo, 11, 0), updated_at: at(savedAgo, 11, 0),
    meters, costing_group_id: template_id, version_number, is_archived: false, is_favorite, record_kind: 'costing' as const, template_id,
    production_cost_per_meter: cost, actual_margin_percent: margin, reconciliation_status: 'verified',
    cost_breakdown: { warpCostPerM: warp, weftCostPerM: weft, weaveCostPerM: weave, warpingAndSizingPerM: sizing, windingPerM: 0, processingPerM: processing, finishingPerM: 0, overheadPerM: overhead },
  }))
}
