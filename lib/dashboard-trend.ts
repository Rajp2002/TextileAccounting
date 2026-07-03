import { subDays, parseISO } from 'date-fns'
import { formatToSurat } from './time'

export type ProductionLogTrendRow = {
  date: string
  meters: number | string | null
}

export type DailyMeterTrendPoint = {
  date: string
  total_meters: number
}

export function getSevenDayTrendWindow(anchorDate: string): string[] {
  const parsedAnchor = parseISO(anchorDate)
  return Array.from({ length: 7 }, (_, i) =>
    formatToSurat(subDays(parsedAnchor, 6 - i), 'yyyy-MM-dd')
  )
}

export function aggregateDailyMeterTrend(
  dates: string[],
  rawLogs: ProductionLogTrendRow[] | null | undefined
): DailyMeterTrendPoint[] {
  const trendMap = new Map<string, number>()
  dates.forEach((date) => trendMap.set(date, 0))

  for (const row of rawLogs ?? []) {
    if (!trendMap.has(row.date)) continue
    trendMap.set(row.date, (trendMap.get(row.date) ?? 0) + Number(row.meters ?? 0))
  }

  return dates.map((date) => ({
    date,
    total_meters: trendMap.get(date) ?? 0,
  }))
}
