import type { UpgradeFeature } from './upgrade-wall'

export interface FeatureDemo {
  src: string
  poster: string
  captions: string
  transcript: string
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
