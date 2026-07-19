import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('UX012-CR-01 machine terminology', () => {
  const coreUi = [
    'lib/i18n/locales/en.ts',
    'components/navigation/owner-sidebar.tsx',
    'components/MachineManagement.tsx',
    'components/factory-today/MachineAttentionCard.tsx',
    'components/factory-today/ProductionStatusCard.tsx',
    'components/factory-today/SetupPanel.tsx',
    'app/(dashboard)/supervisor/machines/page.tsx',
    'app/(dashboard)/supervisor/dashboard/page.tsx',
  ].map(read).join('\n')

  it('uses Machine for the user-facing production asset in core English workflows', () => {
    for (const retiredText of [
      'Loom Assignments',
      'Loom Board',
      'Loom Name',
      'Loom Type',
      'Add Loom',
      'Edit Loom',
      'Manage Looms',
      'View Looms',
      'No looms found',
      'All looms assigned',
    ]) {
      expect(coreUi).not.toContain(retiredText)
    }

    for (const approvedText of [
      'Machine Assignments',
      'Machine Board',
      'Machine Name',
      'Machine Type',
      'Add Machine',
      'Edit Machine',
      'Manage Machines',
      'View Machines',
      'No machines found',
      'All machines assigned',
    ]) {
      expect(coreUi).toContain(approvedText)
    }
  })

  it('preserves stable internal machine routes, fields and workflow identifiers', () => {
    const sidebar = read('components/navigation/owner-sidebar.tsx')
    const ownerActions = read('app/(dashboard)/owner/actions.ts')

    expect(sidebar).toContain('href: "/owner/machines"')
    expect(sidebar).toContain('workflow: "looms"')
    expect(ownerActions).toContain(".from('machines')")
    expect(ownerActions).toContain('machine_id')
  })

  it('names the entered shift total without presenting it as a counter reading', () => {
    const english = read('lib/i18n/locales/en.ts')
    const supervisorDashboard = read('app/(dashboard)/supervisor/dashboard/page.tsx')

    expect(english).toContain('"production_log": "Metres Produced This Shift"')
    expect(english).toContain('shiftProduction: "Metres Produced This Shift"')
    expect(supervisorDashboard).toContain('Metres Produced This Shift')
    expect(supervisorDashboard).not.toContain('Shift Meter Log')
    expect(supervisorDashboard).not.toContain('No valid counter readings')
  })

  it('preserves the founder-approved money and dispatch terminology boundaries', () => {
    const english = read('lib/i18n/locales/en.ts')
    const sidebar = read('components/navigation/owner-sidebar.tsx')
    const partyMoneyScreen = read('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
    const kharchiDialog = read('components/supervisor/KharchiDialog.tsx')
    const kharchiRpcMigration = read('supabase/migrations/20260701105404_batch_20_payroll_rpc_kharchi_atomicity.sql')
    const dispatchModal = read('components/dispatches/DispatchModals.tsx')

    expect(english).toContain('"commercials": "Party Ledger"')
    expect(english).toContain('"payroll": "Worker Hisaab"')
    expect(english).toContain('"advances": "Upaad (Worker Advance)"')
    expect(sidebar).toContain('{ name: "Party Ledger", href: "/owner/commercials"')
    expect(partyMoneyScreen).toContain('>Party Ledger</h1>')

    expect(kharchiDialog).toContain('Kharchi (Floor Cash)')
    expect(kharchiDialog).toContain('separate from Upaad')
    expect(kharchiDialog).not.toContain('Give a cash advance')
    expect(kharchiRpcMigration).toContain("'kharchi'::advance_type")

    expect(dispatchModal).toContain('Delivery Challan number')
    expect(dispatchModal).toContain('Challan Number')
  })
})

describe('UX-012 Batch 3 founder terminology boundaries', () => {
  it('separates internal Cost Estimates from customer-facing Quotations', () => {
    const english = read('lib/i18n/locales/en.ts')
    const sidebar = read('components/navigation/owner-sidebar.tsx')
    const quotations = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')

    expect(english).toContain('"estimator": "Cost Estimate"')
    expect(english).toContain('"quotes": "Quotations"')
    expect(sidebar).toContain('{ name: "Cost Estimate", href: "/owner/estimator"')
    expect(quotations).toContain('Quotation History')
    expect(quotations).toContain('Quotation Price')
    expect(quotations).toContain('Cost Estimate draft')
  })

  it('uses Taka as the active pilot unit while keeping metres distinct', () => {
    const stockPage = read('app/(dashboard)/owner/stock/page.tsx')
    const stockBoard = read('app/(dashboard)/owner/stock/TakaStockClient.tsx')
    const dispatch = read('components/dispatches/SellAndDispatchDialog.tsx')

    expect(stockPage).toContain("import TakaStockClient from './TakaStockClient'")
    expect(stockBoard).toContain('Metres per Taka')
    expect(dispatch).toContain('Number of Taka Sold')
    expect(dispatch).toContain('Metres Sold reserves stock')
    expect(dispatch).toContain('the two quantities are not interchangeable')
  })

  it('keeps sold, dispatched and party-received fabric quantities distinct', () => {
    const english = read('lib/i18n/locales/en.ts')
    const setup = read('components/factory-today/SetupPanel.tsx')

    expect(english).toContain('metersReceived: "Metres Received by Party"')
    expect(setup).toContain('Metres Dispatched')
    expect(setup).toContain('Metres Received by Party')
    expect(setup).not.toContain('sent meters')
  })

  it('uses Piece-Rate Worker and Salaried Worker without renaming internal identifiers', () => {
    const english = read('lib/i18n/locales/en.ts')
    const assignments = read('components/MachineManagement.tsx')
    const ownerActions = read('app/(dashboard)/owner/actions.ts')

    expect(english).toContain('meter_workers: "Piece-Rate Workers"')
    expect(english).toContain('fixed_workers: "Salaried Workers"')
    expect(assignments).toContain('<option value="meter_worker">Piece-Rate Worker</option>')
    expect(assignments).toContain('<option value="fixed_worker">Salaried Worker</option>')
    expect(ownerActions).toContain(".from('fixed_workers')")
    expect(ownerActions).toContain("workerType === 'meter_worker'")
  })

  it('preserves Warp Yarn and Weft Yarn and explains inverse unit labels', () => {
    const english = read('lib/i18n/locales/en.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    expect(english).toContain('title: "Warp Yarn Composition"')
    expect(english).toContain('title: "Weft Yarn Composition"')
    expect(english).toContain('m/kg — metres represented by one kilogram')
    expect(estimator).toContain('Kilograms required per 100 metres of fabric')
    expect(estimator).toContain("type: 'UPDATE_WARP_ROW'")
    expect(estimator).toContain("type: 'UPDATE_WEFT_ROW'")
  })
})
