import { getEffectiveCostingWidthCm, type EstimateState } from './estimator'

/**
 * Row labels are left out on purpose: weavers often name a row after the
 * supplier or yarn lot, which the customer file must never show.
 */
export type FabricSpecYarn = {
  /** "75D" or "40s Ne"; empty when the row was entered as a manual weight. */
  count: string
  /** Ends for a warp row, picks per inch for a weft row. */
  amount: number | null
}

/**
 * The construction a buyer reads on a grey-fabric quotation, taken from the
 * saved costing inputs: width, ends and picks, and each warp and weft yarn.
 * It only reads inputs; no cost is calculated here.
 */
export type FabricSpec = {
  widthInches: number | null
  widthCm: number | null
  totalEnds: number | null
  endsPerInch: number | null
  /** Sum of every weft row's picks: each row holds that yarn's own picks. */
  picksPerInch: number | null
  warp: FabricSpecYarn[]
  weft: FabricSpecYarn[]
}

const positive = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function yarnCount(row: { linearDensityUnit?: string; cottonCountNe?: number | null; calcDenier?: number; calculationMode?: string }) {
  if (row.calculationMode === 'manual') return ''
  if (row.linearDensityUnit === 'cotton_count_ne') {
    const count = positive(row.cottonCountNe)
    return count ? `${trimNumber(count)}s Ne` : ''
  }
  const denier = positive(row.calcDenier)
  return denier ? `${trimNumber(denier)}D` : ''
}

function trimNumber(value: number, digits = 1) {
  return Number(value.toFixed(digits)).toString()
}

export function buildFabricSpec(state: Pick<EstimateState, 'warpRows' | 'weftRows'> | null | undefined): FabricSpec | null {
  const warpRows = Array.isArray(state?.warpRows) ? state.warpRows : []
  const weftRows = Array.isArray(state?.weftRows) ? state.weftRows : []

  const widthCm = weftRows.map(row => positive(getEffectiveCostingWidthCm(row))).find(Boolean) ?? null
  const widthInches = widthCm ? widthCm / 2.54 : null
  const ends = warpRows.map(row => positive(row.beamEnds)).filter((value): value is number => value !== null)
  const totalEnds = ends.length ? ends.reduce((sum, value) => sum + value, 0) : null
  const picks = weftRows.map(row => positive(row.picks)).filter((value): value is number => value !== null)
  const picksPerInch = picks.length ? picks.reduce((sum, value) => sum + value, 0) : null

  const warp = warpRows
    .map(row => ({ count: yarnCount(row), amount: positive(row.beamEnds) }))
    .filter(yarn => yarn.count || yarn.amount)
  const weft = weftRows
    .map(row => ({ count: yarnCount(row), amount: positive(row.picks) }))
    .filter(yarn => yarn.count || yarn.amount)

  if (!widthCm && !totalEnds && !picksPerInch && !warp.length && !weft.length) return null
  return {
    widthInches: widthInches ? Math.round(widthInches * 10) / 10 : null,
    widthCm: widthCm ? Math.round(widthCm * 10) / 10 : null,
    totalEnds,
    endsPerInch: totalEnds && widthInches ? Math.round(totalEnds / widthInches * 10) / 10 : null,
    picksPerInch: picksPerInch ? Math.round(picksPerInch * 10) / 10 : null,
    warp,
    weft,
  }
}
