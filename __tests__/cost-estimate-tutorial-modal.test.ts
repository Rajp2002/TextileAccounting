import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('CostEstimateTutorial Modal Positioning and Stability', () => {
    const tutorialPath = path.resolve(__dirname, '../components/estimator/CostEstimateTutorial.tsx')
    const estimatorClientPath = path.resolve(__dirname, '../app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const sheetPath = path.resolve(__dirname, '../components/ui/sheet.tsx')
    const dialogPath = path.resolve(__dirname, '../components/ui/dialog.tsx')

    const tutorialSource = fs.readFileSync(tutorialPath, 'utf8')
    const estimatorClientSource = fs.readFileSync(estimatorClientPath, 'utf8')
    const sheetSource = fs.readFileSync(sheetPath, 'utf8')
    const dialogSource = fs.readFileSync(dialogPath, 'utf8')

    it('supports hideOverlay prop in DialogContent to prevent overlay interference', () => {
        expect(dialogSource).toContain('hideOverlay = false')
        expect(dialogSource).toContain('{!hideOverlay && <DialogOverlay />}')
    })

    it('supports hideOverlay prop in SheetContent to prevent overlay interference', () => {
        expect(sheetSource).toContain('hideOverlay = false')
        expect(sheetSource).toContain('{!hideOverlay && <SheetOverlay />}')
    })

    it('passes hideOverlay and disables animations on mobile-live-estimate-panel when tutorial is active', () => {
        expect(estimatorClientSource).toContain('hideOverlay={isTutorialActive}')
        expect(estimatorClientSource).toContain(
            "isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''"
        )
    })

    it('binds card to mobile-live-estimate-panel for modal fields in resolveStepElements', () => {
        expect(tutorialSource).toContain("document.getElementById('mobile-live-estimate-panel')")
        expect(tutorialSource).toContain('isModalField')
    })

    it('uses instant scrolling inside the modal to prevent measurement drift', () => {
        expect(tutorialSource).toContain("targetEl.scrollIntoView({ block: 'nearest', behavior: 'auto' })")
    })

    it('verifies coordinate stability across animation frames before measuring rects', () => {
        expect(tutorialSource).toContain('isMoving')
        expect(tutorialSource).toContain('stableFrames')
    })

    it('keeps panel placement at top-right for modal steps to avoid covering modal content', () => {
        expect(tutorialSource).toContain('!isModal && targetRect.top < 340')
    })

    it('schedules post-mount settle updates to guarantee highlight alignment', () => {
        expect(tutorialSource).toContain('backupTimer')
    })

    it('guards onOpenChange and blocks auto-close when tutorial is active', () => {
        expect(estimatorClientSource).toContain('if (isTutorialActive && !nextOpen)')
    })

    it('prevents dismiss on outside clicks and interactions during tutorial', () => {
        expect(estimatorClientSource).toContain('onPointerDownOutside={(e) => {')
        expect(estimatorClientSource).toContain('if (isTutorialActive) {')
        expect(estimatorClientSource).toContain('e.preventDefault()')
        expect(estimatorClientSource).toContain('onInteractOutside={(e) => {')
    })

    it('hides the sheet close button during tutorial to prevent accidental dismissal', () => {
        expect(estimatorClientSource).toContain('showCloseButton={!isTutorialActive}')
    })

    it('re-asserts modal open state during measurement of modal steps', () => {
        expect(tutorialSource).toContain('if (isModal) {')
        expect(tutorialSource).toContain('onOpenLiveCostModal?.(true)')
    })

    it('prevents auto-focusing elements inside SheetContent during tutorial to avoid Enter key conflict', () => {
        expect(estimatorClientSource).toContain('onOpenAutoFocus={(e) => {')
        expect(estimatorClientSource).toContain('if (isTutorialActive) {')
        expect(estimatorClientSource).toContain('e.preventDefault()')
    })

    it('ensures Enter key advances tour unless focus is explicitly on Back or Skip controls', () => {
        expect(tutorialSource).toContain("activeEl.dataset.tourControl === 'back' || activeEl.dataset.tourControl === 'skip'")
        expect(tutorialSource).toContain('handleNext()')
    })

    it('passes hideOverlay and disables animations on monthly-expenses-dialog-panel when tutorial is active', () => {
        expect(estimatorClientSource).toContain('id="monthly-expenses-dialog-panel"')
        expect(estimatorClientSource).toContain('hideOverlay={isTutorialActive}')
        expect(estimatorClientSource).toContain(
            "isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''"
        )
    })

    it('binds card to monthly-expenses-dialog-panel for monthly expenses fields in resolveStepElements', () => {
        expect(tutorialSource).toContain("document.getElementById('monthly-expenses-dialog-panel')")
        expect(tutorialSource).toContain('isExpensesModalField')
    })

    it('inserts monthlyExpensesBreakdown and monthlyProductionM after monthlyOverhead in collect()', () => {
        expect(tutorialSource).toContain("if (field === 'monthlyOverhead') {")
        expect(tutorialSource).toContain("field: 'monthlyExpensesBreakdown'")
        expect(tutorialSource).toContain("field: 'monthlyProductionM'")
    })

    it('re-asserts monthly expenses modal open state during measurement', () => {
        expect(tutorialSource).toContain('onOpenMonthlyExpensesModal?.(true)')
    })

    it('tags monthlyExpensesBreakdown and monthlyProductionM fields in EstimatorClient', () => {
        expect(estimatorClientSource).toContain('data-estimator-field="monthlyExpensesBreakdown"')
        expect(estimatorClientSource).toContain('data-estimator-field="monthlyProductionM"')
    })

    it('passes hideOverlay and disables animations on saved-qualities-sheet-panel when tutorial is active', () => {
        expect(estimatorClientSource).toContain('id="saved-qualities-sheet-panel"')
        expect(estimatorClientSource).toContain('hideOverlay={isTutorialActive}')
        expect(estimatorClientSource).toContain(
            "isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''"
        )
    })

    it('binds card to saved-qualities-sheet-panel for savedQualityPicker in resolveStepElements', () => {
        expect(tutorialSource).toContain("document.getElementById('saved-qualities-sheet-panel')")
        expect(tutorialSource).toContain('isQualityModalField')
    })

    it('inserts savedQualityPicker as the last step in Section 10 after savedQualities in collect()', () => {
        expect(tutorialSource).toContain("if (header.dataset.estimatorField === 'savedQualities') {")
        expect(tutorialSource).toContain("field: 'savedQualityPicker'")
    })

    it('re-asserts quality library sheet open state during measurement', () => {
        expect(tutorialSource).toContain('onOpenQualityLibraryModal?.(true)')
    })

    it('tags savedQualityPicker field in EstimatorClient', () => {
        expect(estimatorClientSource).toContain('data-estimator-field="savedQualityPicker"')
    })
})
