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

/** Call and WhatsApp links for a stored 10-digit mobile; both need the +91 country code. */
export function indianPhoneLinks(value: string | null | undefined): { tel: string; whatsapp: string; display: string } | null {
  const local = normalizeIndianPhone(value ?? '')
  if (!local) return null
  return { tel: `tel:+91${local}`, whatsapp: `https://wa.me/91${local}`, display: `+91 ${local.slice(0, 5)} ${local.slice(5)}` }
}
