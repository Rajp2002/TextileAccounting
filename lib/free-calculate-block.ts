/** Why Free cannot start a new calculation, shown beside the disabled Calculate button. */
export type FreeCalculateBlock = 'checking' | 'unavailable' | 'account' | 'paused' | 'allowance_used'

type FreeCalculateStatus = {
  accessState: string
  estimationEnabled: boolean
  quota: { remaining: number }
}

/**
 * Null while a calculation is possible or already running, while the page
 * holds a saved costing (its 30-minute edit window explains revisions), and
 * while verified paid access switches the page to the paid estimator. A
 * used-up allowance comes before a pause: upgrading is the way forward either way.
 */
export function getFreeCalculateBlock(input: {
  status: FreeCalculateStatus | null | undefined
  statusError: string
  hasSavedCosting: boolean
  busy: boolean
}): FreeCalculateBlock | null {
  if (input.busy || input.hasSavedCosting) return null
  const { status } = input
  if (!status) return input.statusError ? 'unavailable' : 'checking'
  if (status.accessState === 'paid') return null
  if (status.accessState !== 'active') return 'account'
  if (status.quota.remaining <= 0) return 'allowance_used'
  if (!status.estimationEnabled) return 'paused'
  return null
}
