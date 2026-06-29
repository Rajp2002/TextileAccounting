export function formatMeters(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(1)}k m`
  return `${n.toLocaleString('en-IN')} m`
}

export function formatRupees(n: number | null): string | null {
  if (n === null || n === 0) return null
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000)   return `₹${(n / 1000).toFixed(1)}k`
  return `₹${n.toLocaleString('en-IN')}`
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function dateOnlyToLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (![year, month, day].every(Number.isInteger)) return null

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  const localDate = dateOnlyToLocalDate(value)
  const date = localDate ?? new Date(value)
  return date.toLocaleDateString('en-IN', options)
}

export function formatDate(dateStr: string): string {
  return formatDateOnly(dateStr)
}
