/**
 * The factory logo sits in a fixed header box so it can never push the
 * document's content around. The documents are laid out 700px wide for a
 * 184.5mm A4 text block (about 3.8px per mm), so the 45mm x 18mm box from the
 * branding plan is 170 x 68 px.
 */
export const DOCUMENT_LOGO_BOX = { width: 170, height: 68 } as const

/**
 * Fit a logo inside a box without stretching or cropping (CSS `contain`).
 * Wide wordmarks fill the width, square and tall marks fill the height.
 */
export function fitLogoInBox(
  logo: { width: number; height: number },
  box: { width: number; height: number } = DOCUMENT_LOGO_BOX,
) {
  const width = Number(logo.width)
  const height = Number(logo.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: box.width, height: box.height }
  }
  const scale = Math.min(box.width / width, box.height / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
