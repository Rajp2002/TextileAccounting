/**
 * Normalize the Surat-cluster signup format to the stored 10-digit number.
 *
 * Formatting characters are accepted, but arbitrary letters, extra digits,
 * and leading-zero variants are rejected instead of being silently truncated.
 */
export function normalizeIndianPhone(value: string): string {
  const raw = String(value ?? '').trim()
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return ''

  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 10 ? digits : digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : ''
  return /^[6-9]\d{9}$/.test(local) ? local : ''
}

export function isValidIndianPhone(value: string): boolean {
  return normalizeIndianPhone(value).length === 10
}
