import { getEffectiveYarnDenier, getEffectiveCostingWidthCm, type EstimateState } from './estimator'

// Kept apart from free-estimator-input.ts so the browser meter can compare
// inputs without bundling that file's zod schema.

/** Representation-only changes (row ids, labels, density units) do not buy or cost a calculation. */
export function canonicalFreeInputs(state: EstimateState) {
  return {
    ...state, isConfigured:false, overheadPct:0, loomRpmIsCustomised:false, loomPowerKwIsCustomised:false,
    warpRows:state.warpRows.map((row,index) => ({ ...row, id:`warp-${index}`, label:'', calculationMode:row.calculationMode??'formula', manualKgPer100m:row.manualKgPer100m??null, calcDenier:getEffectiveYarnDenier(row), linearDensityUnit:'denier', cottonCountNe:null })),
    weftRows:state.weftRows.map((row,index) => ({ ...row, id:`weft-${index}`, label:'', calculationMode:row.calculationMode??'formula', manualKgPer100m:row.manualKgPer100m??null, calcDenier:getEffectiveYarnDenier(row), linearDensityUnit:'denier', cottonCountNe:null, reedSpace:getEffectiveCostingWidthCm(row), effectiveCostingWidthCm:null })),
    overheadItems:state.overheadItems.map((item,index) => ({ ...item, id:`expense-${index}`, label:'', isPreset:false })),
  }
}
