import { LOGO_MAX_DIMENSION_PX, LOGO_SVG_MAX_BYTES, LOGO_SVG_MAX_PATHS } from './limits'

export type SvgValidationErrorCode =
  | 'svg_empty'
  | 'svg_too_large'
  | 'svg_malformed'
  | 'svg_disallowed_content'
  | 'svg_bad_dimensions'
  | 'svg_too_complex'
  | 'svg_no_shapes'

export type SanitizedLogoSvg = {
  svg: string
  width: number
  height: number
  pathCount: number
  bytes: number
}

/**
 * Parses VTracer's output against the small grammar it produces and rebuilds
 * the SVG from the parsed values only. Anything outside that grammar (scripts,
 * event handlers, links, external references, foreignObject, styles,
 * entities, CDATA) is rejected rather than stripped, so a candidate logo is
 * either exactly the expected shape list or nothing.
 *
 * Accepted input:
 *   optional `<?xml …?>` declaration and `<!-- … -->` comments
 *   one `<svg version xmlns width height [viewBox]>` root
 *   `<path d fill [transform="translate(x,y)"]/>` children
 */
export function sanitizeTracedSvg(input: string):
  | { ok: true; value: SanitizedLogoSvg }
  | { ok: false; code: SvgValidationErrorCode } {
  if (typeof input !== 'string' || !input.trim()) return { ok: false, code: 'svg_empty' }
  if (input.length > LOGO_SVG_MAX_BYTES * 2) return { ok: false, code: 'svg_too_large' }

  let rest = input.trim()
  rest = rest.replace(/^<\?xml\s+version="1\.0"(?:\s+encoding="UTF-8")?\s*\?>\s*/i, '')
  // Comments carry only the generator name; drop them, but never one that
  // could hide markup (no '<' or '>' inside).
  while (rest.startsWith('<!--')) {
    const end = rest.indexOf('-->')
    if (end < 0) return { ok: false, code: 'svg_malformed' }
    const body = rest.slice(4, end)
    if (/[<>]/.test(body)) return { ok: false, code: 'svg_disallowed_content' }
    rest = rest.slice(end + 3).trimStart()
  }
  if (/<!|<\?|&|\]\]>/.test(rest)) return { ok: false, code: 'svg_disallowed_content' }

  const root = /^<svg((?:\s+[a-zA-Z:-]+="[^"<>]*")*)\s*>/.exec(rest)
  if (!root) return { ok: false, code: 'svg_malformed' }
  const rootAttributes = parseAttributes(root[1])
  if (!rootAttributes) return { ok: false, code: 'svg_malformed' }
  for (const name of Object.keys(rootAttributes)) {
    if (!['version', 'xmlns', 'width', 'height', 'viewBox'].includes(name)) return { ok: false, code: 'svg_disallowed_content' }
  }
  if (rootAttributes.xmlns !== 'http://www.w3.org/2000/svg') return { ok: false, code: 'svg_malformed' }
  if (rootAttributes.version !== undefined && rootAttributes.version !== '1.1') return { ok: false, code: 'svg_malformed' }

  const width = parseDimension(rootAttributes.width)
  const height = parseDimension(rootAttributes.height)
  if (!width || !height) return { ok: false, code: 'svg_bad_dimensions' }
  if (rootAttributes.viewBox !== undefined && rootAttributes.viewBox.trim() !== `0 0 ${width} ${height}`) {
    return { ok: false, code: 'svg_bad_dimensions' }
  }

  rest = rest.slice(root[0].length)
  const paths: string[] = []
  const pathPattern = /^\s*<path((?:\s+[a-zA-Z:-]+="[^"<>]*")*)\s*\/>/
  for (;;) {
    const match = pathPattern.exec(rest)
    if (!match) break
    const attributes = parseAttributes(match[1])
    if (!attributes) return { ok: false, code: 'svg_malformed' }
    const path = rebuildPath(attributes)
    if (path === 'disallowed') return { ok: false, code: 'svg_disallowed_content' }
    if (path === 'malformed') return { ok: false, code: 'svg_malformed' }
    paths.push(path)
    if (paths.length > LOGO_SVG_MAX_PATHS) return { ok: false, code: 'svg_too_complex' }
    rest = rest.slice(match[0].length)
  }
  if (!/^\s*<\/svg>\s*$/.test(rest)) {
    return { ok: false, code: /<[a-zA-Z]/.test(rest) ? 'svg_disallowed_content' : 'svg_malformed' }
  }
  if (paths.length === 0) return { ok: false, code: 'svg_no_shapes' }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join('')}</svg>`
  const bytes = new TextEncoder().encode(svg).length
  if (bytes > LOGO_SVG_MAX_BYTES) return { ok: false, code: 'svg_too_large' }
  return { ok: true, value: { svg, width, height, pathCount: paths.length, bytes } }
}

function parseAttributes(source: string): Record<string, string> | null {
  const attributes: Record<string, string> = {}
  const pattern = /\s+([a-zA-Z:-]+)="([^"<>]*)"/g
  let consumed = 0
  for (const match of source.matchAll(pattern)) {
    if (match.index !== consumed) return null
    const name = match[1]
    if (Object.prototype.hasOwnProperty.call(attributes, name)) return null
    attributes[name] = match[2]
    consumed += match[0].length
  }
  return consumed === source.length ? attributes : null
}

function parseDimension(value: string | undefined) {
  if (!value || !/^\d{1,4}(?:\.\d+)?$/.test(value)) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0 || number > LOGO_MAX_DIMENSION_PX) return null
  return Number.isInteger(number) ? number : Math.round(number * 100) / 100
}

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,eE+\-\s]+$/
const NUMBER = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'
const TRANSLATE = new RegExp(`^translate\\(\\s*(${NUMBER})\\s*[, ]\\s*(${NUMBER})\\s*\\)$`)

function rebuildPath(attributes: Record<string, string>): string | 'disallowed' | 'malformed' {
  for (const name of Object.keys(attributes)) {
    if (!['d', 'fill', 'transform'].includes(name)) return 'disallowed'
  }
  const d = attributes.d?.trim()
  if (!d || d.length > LOGO_SVG_MAX_BYTES || !PATH_DATA.test(d) || !/^[Mm]/.test(d)) return 'malformed'
  const fill = attributes.fill?.trim()
  if (!fill || !/^#[0-9a-fA-F]{6}$/.test(fill)) return 'malformed'
  let transform = ''
  if (attributes.transform !== undefined) {
    const translate = TRANSLATE.exec(attributes.transform.trim())
    if (!translate) return 'disallowed'
    transform = ` transform="translate(${Number(translate[1])},${Number(translate[2])})"`
  }
  return `<path d="${d.replace(/\s+/g, ' ')}" fill="${fill.toUpperCase()}"${transform}/>`
}
