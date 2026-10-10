import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { calcFabricWeight } from '@/lib/fabric-weight'

describe('calcFabricWeight', () => {
    it('adds warp with crimp and weft, without waste, in grams per metre', () => {
        // 8 kg/100m warp at 5% crimp = 8.4; 6 kg/100m weft. 14.4 kg/100m = 144 g/m.
        const weight = calcFabricWeight({
            warpRows: [{ baseKgPer100mUsed: 8, crimpPct: 5 }],
            weftRows: [{ baseKgPer100mUsed: 6, effectiveCostingWidthInches: 63 }],
        })
        expect(weight?.gramsPerMetre).toBe(144)
        // 144 g over 63 in (1.6002 m) = 89.99 g/m².
        expect(weight?.gsm).toBe(90)
    })

    it('sums every warp and weft system once', () => {
        const weight = calcFabricWeight({
            warpRows: [{ baseKgPer100mUsed: 5, crimpPct: 0 }, { baseKgPer100mUsed: 3, crimpPct: 0 }],
            weftRows: [
                { baseKgPer100mUsed: 4, effectiveCostingWidthInches: 50 },
                { baseKgPer100mUsed: 2, effectiveCostingWidthInches: 50 },
            ],
        })
        expect(weight?.gramsPerMetre).toBe(140)
    })

    it('gives grams per metre but no GSM when the width is unknown', () => {
        const weight = calcFabricWeight({
            warpRows: [{ baseKgPer100mUsed: 8, crimpPct: 0 }],
            weftRows: [{ baseKgPer100mUsed: 6, effectiveCostingWidthInches: 0 }],
        })
        expect(weight).toEqual({ gramsPerMetre: 140, gsm: null })
    })

    it('returns null when no yarn weight is known yet', () => {
        expect(calcFabricWeight({ warpRows: [{ baseKgPer100mUsed: 0, crimpPct: 4 }], weftRows: [] })).toBeNull()
        expect(calcFabricWeight({ warpRows: [{ baseKgPer100mUsed: Number.NaN, crimpPct: 0 }], weftRows: [] })).toBeNull()
    })

    it('is shown with the live cost result', () => {
        const estimator = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'), 'utf8')
        expect(estimator).toContain('<FabricWeightSummary')
        expect(estimator).toContain('calcFabricWeight(totals)')
    })
})
