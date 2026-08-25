import { SURAT_TIMEZONE } from './time'

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
  // Date-only values are business dates, not UTC instants. Pin them to
  // midnight in Surat so an owner in another device timezone sees the same
  // date that was entered in the factory.
  const datePart = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0]
  const date = datePart ? new Date(`${datePart}T00:00:00+05:30`) : new Date(value)
  return date.toLocaleDateString('en-IN', { ...options, timeZone: SURAT_TIMEZONE })
}

export function formatTimestampDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return new Date(value).toLocaleDateString('en-IN', { ...options, timeZone: SURAT_TIMEZONE })
}

export function formatDate(dateStr: string): string {
  return formatDateOnly(dateStr)
}

export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  },
): string {
  return new Date(value).toLocaleString('en-IN', { ...options, timeZone: SURAT_TIMEZONE })
}
