import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Estimator construction text', () => {
    const estimatorClient = readFileSync(
        join(root, 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
        'utf8'
    )

    it('derives warp and weft construction from the yarn component rows', () => {
        expect(estimatorClient).toContain('const warpInstruction = useMemo(() => warpConstructionText(state.warpRows), [state.warpRows])')
        expect(estimatorClient).toContain('const weftInstruction = useMemo(() => weftConstructionText(state.weftRows), [state.weftRows])')
    })

    it('no longer asks the owner to type construction text', () => {
        expect(estimatorClient).not.toContain('constructionFields')
        expect(estimatorClient).not.toContain('setWarpInstruction')
        expect(estimatorClient).not.toContain('setWeftInstruction')
        expect(estimatorClient).not.toContain('lastGeneratedWarp')
        expect(estimatorClient).not.toContain('lastGeneratedWeft')
        expect(estimatorClient).not.toContain('aria-label="Warp yarn construction"')
        expect(estimatorClient).not.toContain('aria-label="Weft yarn construction"')
    })

    it('still saves the derived text with the costing', () => {
        expect(estimatorClient).toContain('warpInstruction:         warpInstruction.trim() || undefined')
        expect(estimatorClient).toContain('weftInstruction:         weftInstruction.trim() || undefined')
    })
})
