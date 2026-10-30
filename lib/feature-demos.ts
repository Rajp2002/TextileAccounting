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
  /** Poster pixel size: film cuts are 16:9, the Base recordings 3:2. */
  posterSize: readonly [number, number]
  /** The spoken language. When it differs from the chosen language, that language comes as captions. */
  voice: NarrationLanguage
}

/**
 * Free and Lite demos are cut from the Lite launch film (English voice; Hindi and Gujarati captions).
 * The Base demos are separate recordings voiced in all three languages.
 */
const FILM_CUTS: readonly UpgradeFeature[] = ['estimator', 'qualities', 'rates', 'costings']
export const isFilmCut = (feature: UpgradeFeature) => FILM_CUTS.includes(feature)
const version = (feature: UpgradeFeature) => (isFilmCut(feature) ? 'film-1' : 'narrated-1')

export function getFeatureDemo(feature: UpgradeFeature, language: NarrationLanguage): FeatureDemo {
  if (language === 'en') return FEATURE_DEMOS[feature]
  const base = `/videos/features/${feature}.${language}`
  const v = version(feature)
  const captionsOnly = isFilmCut(feature)
  return {
    src: captionsOnly ? FEATURE_DEMOS[feature].src : `${base}.mp4?v=${v}`,
    poster: FEATURE_DEMOS[feature].poster,
    posterSize: FEATURE_DEMOS[feature].posterSize,
    captions: `${base}.vtt?v=${v}`,
    transcript: `${base}.txt?v=${v}`,
    voice: captionsOnly ? 'en' : language,
  }
}

/** Local assets: no third-party player or tracking is needed. */
export const FEATURE_DEMOS = Object.fromEntries(
  (['estimator', 'costings', 'qualities', 'rates', 'production', 'payroll'] as const).map((feature): [UpgradeFeature, FeatureDemo] => [
    feature,
    {
      src: `/videos/features/${feature}.mp4?v=${version(feature)}`,
      poster: `/videos/features/${feature}.jpg`,
      posterSize: isFilmCut(feature) ? [1280, 720] : [1440, 960],
      captions: `/videos/features/${feature}.vtt?v=${version(feature)}`,
      transcript: `/videos/features/${feature}.txt?v=${version(feature)}`,
      voice: 'en',
    },
  ])
) as Record<UpgradeFeature, FeatureDemo>
