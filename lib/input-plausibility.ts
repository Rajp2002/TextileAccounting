/**
 * Usual ranges for costing inputs at a Surat grey-fabric weaving unit.
 *
 * A value outside its range is still allowed, since special fabrics exist, but
 * the estimator asks the owner whether it is correct and offers the likely typo
 * fix when one fits (711 D → 71 D). Limits that block saving stay in
 * lib/estimator-validation.ts. These ranges drive both the inline question
 * under each field and the save-time "Review unusual values" check, so the two
 * always agree. Zero is never questioned: in the estimator it means "not used".
 */
export type PlausibleRange = {
  /** Lowest usual value. 0 means only values above `high` are questioned. */
  low: number
  high: number
  /** Shown after the number, as the field itself shows it. */
  unit: string
}

export const PLAUSIBLE_RANGES = {
  // Filament yarn is roughly 20–300 D; 2-ply and heavier yarns reach 450 D.
  denier: { low: 20, high: 450, unit: 'D' },
  // Secondary warp layers (border, zari) can carry a few hundred ends.
  beamEnds: { low: 100, high: 20_000, unit: '' },
  picks: { low: 10, high: 150, unit: 'PPI' },
  totalPicks: { low: 20, high: 200, unit: 'PPI' },
  // 30–80 inch finished width.
  widthCm: { low: 76.2, high: 203.2, unit: 'cm' },
  yarnRatePerKg: { low: 50, high: 1_000, unit: '₹/kg' },
  yarnGstPct: { low: 0, high: 18, unit: '%' },
  wastePct: { low: 0, high: 15, unit: '%' },
  crimpPct: { low: 0, high: 15, unit: '%' },
  kgPer100m: { low: 0.2, high: 25, unit: 'kg/100m' },
  paisePerPick: { low: 5, high: 40, unit: 'paise/pick' },
  warpingRatePerKg: { low: 1, high: 30, unit: '₹/kg' },
  sizingRatePerKg: { low: 2, high: 40, unit: '₹/kg' },
  windingRatePerKg: { low: 1, high: 20, unit: '₹/kg' },
  processingRatePerM: { low: 0.5, high: 60, unit: '₹/m' },
  finishingRatePerM: { low: 0.5, high: 30, unit: '₹/m' },
  overheadPerM: { low: 1, high: 50, unit: '₹/m' },
  transportPerM: { low: 0.1, high: 10, unit: '₹/m' },
  commissionPct: { low: 0, high: 5, unit: '%' },
  marginPct: { low: 0, high: 30, unit: '%' },
  outputPerLoomPerDay: { low: 0, high: 500, unit: 'm' },
} as const satisfies Record<string, PlausibleRange>

export type PlausibilityRule = keyof typeof PLAUSIBLE_RANGES

/**
 * Estimator number fields (`data-estimator-field`) and the range each one uses.
 * Width and the weaving rate have their own inputs and name their rule there.
 */
const RULE_BY_ESTIMATOR_FIELD: Record<string, PlausibilityRule> = {
  calcDenier: 'denier',
  beamEnds: 'beamEnds',
  picks: 'picks',
  weftTotalPicks: 'totalPicks',
  yarnRate: 'yarnRatePerKg',
  gstPct: 'yarnGstPct',
  shortagePct: 'wastePct',
  yarnShortagePct: 'wastePct',
  crimpPct: 'crimpPct',
  warpCrimpPct: 'crimpPct',
  manualKgPer100m: 'kgPer100m',
  warpingRatePerKg: 'warpingRatePerKg',
  sizingRatePerKg: 'sizingRatePerKg',
  windingRatePerKg: 'windingRatePerKg',
  processingRatePerM: 'processingRatePerM',
  finishingRatePerM: 'finishingRatePerM',
  overheadOverridePerM: 'overheadPerM',
  transportPerM: 'transportPerM',
  commissionPct: 'commissionPct',
  profitPct: 'marginPct',
  avgOutputPerLoomPerDay: 'outputPerLoomPerDay',
}

export function plausibilityRuleForField(fieldKey: string | undefined): PlausibilityRule | undefined {
  return fieldKey ? RULE_BY_ESTIMATOR_FIELD[fieldKey] : undefined
}

export type PlausibilityCheck = {
  rule: PlausibilityRule
  value: number
  direction: 'low' | 'high'
  range: PlausibleRange
  /** The likely intended value, when a common typo explains the entry. */
  suggestion: number | null
}

function isWithin(value: number, range: PlausibleRange) {
  return value >= range.low && value <= range.high
}

/** Null when the value is usual, blank or zero. */
export function checkPlausibility(rule: PlausibilityRule, value: number | null | undefined): PlausibilityCheck | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null
  const range = PLAUSIBLE_RANGES[rule]
  if (isWithin(value, range)) return null
  return {
    rule,
    value,
    direction: value < range.low ? 'low' : 'high',
    range,
    suggestion: suggestTypoFix(value, candidate => isWithin(candidate, range)),
  }
}

/**
 * The same question in the unit a field shows, such as a width typed in
 * inches or a weaving rate typed in ₹/m. `perUnit` is how many checked units
 * make one shown unit (2.54 cm per inch).
 */
export function convertPlausibilityCheck(check: PlausibilityCheck, perUnit: number, unit: string): PlausibilityCheck {
  const range = { low: check.range.low / perUnit, high: check.range.high / perUnit, unit }
  const value = check.value / perUnit
  return { ...check, value, range, suggestion: suggestTypoFix(value, candidate => isWithin(candidate, range)) }
}

function plainNumberText(value: number) {
  return String(Number(value.toFixed(6)))
}

/**
 * The value the owner most likely meant, or null when no common typo fits or
 * two fixes are equally likely. A doubled keystroke (711 → 71) counts most, a
 * slipped decimal point (7.5 → 75) less, and a fix both explain wins: 1100 is
 * 110 (doubled 0, or one digit too many), not 100. Only a candidate inside
 * the usual range is offered, so the fix never trades one odd value for another.
 */
export function suggestTypoFix(value: number, fits: (candidate: number) => boolean): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const text = plainNumberText(value)
  const scores = new Map<number, number>()
  const consider = (candidate: number, weight: number) => {
    const rounded = Number(candidate.toFixed(6))
    if (rounded <= 0 || rounded === value || !fits(rounded)) return
    scores.set(rounded, (scores.get(rounded) ?? 0) + weight)
  }
  for (let index = 1; index < text.length; index += 1) {
    if (text[index] === text[index - 1] && /\d/.test(text[index])) {
      consider(Number(text.slice(0, index) + text.slice(index + 1)), 2)
    }
  }
  consider(value / 10, 1)
  consider(value * 10, 1)
  let best: number | null = null
  let bestScore = 0
  let tied = false
  scores.forEach((score, candidate) => {
    if (score > bestScore) {
      best = candidate
      bestScore = score
      tied = false
    } else if (score === bestScore) {
      tied = true
    }
  })
  return tied ? null : best
}

/**
 * Identifies one confirmed answer: "711 D is correct" covers that value for
 * that kind of field, wherever it appears in the costing.
 */
export function plausibilityConfirmationKey(rule: PlausibilityRule, value: number) {
  return `${rule}:${plainNumberText(value)}`
}

export function formatPlausibleNumber(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function withUnit(text: string, unit: string) {
  if (!unit) return text
  if (unit === '%') return `${text}%`
  // Money reads as ₹1,000/kg, not 1,000 ₹/kg.
  if (unit.startsWith('₹')) return `₹${text}${unit.slice(1)}`
  return `${text} ${unit}`
}

export function formatPlausibleValue(value: number, unit: string) {
  return withUnit(formatPlausibleNumber(value), unit)
}

/** "20–450 D", or "up to 15%" for a range that only has a ceiling. */
export function formatPlausibleRange(range: PlausibleRange) {
  if (range.low <= 0) return `up to ${formatPlausibleValue(range.high, range.unit)}`
  return withUnit(`${formatPlausibleNumber(range.low)}–${formatPlausibleNumber(range.high)}`, range.unit)
}
