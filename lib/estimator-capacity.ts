/**
 * Estimate loom output in metres/day.
 * rpm / PPI produces inches/minute, hence the inches-per-metre divisor.
 */
export function calcDailyOutputM(
  rpm: number | null,
  picks: number,
  hoursPerShift: number | null,
  efficiencyPct: number
): number | null {
  const hours = hoursPerShift ?? 12
  if (!rpm || !picks || !hours || rpm <= 0 || picks <= 0) return null
  return ((rpm / picks) * 60 * hours * (efficiencyPct / 100)) / 39.37007874015748
}
