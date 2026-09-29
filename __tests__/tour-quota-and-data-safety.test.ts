import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Tour Quota and Data Safety Verification', () => {
  const tourFiles = [
    'components/estimator/CostEstimateTutorial.tsx',
    'components/estimator/CostEstimateTourRuntime.tsx',
    'lib/estimator-tour.ts',
    'lib/i18n/cost-estimate-tutorial.ts',
    'components/rates/RateBookTutorial.tsx',
    'components/estimator/SavedCostingsTutorial.tsx',
    'components/tours/TourInvitation.tsx',
    'app/actions/tour-preferences.ts',
    'lib/tours/tour-preferences.ts',
  ]

  const fileContents = tourFiles.map(file => ({
    file,
    content: fs.readFileSync(path.resolve(__dirname, '..', file), 'utf-8'),
  }))

  it('no tour file invokes free allowance quota consumption or decrements quota', () => {
    const quotaTokens = [
      'freeMeter',
      '/api/free/calculate',
      'complete_free_saved_costing',
      'consumeFreeAllowance',
      'decrementFreeAllowance',
      'deductAllowance',
      'useAllowance',
      'free_allowance_remaining',
    ]

    for (const { file, content } of fileContents) {
      for (const token of quotaTokens) {
        expect(content, `File ${file} should not reference quota token ${token}`).not.toContain(token)
      }
    }
  })

  it('no tour file directly mutates business data tables (quotes, yarn_rates, orders, production_logs)', () => {
    const businessMutationTokens = [
      ".from('quotes').insert",
      ".from('quotes').update",
      ".from('quotes').delete",
      ".from('yarn_rates').insert",
      ".from('yarn_rates').update",
      ".from('yarn_rates').delete",
      ".from('orders').insert",
      ".from('orders').update",
      ".from('orders').delete",
    ]

    for (const { file, content } of fileContents) {
      for (const token of businessMutationTokens) {
        expect(content, `File ${file} should not execute business mutation ${token}`).not.toContain(token)
      }
    }
  })

  it('server action updates exclusively user_metadata without touching billing or accounting rows', () => {
    const serverAction = fileContents.find(f => f.file === 'app/actions/tour-preferences.ts')!
    expect(serverAction.content).toContain('supabase.auth.updateUser')
    expect(serverAction.content).toContain('tour_preferences:')
    // Does not update database tables
    expect(serverAction.content).not.toContain('.from(')
  })

  it('SavedCostingsTutorial uses synthetic mock examples and exports without database roundtrips', () => {
    const savedTutorial = fileContents.find(f => f.file === 'components/estimator/SavedCostingsTutorial.tsx')!
    // Steps derive in-memory sample dialogs without async data writes
    expect(savedTutorial.content).toContain('SavedCostingsTourRuntime')
    expect(savedTutorial.content).not.toContain('fetch(')
  })
})
