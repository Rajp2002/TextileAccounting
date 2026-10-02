import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FEATURE_DEMOS, getFeatureDemo, isNarrationLanguage, NARRATION_LANGUAGES } from '@/lib/feature-demos'
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
        for (const url of Object.values(demo)) expect(existsSync(assetPath(url)), url).toBe(true)
        const metadata = JSON.parse(readFileSync(assetPath(demo.src).replace(/\.mp4$/, '.json'), 'utf8'))
        expect(metadata.narration.language).toBe(language)
        const captions = readFileSync(assetPath(demo.captions), 'utf8')
        expect(captions.startsWith('WEBVTT\n')).toBe(true)
        expect(captions.match(/ --> /g)).toHaveLength(metadata.narration.caption_count)
        expect(readFileSync(assetPath(demo.transcript), 'utf8').length).toBeGreaterThan(100)
      })
    }
  }
})
