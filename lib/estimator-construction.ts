// The warp and weft "construction" text on a costing is never typed: it is
// the owner's yarn component names, in order, so the saved quality, quote and
// PDF always say what the rows below actually cost.

interface NamedRow {
  label?: string | null
}

interface PickedRow extends NamedRow {
  picks?: number | null
}

function componentNames(rows: readonly NamedRow[]): string {
  return rows
    .map(row => row.label?.trim())
    .filter(Boolean)
    .join(' + ')
}

export function warpConstructionText(rows: readonly NamedRow[]): string {
  return componentNames(rows)
}

export function weftConstructionText(rows: readonly PickedRow[]): string {
  const names = componentNames(rows)
  const totalPicks = rows.reduce((sum, row) => sum + (row.picks || 0), 0)

  if (names && totalPicks > 0) return `${names} - ${totalPicks} Picks`
  if (names) return names
  if (totalPicks > 0) return `${totalPicks} Picks`
  return ''
}
