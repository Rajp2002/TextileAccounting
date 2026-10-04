import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Estimator aesthetic and responsive refinement', () => {
  const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
  const styles = read('app/globals.css')

  it('uses an accessible progressive-disclosure pattern for pricing assumptions', () => {
    expect(client).toContain('data-testid="pricing-assumptions-trigger"')
    expect(client).toContain('aria-expanded={expanded}')
    expect(client).toContain('aria-controls="pricing-assumptions-details"')
    expect(client).toContain('estimator-touch-target')
    expect(client).toContain('grid-rows-[0fr]')
    expect(client).toContain('Technical details')
    expect(client).toContain('Calculation snapshot')
    expect(client).toContain("const [entryMode, setEntryMode] = useState<'quick' | 'detailed'>('quick')")
    expect(client).toContain('const [assumptionsExpanded, setAssumptionsExpanded] = useState(false)')
    expect(client).not.toContain('Assumptions used in this price')
    expect(client).not.toContain('Reference rate')
  })

  it('keeps the result hierarchy and responsive layout width-driven', () => {
    expect(client).toContain('Production cost / m')
    expect(client).toContain("t('common.suggested_selling_price_per_m')")
    expect(client).toContain('Estimated margin at this price')
    expect(client).toContain('Break-even price / m')
    expect(client).toContain('breakEvenMatchesProductionCost')
    expect(client).toContain('Break-even floor')
    expect(client).toContain('Material context')
    expect(client).toContain("'xl:grid-cols-3' : 'xl:grid-cols-4'")
    expect(client).toContain('data-testid="costing-validity"')
    expect(client).toContain('data-testid={`yarn-component-${accent}-${index}`}')
    expect(client).toContain('Manual workflow: calculate this base weight and cost first.')
    expect(client).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]')
    expect(client).toContain('id="estimator-form-panel"')
    expect(styles).toContain('#pricing-assumptions-details')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps the saved-quality loading badge stable on narrow screens', () => {
    expect(client).toContain('flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center')
    expect(client).toContain('role="status"')
    expect(client).toContain('aria-live="polite"')
    expect(client).toContain('shrink-0 items-center whitespace-nowrap rounded-full')
  })

  it('keeps the live-cost shortcut labelled in both readiness states', () => {
    expect(client).toContain("{hasValidCostResult ? 'View costing' : 'Complete inputs'}")
    expect(client).not.toContain('mobileCostingShortcutExpanded')
  })

  it('does not restart deferred quality hydration during rerenders', () => {
    expect(client).toContain('const secondaryDataRequestRef = useRef<ReturnType<typeof getEstimatorSecondaryData> | null>(null)')
    expect(client).toContain('secondaryDataRequestRef.current = getEstimatorSecondaryData()')
    expect(client).not.toContain('setTemplatesLoaded(false)')
    expect(client).toContain('aria-busy={!templatesLoaded}')
    expect(client).not.toContain('Saved qualities and optional estimator tools are loading…')
  })
})
