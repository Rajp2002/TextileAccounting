import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { sniffLogoMimeType, validateLogoDimensions, validateLogoUpload } from '@/lib/document-branding/image-validation'
import { sanitizeTracedSvg } from '@/lib/document-branding/svg-sanitize'
import { fitLogoInBox, DOCUMENT_LOGO_BOX } from '@/lib/document-branding/layout'
import { LOGO_MAX_UPLOAD_BYTES } from '@/lib/document-branding/limits'
import { processLogoImage } from '@/lib/document-branding/process-logo.server'
import { traceLogoToSvg, VTRACER_VERSION } from '@/lib/document-branding/vtracer-adapter.server'

const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300"><rect width="1200" height="300" fill="white"/><circle cx="150" cy="150" r="110" fill="#1f4e79"/><rect x="320" y="90" width="780" height="120" rx="20" fill="#c0392b"/></svg>`
const gradient = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><defs><linearGradient id="g"><stop offset="0" stop-color="#f39c12"/><stop offset="1" stop-color="#8e44ad"/></linearGradient></defs><rect width="900" height="400" rx="60" fill="url(#g)"/></svg>`
const emblem = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><circle cx="300" cy="300" r="280" fill="none" stroke="#111111" stroke-width="20"/><rect x="200" y="250" width="200" height="100" fill="#111111"/></svg>`

const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer()

describe('logo upload validation', () => {
  it('identifies PNG, JPEG and WebP from their bytes, not the name', async () => {
    const source = await png(emblem)
    expect(sniffLogoMimeType(source)).toBe('image/png')
    expect(sniffLogoMimeType(await sharp(source).jpeg().toBuffer())).toBe('image/jpeg')
    expect(sniffLogoMimeType(await sharp(source).webp().toBuffer())).toBe('image/webp')
    expect(sniffLogoMimeType(Buffer.from(emblem))).toBeNull()
    expect(sniffLogoMimeType(Buffer.from('GIF89a......'))).toBeNull()
  })

  it('rejects unsupported content, a type that does not match the bytes, empty and oversized files', async () => {
    const source = await png(emblem)
    expect(validateLogoUpload(source, 'image/png')).toEqual({ ok: true, mimeType: 'image/png' })
    expect(validateLogoUpload(source, 'image/jpeg')).toEqual({ ok: false, code: 'format_mismatch' })
    expect(validateLogoUpload(Buffer.from(emblem), 'image/png')).toEqual({ ok: false, code: 'unsupported_format' })
    expect(validateLogoUpload(Buffer.alloc(0), null)).toEqual({ ok: false, code: 'file_missing' })
    expect(validateLogoUpload(Buffer.alloc(LOGO_MAX_UPLOAD_BYTES + 1), 'image/png')).toEqual({ ok: false, code: 'file_too_large' })
    expect(validateLogoUpload(await sharp(source).jpeg().toBuffer(), 'image/jpg')).toEqual({ ok: true, mimeType: 'image/jpeg' })
  })

  it('enforces decoded size, pixel count, animation and a legible minimum', () => {
    expect(validateLogoDimensions({ width: 800, height: 400 })).toEqual({ ok: true, width: 800, height: 400 })
    expect(validateLogoDimensions({ width: 4097, height: 100 })).toEqual({ ok: false, code: 'image_too_large' })
    expect(validateLogoDimensions({ width: 4096, height: 4096 })).toEqual({ ok: false, code: 'image_too_large' })
    expect(validateLogoDimensions({ width: 20, height: 20 })).toEqual({ ok: false, code: 'image_too_small' })
    expect(validateLogoDimensions({ width: 400, height: 400, pages: 3 })).toEqual({ ok: false, code: 'image_animated' })
    expect(validateLogoDimensions({})).toEqual({ ok: false, code: 'image_unreadable' })
  })
})

describe('traced SVG validation', () => {
  const traced = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: visioncortex VTracer 1.0.0-alpha.4 -->\n<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="120" height="40">\n<path d="M0,0C10,0,20,0,30,0Z" fill="#1f4e79"/>\n<path d="M5 5L10 10Z" fill="#C0392B" transform="translate(4,6)"/>\n</svg>\n'

  it('rebuilds the expected shape list with a viewBox', () => {
    const result = sanitizeTracedSvg(traced)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ width: 120, height: 40, pathCount: 2 })
    expect(result.value.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="120" height="40" viewBox="0 0 120 40"><path d="M0,0C10,0,20,0,30,0Z" fill="#1F4E79"/><path d="M5 5L10 10Z" fill="#C0392B" transform="translate(4,6)"/></svg>')
  })

  it.each([
    ['a script', traced.replace('</svg>', '<script>alert(1)</script></svg>'), 'svg_disallowed_content'],
    ['an event handler', traced.replace('fill="#1f4e79"', 'fill="#1f4e79" onclick="x()"'), 'svg_disallowed_content'],
    ['an external reference', traced.replace('<path d="M5', '<image href="https://example.com/a.png"/><path d="M5'), 'svg_disallowed_content'],
    ['a foreignObject', traced.replace('</svg>', '<foreignObject><div/></foreignObject></svg>'), 'svg_disallowed_content'],
    ['a style attribute', traced.replace('fill="#1f4e79"', 'fill="#1f4e79" style="x"'), 'svg_disallowed_content'],
    ['an entity', traced.replace('<svg', '<!DOCTYPE svg [<!ENTITY a "b">]><svg'), 'svg_disallowed_content'],
    ['a url() fill', traced.replace('fill="#1f4e79"', 'fill="url(#g)"'), 'svg_malformed'],
    ['a non-translate transform', traced.replace('translate(4,6)', 'matrix(1,0,0,1,0,0)'), 'svg_disallowed_content'],
    ['unclosed markup', traced.replace('</svg>', ''), 'svg_malformed'],
    ['a wrong namespace', traced.replace('http://www.w3.org/2000/svg', 'http://example.com/svg'), 'svg_malformed'],
    ['zero dimensions', traced.replace('width="120"', 'width="0"'), 'svg_bad_dimensions'],
    ['no shapes', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', 'svg_no_shapes'],
    ['nothing', '', 'svg_empty'],
  ])('rejects %s', (_name, input, code) => {
    expect(sanitizeTracedSvg(input)).toEqual({ ok: false, code })
  })
})

describe('logo box', () => {
  it('keeps the aspect ratio of wide, square and tall logos inside the header box', () => {
    expect(fitLogoInBox({ width: 1200, height: 300 })).toEqual({ width: 170, height: 43 })
    expect(fitLogoInBox({ width: 600, height: 600 })).toEqual({ width: 68, height: 68 })
    expect(fitLogoInBox({ width: 200, height: 800 })).toEqual({ width: 17, height: 68 })
    expect(fitLogoInBox({ width: 0, height: 0 })).toEqual(DOCUMENT_LOGO_BOX)
  })
})

describe('logo processing with the pinned VTracer', () => {
  it('traces a flat colour logo and recommends the vector version', async () => {
    const result = await processLogoImage(await png(wordmark))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ width: 1200, height: 300, displayWidth: 1200, displayHeight: 300, processorVersion: VTRACER_VERSION, traceProfile: 'color-v1' })
    expect(result.value.traced.ok).toBe(true)
    if (!result.value.traced.ok) return
    expect(result.value.traced.differencePct).toBeLessThan(4)
    expect(result.value.recommendedVariant).toBe('svg')
    expect(sniffLogoMimeType(result.value.traced.svgRasterPng)).toBe('image/png')
    expect(sanitizeTracedSvg(result.value.traced.svg).ok).toBe(true)
  }, 20_000)

  it('recommends the uploaded image when tracing flattens a gradient', async () => {
    const result = await processLogoImage(await png(gradient))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.recommendedVariant).toBe('raster')
    expect(sniffLogoMimeType(result.value.normalisedPng)).toBe('image/png')
  }, 20_000)

  it('accepts JPEG and WebP, keeps a raster copy, and bounds its size', async () => {
    const big = await sharp(Buffer.from(wordmark.replace('width="1200" height="300"', 'width="3000" height="750"'))).jpeg().toBuffer()
    const jpeg = await processLogoImage(big)
    expect(jpeg.ok && jpeg.value.displayWidth).toBe(1600)
    const webp = await processLogoImage(await sharp(await png(emblem)).webp().toBuffer())
    expect(webp.ok).toBe(true)
  }, 30_000)

  it('rejects an image that cannot be decoded', async () => {
    const broken = Buffer.concat([(await png(emblem)).subarray(0, 64), Buffer.alloc(64)])
    expect(await processLogoImage(broken)).toEqual({ ok: false, code: 'image_unreadable' })
  })

  it('reports a structured failure when the tracer throws', () => {
    const result = traceLogoToSvg(Buffer.from('not an image'))
    expect(result).toMatchObject({ ok: false, code: 'trace_failed', processorVersion: VTRACER_VERSION })
  })
})
