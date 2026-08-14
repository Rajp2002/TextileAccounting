import type { FactorySections } from './estimator'

export type FactoryProfileId =
  | 'grey_weaver'
  | 'job_weaver'
  | 'processed_fabric'
  | 'full_mill'
  | 'custom'
  | 'unselected'

export type FactoryCostProfileBaseline = {
  is_configured?: boolean | null
  monthly_output_m?: number | string | null
  overhead_override_per_m?: number | string | null
}

/**
 * A profile can predate the explicit is_configured flag. Treat persisted
 * costing values as a meaningful baseline as well so those owners do not get
 * sent through first-run setup again.
 */
export function hasMeaningfulFactoryCostBaseline(
  profile?: FactoryCostProfileBaseline | null,
): boolean {
  if (!profile) return false
  return Boolean(
    profile.is_configured
    || Number(profile.monthly_output_m ?? 0) > 0
    || Number(profile.overhead_override_per_m ?? 0) > 0,
  )
}

export interface FactoryCostPreset {
  id: FactoryProfileId
  label: string
  description: string
  emoji: string
  recommended?: boolean
  sections: FactorySections
}

/**
 * These are starting points for the estimator, not claims about every unit.
 * Selling charges remain off until the owner explicitly enables them; this is
 * safer for a grey-weaving unit than assuming commission or delivery applies.
 */
export const FACTORY_COST_PRESETS: FactoryCostPreset[] = [
  {
    id: 'grey_weaver',
    label: 'Grey Weaver',
    description: 'Weaving grey fabric only; processing, finishing, commission, and transport stay off.',
    emoji: '🧶',
    recommended: true,
    sections: { winding: false, processing: false, finishing: false, commission: false, transport: false },
  },
  {
    id: 'job_weaver',
    label: 'Job Weaver',
    description: 'Weaving on job-work basis, including winding when yarn arrives on hanks.',
    emoji: '🔧',
    sections: { winding: true, processing: false, finishing: false, commission: false, transport: false },
  },
  {
    id: 'processed_fabric',
    label: 'Processed Fabric Unit',
    description: 'Weaving plus dyeing, printing, or finishing before delivery.',
    emoji: '🎨',
    sections: { winding: false, processing: true, finishing: true, commission: false, transport: false },
  },
  {
    id: 'full_mill',
    label: 'Full Textile Mill',
    description: 'Multiple textile operations under one unit, including processing and finishing.',
    emoji: '🏭',
    sections: { winding: true, processing: true, finishing: true, commission: false, transport: false },
  },
  {
    id: 'custom',
    label: 'Custom setup',
    description: 'I want to choose each optional cost section myself.',
    emoji: '⚙️',
    sections: { winding: false, processing: false, finishing: false, commission: false, transport: false },
  },
]

export function getFactoryCostPreset(id: FactoryProfileId | null | undefined): FactoryCostPreset | null {
  return FACTORY_COST_PRESETS.find(preset => preset.id === id) ?? null
}

export function getMatchingFactoryProfileId(sections: FactorySections): FactoryProfileId | null {
  const match = FACTORY_COST_PRESETS.find(preset => preset.id !== 'custom' &&
    (Object.keys(preset.sections) as Array<keyof FactorySections>)
      .every(section => preset.sections[section] === sections[section]))
  return match?.id ?? null
}

export function cloneFactorySections(sections: FactorySections): FactorySections {
  return { ...sections }
}
