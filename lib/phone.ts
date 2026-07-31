/** Normalize the Surat-cluster signup format to the stored 10-digit number. */
export function normalizeIndianPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return digits.slice(0, 10)
}
