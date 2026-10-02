import type { UpgradeFeature } from './upgrade-wall'

export const NARRATION_LANGUAGES = ['en', 'hi', 'gu'] as const
export type NarrationLanguage = typeof NARRATION_LANGUAGES[number]
export const NARRATION_LANGUAGE_LABELS: Record<NarrationLanguage, string> = {
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
}

export function isNarrationLanguage(value: unknown): value is NarrationLanguage {
  return NARRATION_LANGUAGES.some(language => language === value)
}

export interface FeatureDemo {
  src: string
  poster: string
  captions: string
  transcript: string
}

export function getFeatureDemo(feature: UpgradeFeature, language: NarrationLanguage): FeatureDemo {
  if (language === 'en') return FEATURE_DEMOS[feature]
  const base = `/videos/features/${feature}.${language}`
  return {
    src: `${base}.mp4?v=narrated-1`,
    poster: FEATURE_DEMOS[feature].poster,
    captions: `${base}.vtt?v=narrated-1`,
    transcript: `${base}.txt?v=narrated-1`,
  }
}

/** Local assets: no third-party player or tracking is needed. */
export const FEATURE_DEMOS = Object.fromEntries(
  (['estimator', 'costings', 'qualities', 'rates', 'production', 'payroll'] as const).map(feature => [
    feature,
    {
      src: `/videos/features/${feature}.mp4?v=narrated-1`,
      poster: `/videos/features/${feature}.jpg`,
      captions: `/videos/features/${feature}.vtt?v=narrated-1`,
      transcript: `/videos/features/${feature}.txt?v=narrated-1`,
    },
  ])
) as Record<UpgradeFeature, FeatureDemo>
