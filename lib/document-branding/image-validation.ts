import {
  LOGO_MAX_DIMENSION_PX,
  LOGO_MAX_PIXELS,
  LOGO_MAX_UPLOAD_BYTES,
  LOGO_MIN_DIMENSION_PX,
  type LogoMimeType,
} from './limits'

export type LogoValidationErrorCode =
  | 'file_missing'
  | 'file_too_large'
  | 'unsupported_format'
  | 'format_mismatch'
  | 'image_unreadable'
  | 'image_too_small'
  | 'image_too_large'
  | 'image_animated'

/**
 * Identify the image from its bytes, never from the filename or the
 * browser-supplied type: PNG and JPEG by their signatures, WebP by its RIFF
 * container header.
 */
export function sniffLogoMimeType(bytes: Uint8Array): LogoMimeType | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  return null
}

/** Checks that need only the encoded bytes and the browser's claimed type. */
export function validateLogoUpload(bytes: Uint8Array, claimedType?: string | null):
  | { ok: true; mimeType: LogoMimeType }
  | { ok: false; code: LogoValidationErrorCode } {
  if (bytes.length === 0) return { ok: false, code: 'file_missing' }
  if (bytes.length > LOGO_MAX_UPLOAD_BYTES) return { ok: false, code: 'file_too_large' }
  const mimeType = sniffLogoMimeType(bytes)
  if (!mimeType) return { ok: false, code: 'unsupported_format' }
  // A file named logo.png that is really a JPEG is still rejected: the claim
  // and the content must agree when the browser makes one.
  const claimed = (claimedType ?? '').trim().toLowerCase()
  if (claimed && claimed !== mimeType && !(claimed === 'image/jpg' && mimeType === 'image/jpeg')) {
    return { ok: false, code: 'format_mismatch' }
  }
  return { ok: true, mimeType }
}

/** Checks on the decoded image, from sharp's metadata. */
export function validateLogoDimensions(metadata: { width?: number; height?: number; pages?: number }):
  | { ok: true; width: number; height: number }
  | { ok: false; code: LogoValidationErrorCode } {
  const width = Number(metadata.width)
  const height = Number(metadata.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ok: false, code: 'image_unreadable' }
  }
  if ((metadata.pages ?? 1) > 1) return { ok: false, code: 'image_animated' }
  if (width > LOGO_MAX_DIMENSION_PX || height > LOGO_MAX_DIMENSION_PX || width * height > LOGO_MAX_PIXELS) {
    return { ok: false, code: 'image_too_large' }
  }
  if (Math.max(width, height) < LOGO_MIN_DIMENSION_PX) return { ok: false, code: 'image_too_small' }
  return { ok: true, width, height }
}
