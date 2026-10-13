import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx', 'utf8')

describe('Base daily sheet incomplete-shift prompt', () => {
    it('only counts blank workers who have a machine on the shift as outstanding', () => {
        expect(source).toMatch(/outstandingWorkerCount = sheetWorkers\.filter\(\(worker\) => \(contextsByWorker\.get\(worker\.id\) \?\? \[\]\)\.length > 0 && getRow\(worker\.id\)\.status === 'blank'\)/)
        expect(source).not.toContain('summary.outstanding_count')
    })

    it('locks a saved shift one reading at a time, so pending readings stay open to complete it', () => {
        expect(source).toMatch(/const areInputsDisabled = isSaving \|\| isCurrentBatchLocked \|\| draftStatus === 'conflict'$/m)
        expect(source).toContain('const disabled = areInputsDisabled || settledWorkerIds.has(context.workerId!) || isMachineReadingProtected(context)')
        expect(source).toContain('if (isSavedBatchProtected && lockedChangeCount > 0)')
        expect(source).toContain('correctionReason: currentBatch ? (isSavedBatchProtected ? COMPLETED_READINGS_REASON : correctionReason) : undefined')
    })
})
