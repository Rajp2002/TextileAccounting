import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FEATURE_DEMOS, getFeatureDemo, isFilmCut, isNarrationLanguage, NARRATION_LANGUAGES } from '@/lib/feature-demos'
import type { UpgradeFeature } from '@/lib/upgrade-wall'

const features = Object.keys(FEATURE_DEMOS) as UpgradeFeature[]
const assetPath = (url: string) => join(process.cwd(), 'public', url.split('?')[0])

describe('Localized feature demo assets', () => {
  it('accepts supported persisted preferences and rejects corrupt or unknown values', () => {
    for (const language of NARRATION_LANGUAGES) expect(isNarrationLanguage(language)).toBe(true)
    for (const value of [null, undefined, '', 'fr', 'HI', {}, 1]) expect(isNarrationLanguage(value)).toBe(false)
  })

  for (const feature of features) {
    for (const language of NARRATION_LANGUAGES) {
      it(`${feature}/${language} has a playable asset, matching captions and transcript`, () => {
        const demo = getFeatureDemo(feature, language)
        for (const url of [demo.src, demo.poster, demo.captions, demo.transcript]) expect(existsSync(assetPath(url)), url).toBe(true)
        const metadata = JSON.parse(readFileSync(assetPath(demo.captions).replace(/\.vtt$/, '.json'), 'utf8'))
        // Film cuts are voiced in English and captioned in each language; the Base recordings are voiced in each.
        expect(demo.voice).toBe(isFilmCut(feature) ? 'en' : language)
        expect(metadata.narration.language).toBe(demo.voice)
        if (metadata.captions) expect(metadata.captions.language).toBe(language)
        const captions = readFileSync(assetPath(demo.captions), 'utf8')
        expect(captions.startsWith('WEBVTT\n')).toBe(true)
        expect(captions.match(/ --> /g)).toHaveLength(metadata.captions?.caption_count ?? metadata.narration.caption_count)
        expect(readFileSync(assetPath(demo.transcript), 'utf8').length).toBeGreaterThan(100)
      })
    }
  }

  it('film cuts play one English video in every language and ship no stale localized recordings', () => {
    for (const feature of features.filter(isFilmCut)) {
      for (const language of NARRATION_LANGUAGES) {
        expect(getFeatureDemo(feature, language).src).toBe(FEATURE_DEMOS[feature].src)
        if (language !== 'en') expect(existsSync(join(process.cwd(), 'public/videos/features', `${feature}.${language}.mp4`))).toBe(false)
      }
    }
  })
})
