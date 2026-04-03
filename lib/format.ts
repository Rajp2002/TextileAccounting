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

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short'
  })
}
