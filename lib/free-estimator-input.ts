import { z } from 'zod'
import { getEffectiveYarnDenier, getEffectiveCostingWidthCm, type EstimateState } from './estimator'
import { requiresFactoryCapacity, validateEstimatorSnapshot } from './estimator-validation'

const num = z.number().finite().min(0).max(1_000_000_000)
const nullable = num.nullable()
const yarn = {
  id: z.string().max(80), label: z.string().max(120).optional(),
  calculationMode: z.enum(['formula','manual']).optional(), manualKgPer100m: nullable.optional(),
  linearDensityUnit: z.enum(['denier','cotton_count_ne']).optional(), cottonCountNe: nullable.optional(),
  calcDenier: num, yarnRate: num, gstPct: num, shortagePct: nullable,
}
export const freeEstimateSchema = z.object({
  warpRows: z.array(z.object({ ...yarn, beamEnds: num }).strict()).min(1).max(20),
  weftRows: z.array(z.object({ ...yarn, picks: num, reedSpace: num, effectiveCostingWidthCm: nullable.optional() }).strict()).min(1).max(20),
  tapeLengthM: num, perPickCostPaisa: num, warpingRatePerKg: num, sizingRatePerKg: num,
  windingRatePerKg: num, processingRatePerM: num, finishingRatePerM: num,
  yarnShortagePct: num, warpCrimpPct: num,
  overheadItems: z.array(z.object({
    id: z.string().max(80), category: z.enum(['rent','electricity','spares_repairs','oil_lubricants','drawing_denting','bank_interest','depreciation','water','security','admin','custom']),
    label: z.string().max(120), monthlyAmount: num, isPreset: z.boolean(), isLocked: z.literal(false), source: z.literal('manual'),
  }).strict()).max(100),
  monthlyOutputM: num, overheadOverridePerM: nullable, overheadMode: z.enum(['direct','monthly_expenses']),
  loomCount: num, avgOutputPerLoomPerDay: num, monthlyWorkingDays: num,
  loomType: z.enum(['water_jet','rapier','air_jet','jacquard_electronic','jacquard_mechanical','projectile','dobby','other']).nullable(),
  loomRpm: nullable, loomPowerKw: nullable, loomRpmIsCustomised: z.boolean(), loomPowerKwIsCustomised: z.boolean(), hoursPerShift: nullable,
  warpingMode: z.enum(['in_house','outsourced']), sizingMode: z.enum(['in_house','outsourced']), overheadPct: num,
  commissionPct: num, transportPerM: num, profitPct: num, orderQuantityM: nullable,
  enabledSections: z.object({ winding:z.boolean(), processing:z.boolean(), finishing:z.boolean(), commission:z.boolean(), transport:z.boolean() }).strict(),
  isConfigured: z.boolean(),
}).strict()

export function parseFreeEstimate(input: unknown): EstimateState {
  const parsed = freeEstimateSchema.safeParse(input)
  if (!parsed.success) throw new Error('FREE_INVALID_INPUT')
  const state = parsed.data as EstimateState
  const validation = validateEstimatorSnapshot(state, { requireTapeLength:false, requireCapacity:requiresFactoryCapacity(state) })
  if (!validation.valid) throw new Error('FREE_INVALID_INPUT')
  return state
}

/** Representation-only changes (row ids, labels, density units) do not buy or cost a calculation. */
export function canonicalFreeInputs(state: EstimateState) {
  return {
    ...state, isConfigured:false, overheadPct:0, loomRpmIsCustomised:false, loomPowerKwIsCustomised:false,
    warpRows:state.warpRows.map((row,index) => ({ ...row, id:`warp-${index}`, label:'', calculationMode:row.calculationMode??'formula', manualKgPer100m:row.manualKgPer100m??null, calcDenier:getEffectiveYarnDenier(row), linearDensityUnit:'denier', cottonCountNe:null })),
    weftRows:state.weftRows.map((row,index) => ({ ...row, id:`weft-${index}`, label:'', calculationMode:row.calculationMode??'formula', manualKgPer100m:row.manualKgPer100m??null, calcDenier:getEffectiveYarnDenier(row), linearDensityUnit:'denier', cottonCountNe:null, reedSpace:getEffectiveCostingWidthCm(row), effectiveCostingWidthCm:null })),
    overheadItems:state.overheadItems.map((item,index) => ({ ...item, id:`expense-${index}`, label:'', isPreset:false })),
  }
}
