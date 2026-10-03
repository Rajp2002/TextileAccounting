import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Source contracts for seams that need Razorpay or the full estimator to
// mount. The behavior they connect is mounted in free-transaction-flow,
// free-leave-guard-hook and free-usage-counter.
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('FR03 Free-origin checkout keeps the mounted estimator', () => {
  const button = read('components/billing/SubscribeButton.tsx')
  const preview = read('components/estimator/UpgradeBenefitsPreview.tsx')
  const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

  it('lets a Free-origin checkout skip the router refresh that re-runs the Free layout redirect', () => {
    expect(button).toContain('deferRefresh?: boolean')
    const activated = button.slice(button.indexOf("if (state === 'activated') {"), button.indexOf("if (state === 'failed'"))
    expect(activated).toContain('if (!deferRefresh) router.refresh()')
    expect(activated).not.toMatch(/\n\s*router\.refresh\(\)\n/)
  })

  it('the in-place preview is controllable and always defers the refresh to the verified status read', () => {
    expect(preview).toContain('open?: boolean')
    expect(preview).toContain('onOpenChange?: (open: boolean) => void')
    expect(preview).toContain('deferRefresh')
  })

  it('the Free estimator opens the comparison in place from the usage card and quota recovery', () => {
    expect(estimator).toContain('<UpgradeBenefitsPreview')
    const card = estimator.slice(estimator.indexOf('<FreeUsageCard'), estimator.indexOf('/>', estimator.indexOf('<FreeUsageCard')))
    expect(card).toContain('onViewPlans={openFreePlans}')
    const recovery = estimator.slice(estimator.indexOf('<FreeTransactionRecovery'), estimator.indexOf('/>', estimator.indexOf('<FreeTransactionRecovery')))
    expect(recovery).toContain('onViewPlans={openFreePlans}')
  })

  it('guards leaving while page-memory work is at risk, in Free and in the paid estimator it becomes', () => {
    expect(estimator).toContain('useFreeLeaveGuard(freeLeaveReason)')
    expect(estimator).toContain('<FreeLeaveDialog')
    const reason = estimator.slice(estimator.indexOf('const freeLeaveReason'), estimator.indexOf('useFreeLeaveGuard(freeLeaveReason)'))
    expect(reason).toContain('freeMeter.pending')
    expect(reason).toContain('disableAutosave')
    // A tracked, possibly saved attempt keeps the page guarded.
    expect(reason).toContain('freeMeter.unreconciled')
    // Compared with the page at the last confirmed save, not only money-changing inputs.
    expect(reason).toContain('savedPage: freeMeter.completed?.page')
    expect(estimator).toContain('freePageSnapshot({ state, qualityLabel, warpInstruction, weftInstruction })')
    expect(estimator).toContain('freeMeter.submit(preflight.acknowledged, freePage)')
  })

  it('keeps a released attempt\'s reconciliation card after an in-place upgrade', () => {
    const recovery = estimator.slice(estimator.indexOf('<FreeTransactionRecovery') - 120, estimator.indexOf('/>', estimator.indexOf('<FreeTransactionRecovery')))
    expect(recovery).toContain('freeMeter.unreconciled.length > 0')
    expect(recovery).toContain('unreconciled={freeMeter.unreconciled}')
  })
})
