import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeDefaultEstimateState } from '../lib/estimator'
import { buildSavedQualityRecipeState } from '../lib/saved-costings'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Costing Defaults Initialization & Runtime Guarantees (ST19–ST35)', () => {
    const estimatorClient = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const estimatorActions = read('app/(dashboard)/owner/estimator/actions.ts')
    const estimatorPage = read('app/(dashboard)/owner/estimator/page.tsx')

    it('ST19: buildEstimatorBaseline hydrates all CD01–CD05 factory defaults', () => {
        // CD01: yarn wastage %
        expect(estimatorClient).toContain('yarnShortagePct: profile.yarn_shortage_pct != null')
        // CD02: target margin %
        expect(estimatorClient).toContain('profitPct:         Number(initialProfile.default_margin_pct ?? base.profitPct)')
        // CD03: overhead mode
        expect(estimatorClient).toContain('overheadMode: resolveOverheadMode(profile)')
        // CD04: warping mode
        expect(estimatorClient).toContain('warpingMode: (profile.default_warping_mode ?? profile.warping_mode ?? base.warpingMode) as \'in_house\' | \'outsourced\'')
        // CD05: sizing mode
        expect(estimatorClient).toContain('sizingMode: (profile.default_sizing_mode ?? profile.sizing_mode ?? base.sizingMode) as \'in_house\' | \'outsourced\'')
    })

    it('ST20: Preserves explicit zero values for wastage and margin (not coerced by falsy check)', () => {
        // yarn_shortage_pct != null check preserves 0
        expect(estimatorClient).toContain('profile.yarn_shortage_pct != null')
        expect(estimatorClient).not.toContain('yarnShortagePct: profile.yarn_shortage_pct ||')

        // default_margin_pct nullish coalescing preserves 0
        expect(estimatorClient).toContain('Number(initialProfile.default_margin_pct ?? base.profitPct)')
        expect(estimatorClient).not.toContain('Number(initialProfile.default_margin_pct ||')
    })

    it('ST21: makeDefaultEstimateState provides safe, neutral baseline defaults', () => {
        const base = makeDefaultEstimateState()
        expect(base.yarnShortagePct).toBe(0)
        expect(base.profitPct).toBe(0)
        expect(base.overheadMode).toBe('monthly_expenses')
        expect(base.warpingMode).toBe('in_house')
        expect(base.sizingMode).toBe('in_house')
    })

    it('ST22: buildSavedQualityRecipeState preserves explicit recipe values over current defaults', () => {
        const profile = {
            default_warping_mode: 'outsourced' as const,
            default_sizing_mode: 'outsourced' as const,
            yarn_shortage_pct: 5,
        }

        // When recipe has explicit values (e.g. 0% wastage, in_house modes)
        const recipeWithValues = {
            id: 'rec-1',
            name: 'Cotton 40s',
            quality_label: 'Cotton 40s',
            yarn_shortage_pct: 0,
            warping_mode: 'in_house' as const,
            sizing_mode: 'in_house' as const,
            tape_length_m: 100,
            warp_crimp_pct: 4,
            per_pick_cost_paise: 25,
            overhead_override_per_m: null,
            loom_type: null,
            loom_rpm: null,
            loom_power_kw: null,
            hours_per_shift: 12,
            weft_rows: [],
            ppi: 60,
            reed_space: 48,
            weft_denier: null,
        }

        const restored = buildSavedQualityRecipeState(recipeWithValues, profile)
        // Explicit 0% wastage preserved over profile's 5%
        expect(restored.yarnShortagePct).toBe(0)
        // Explicit in_house modes preserved over outsourced profile defaults
        expect(restored.warpingMode).toBe('in_house')
        expect(restored.sizingMode).toBe('in_house')
    })

    it('ST23: buildSavedQualityRecipeState falls back to profile defaults when recipe omits modes', () => {
        const profile = {
            default_warping_mode: 'outsourced' as const,
            default_sizing_mode: 'outsourced' as const,
        }

        const recipeWithoutModes = {
            id: 'rec-2',
            name: 'Polyester 60s',
            quality_label: 'Polyester 60s',
            tape_length_m: 100,
            warp_crimp_pct: 4,
            per_pick_cost_paise: 25,
            yarn_shortage_pct: 3,
            overhead_override_per_m: null,
            loom_type: null,
            loom_rpm: null,
            loom_power_kw: null,
            hours_per_shift: 12,
            weft_rows: [],
            ppi: 60,
            reed_space: 48,
            weft_denier: null,
        }

        const restored = buildSavedQualityRecipeState(recipeWithoutModes, profile)
        expect(restored.warpingMode).toBe('outsourced')
        expect(restored.sizingMode).toBe('outsourced')
    })

    it('ST24: Estimator page uses getFactoryCostProfile with createIfMissing: false', () => {
        expect(estimatorPage).toContain('getFactoryCostProfile({ createIfMissing: false })')
    })

    it('ST25: getFactoryCostProfile respects createIfMissing: false and avoids silent writes', () => {
        expect(estimatorActions).toContain('export async function getFactoryCostProfile(options?: { createIfMissing?: boolean })')
        expect(estimatorActions).toContain('if (!data && options?.createIfMissing !== false)')
    })
})
