import 'server-only'

import sharp, { type Metadata, type OutputInfo } from 'sharp'
import { validateLogoDimensions, type LogoValidationErrorCode } from './image-validation'
import {
  LOGO_MAX_PIXELS,
  LOGO_NORMALISED_MAX_SIDE_PX,
  LOGO_SVG_MAX_PATHS,
  LOGO_SVG_MAX_RECOMMENDED_DIFFERENCE_PCT,
  LOGO_SVG_RASTER_MAX_SIDE_PX,
  LOGO_TRACE_MAX_SIDE_PX,
} from './limits'
import { traceLogoToSvg, type TraceProfileName } from './vtracer-adapter.server'
import type { LogoVariant } from './types'

export type ProcessedLogo = {
  width: number
  height: number
  /** Orientation applied, metadata removed, sRGB, bounded size, transparency kept. */
  normalisedPng: Buffer
  displayWidth: number
  displayHeight: number
  traced:
    | { ok: true; svg: string; svgRasterPng: Buffer; pathCount: number; bytes: number; differencePct: number }
    | { ok: false; code: string }
  recommendedVariant: LogoVariant
  processorVersion: string
  traceProfile: TraceProfileName
  traceDurationMs: number
}

const sharpInput = { limitInputPixels: LOGO_MAX_PIXELS, failOn: 'error' } as const

/**
 * Decode, validate, normalise and trace one uploaded logo. The raster copy is
 * always produced first, so a tracing failure still leaves a usable logo.
 */
export async function processLogoImage(bytes: Buffer):
  Promise<{ ok: true; value: ProcessedLogo } | { ok: false; code: LogoValidationErrorCode }> {
  let metadata: Metadata
  try {
    metadata = await sharp(bytes, { ...sharpInput, animated: true }).metadata()
  } catch {
    return { ok: false, code: 'image_unreadable' }
  }
  const dimensions = validateLogoDimensions(metadata)
  if (!dimensions.ok) return dimensions

  let normalised: { data: Buffer; info: OutputInfo }
  try {
    normalised = await sharp(bytes, sharpInput)
      .rotate()
      .toColourspace('srgb')
      .resize({ width: LOGO_NORMALISED_MAX_SIDE_PX, height: LOGO_NORMALISED_MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    return { ok: false, code: 'image_unreadable' }
  }

  const traceInput = await sharp(normalised.data)
    .resize({ width: LOGO_TRACE_MAX_SIDE_PX, height: LOGO_TRACE_MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  const trace = traceLogoToSvg(traceInput)

  let traced: ProcessedLogo['traced']
  if (trace.ok) {
    try {
      const svgBuffer = Buffer.from(trace.value.svg)
      const svgRasterPng = await sharp(svgBuffer, { limitInputPixels: LOGO_MAX_PIXELS })
        .resize({ width: LOGO_SVG_RASTER_MAX_SIDE_PX, height: LOGO_SVG_RASTER_MAX_SIDE_PX, fit: 'inside' })
        .png({ compressionLevel: 9 })
        .toBuffer()
      const differencePct = await meanDifferencePct(traceInput, svgRasterPng)
      traced = { ok: true, svg: trace.value.svg, svgRasterPng, pathCount: trace.value.pathCount, bytes: trace.value.bytes, differencePct }
    } catch {
      traced = { ok: false, code: 'svg_rejected' }
    }
  } else {
    traced = { ok: false, code: trace.code === 'trace_failed' ? 'trace_failed' : 'svg_rejected' }
  }

  const recommendedVariant: LogoVariant = traced.ok
    && traced.differencePct <= LOGO_SVG_MAX_RECOMMENDED_DIFFERENCE_PCT
    && traced.pathCount <= LOGO_SVG_MAX_PATHS
    ? 'svg'
    : 'raster'

  return {
    ok: true,
    value: {
      width: dimensions.width,
      height: dimensions.height,
      normalisedPng: normalised.data,
      displayWidth: normalised.info.width,
      displayHeight: normalised.info.height,
      traced,
      recommendedVariant,
      processorVersion: trace.processorVersion,
      traceProfile: trace.profile,
      traceDurationMs: trace.durationMs,
    },
  }
}

/**
 * Mean per-channel difference between the original and the traced logo, both
 * flattened on white paper at the same size, as a percentage. A safety net
 * for gradients and lost detail; the owner's side-by-side review decides.
 */
async function meanDifferencePct(original: Buffer, traced: Buffer) {
  const size = { width: 400, height: 400, fit: 'fill' as const }
  const [a, b] = await Promise.all([original, traced].map(input => sharp(input)
    .flatten({ background: '#ffffff' })
    .resize(size)
    .removeAlpha()
    .raw()
    .toBuffer()))
  let total = 0
  for (let index = 0; index < a.length; index += 1) total += Math.abs(a[index] - b[index])
  return Math.round(total / a.length / 255 * 10000) / 100
}
