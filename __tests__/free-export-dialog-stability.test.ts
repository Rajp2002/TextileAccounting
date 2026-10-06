import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Regression: on /free/costings the "Customer Quotation" card snapped back to
// "Internal Cost Estimate" about a second after it was clicked, and anything
// typed in the form was wiped.
//
// Chain: useFreeEditClock ticks every second -> SavedFreeCostings re-renders ->
// the export model was rebuilt inline (a new object each render) -> the
// dialog's reset effect listed `model` as a dependency -> it ran
// setMode(defaultMode) and cleared every field again.
//
// The suite has no DOM, so these are source contracts, the style used across
// this folder. The behaviour itself was reproduced and re-checked in Chromium
// against the real SavedFreeCostings and CostingExportDialog.

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Free costings export dialog stability', () => {
  const dialog = read('components/estimator/CostingExportDialog.tsx')
  const savedFree = read('app/free/costings/SavedFreeCostings.tsx')

  it('resets the form from primitive inputs only, never from the model object identity', () => {
    const reset = dialog.match(/useEffect\(\(\) => \{\n    if \(!open \|\| !hasModel\) return[\s\S]*?\n  \}, \[([^\]]*)\]\)/)
    expect(reset, 'the reset effect must be keyed on hasModel').not.toBeNull()
    const dependencies = reset![1].split(',').map(dependency => dependency.trim())
    expect(dependencies).toContain('hasModel')
    expect(dependencies).toContain('open')
    expect(dependencies).not.toContain('model')
  })

  it('builds the Free export model once per selected costing, not once per render', () => {
    expect(savedFree).toMatch(/const exportModel = useMemo\(\(\) => selected\s*\?\s*createCostingExportModel\(/)
    expect(savedFree).toMatch(/\[selected\]\)/)
    expect(savedFree).toContain('model={exportModel}')
    // The inline construction inside JSX is what produced a new object every second.
    expect(savedFree).not.toMatch(/model=\{\s*selected\s*\?\s*createCostingExportModel/)
  })

  it('stamps the document with the costing\'s saved date rather than today', () => {
    expect(savedFree).toMatch(/createCostingExportModel\(\{[^}]*createdAt: selected\.created_at/)
  })
})
