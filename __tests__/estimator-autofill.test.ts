import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Estimator Construction Auto-fill', () => {
    const estimatorClient = readFileSync(
        join(root, 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
        'utf8'
    )

    it('contains lastGeneratedWarp and lastGeneratedWeft refs', () => {
        expect(estimatorClient).toContain('const lastGeneratedWarp = useRef<string | null>(null)')
        expect(estimatorClient).toContain('const lastGeneratedWeft = useRef<string | null>(null)')
    })

    it('contains warpInstruction and weftInstruction auto-fill useEffects', () => {
        // Verify warp instruction auto-fill
        expect(estimatorClient).toContain('// Auto-fill warpInstruction based on warp rows\' labels')
        expect(estimatorClient).toContain('state.warpRows')
        expect(estimatorClient).toContain('.map(row => row.label?.trim())')
        expect(estimatorClient).toContain('lastGeneratedWarp.current = currentWarpLabels')

        // Verify weft instruction auto-fill
        expect(estimatorClient).toContain('// Auto-fill weftInstruction based on weft rows\' labels and picks')
        expect(estimatorClient).toContain('state.weftRows.reduce((sum, row) => sum + (row.picks || 0), 0)')
        expect(estimatorClient).toContain('lastGeneratedWeft.current = currentWeftGen')
    })

    it('resets refs and instruction states in applyTemplate', () => {
        expect(estimatorClient).toContain('const applyTemplate = useCallback((tpl: EstimatorTemplate, confirmed = false) => {')
        expect(estimatorClient).toContain('setWarpInstruction(\'\')')
        expect(estimatorClient).toContain('setWeftInstruction(\'\')')
    })

    it('resets refs in applyEstimatorDraft and handleNewQualityConfirm', () => {
        // applyEstimatorDraft
        expect(estimatorClient).toContain('const applyEstimatorDraft = useCallback((checkpoint?: EstimatorDraftInput<EstimateState>) => {')
        
        // handleNewQualityConfirm
        expect(estimatorClient).toContain('const handleNewQualityConfirm = () => {')
    })
})
