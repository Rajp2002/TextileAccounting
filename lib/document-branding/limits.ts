/**
 * Upload and processing limits for factory logos. The browser checks the
 * cheap ones for quick feedback; the server enforces every one of them again.
 *
 * The encoded limit is 4 MiB rather than 5 MiB because a Vercel function
 * rejects request bodies over 4.5 MB before our code runs. Keep it in step
 * with `file_size_limit` in supabase/migrations/20261010190000_document_branding.sql.
 */
export const LOGO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const LOGO_MAX_DIMENSION_PX = 4096
export const LOGO_MAX_PIXELS = 16_000_000
/** Smallest side that still prints legibly at the document header size. */
export const LOGO_MIN_DIMENSION_PX = 32

/** The normalised raster copy is bounded to this longest side. */
export const LOGO_NORMALISED_MAX_SIDE_PX = 1600
/** Tracing input is downscaled to this longest side to bound time and memory. */
export const LOGO_TRACE_MAX_SIDE_PX = 1200
/** The PNG rendered from the approved SVG for PDFs. */
export const LOGO_SVG_RASTER_MAX_SIDE_PX = 1200

export const LOGO_SVG_MAX_BYTES = 750_000
export const LOGO_SVG_MAX_PATHS = 2500
/** Above this mean pixel difference the traced logo is not recommended. */
export const LOGO_SVG_MAX_RECOMMENDED_DIFFERENCE_PCT = 4

export const DOCUMENT_BRANDING_BUCKET = 'document-branding'

export const LOGO_ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type LogoMimeType = (typeof LOGO_ACCEPTED_MIME_TYPES)[number]
