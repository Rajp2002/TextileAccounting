import { getEffectiveYarnDenier, getEffectiveCostingWidthCm, getWeftPickConvention, type EstimateState, type WeftRow } from './estimator'

// Kept apart from free-estimator-input.ts so the browser meter can compare
// inputs without bundling that file's zod schema.

// A shared-ratio weft is weighed by its ratio, so the ratio is an input, but
// only its proportions: 2:4 and 1:2 cost the same. Typed picks carry none.
function withCanonicalPickRatios(rows: WeftRow[]): WeftRow[] {
  const ratios = rows.map(row => Number(row.pickRatio))
  const max = Math.max(...ratios)
  const shared = rows.length > 1 && getWeftPickConvention(rows) === 'total_ratio' && max > 0
  return rows.map((row, index) => ({ ...row, pickRatio: shared ? ratios[index] / max : null }))
}

/** Representation-only changes (row ids, labels, density units, ratio scale) do not buy or cost a calculation. */
export function canonicalFreeInputs(state: EstimateState) {
  return {
    ...state, isConfigured:false, overheadPct:0, loomRpmIsCustomised:false, loomPowerKwIsCustomised:false,
    warpRows:state.warpRows.map((row,index) => ({ ...row, id:`warp-${index}`, label:'', calculationMode:row.calculationMode??'formula', manualKgPer100m:row.manualKgPer100m??null, calcDenier:getEffectiveYarnDenier(row), linearDensityUnit:'denier', cottonCountNe:null })),
    weftRows:withCanonicalPickRatios(state.weftRows).map((row,index) => ({ ...row, id:`weft-${index}`, label:'', calculationMode:row.calculationMode??'formula', manualKgPer100m:row.manualKgPer100m??null, calcDenier:getEffectiveYarnDenier(row), linearDensityUnit:'denier', cottonCountNe:null, reedSpace:getEffectiveCostingWidthCm(row), effectiveCostingWidthCm:null })),
    overheadItems:state.overheadItems.map((item,index) => ({ ...item, id:`expense-${index}`, label:'', isPreset:false })),
  }
}
