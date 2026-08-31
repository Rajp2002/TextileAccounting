/** Validation paths are data identifiers, never translated field labels. */
export function getEstimatorFieldTarget(field: string) {
  const row = /^(warpRows|weftRows)(?:\.(\d+)|\[(\d+)\])(?:\.(\w+))?$/i.exec(field)
  const canonicalField = (value: string) => {
    switch (value.toLowerCase()) {
      case 'effectivedenier':
      case 'cottoncountne': return 'calcDenier'
      case 'quality_label':
      case 'fabricqualityname': return 'qualityLabel'
      default: return value
    }
  }
  if (row) {
    return {
      row: `${row[1].toLowerCase() === 'warprows' ? 'warpRows' : 'weftRows'}.${Number(row[2] ?? row[3])}`,
      field: row[4] ? canonicalField(row[4]) : null,
    }
  }
  return { row: null, field: canonicalField(field) }
}
