import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('SALE-010/012/014 sale and optional dispatch remediation', () => {
  it('exposes an operator-controlled dispatch-now path with date and quantity', () => {
    const dialog = fs.readFileSync(path.join(root, 'components/dispatches/SellAndDispatchDialog.tsx'), 'utf8')

    expect(dialog).toContain('Dispatch now')
    expect(dialog).toContain('setDispatchNow(event.target.checked)')
    expect(dialog).toContain('Dispatched meters')
    expect(dialog).toContain('Dispatch date')
    expect(dialog).toContain('onInput={(event) => setDispatchDate')
    expect(dialog).toContain("document.querySelector<HTMLInputElement>('[data-testid=\"sell-dispatch-date\"]')?.value")
    expect(dialog).toContain('dispatchDate >= saleDate')
    expect(dialog).toContain("dispatchNow ? 'Sell & Dispatch' : 'Save Sale Only'")
  })

  it('preserves the future dispatch date and rejects dates before the sale', () => {
    const action = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/dispatches/actions.ts'), 'utf8')

    expect(action).toContain('p_dispatch_date: dispatchDate')
    expect(action).toContain("message: 'Dispatch date cannot be before sale date'")
  })

  it('reports a recoverable partial success instead of silently losing dispatch intent', () => {
    const action = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/dispatches/actions.ts'), 'utf8')

    expect(action).toContain("result.dispatch_status === 'not_dispatched'")
    expect(action).toContain("stage: 'dispatch'")
    expect(action).toContain('The sale is safe under Sold Pending Dispatch')
    expect(action).toContain('recoverable: true')
  })

  it('reports atomic rollback explicitly when the RPC fails during requested dispatch', () => {
    const action = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/dispatches/actions.ts'), 'utf8')

    expect(action).toContain("if (input.dispatchNow)")
    expect(action).toContain("stage: 'dispatch'")
    expect(action).toContain('Sale and dispatch were not saved. No stock was changed.')
  })
})
