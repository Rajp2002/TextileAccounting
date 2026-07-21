import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('saved quality costing library', () => {
  it('loads saved qualities alongside costing snapshots', () => {
    const page = read('app/(dashboard)/owner/quotes/page.tsx')
    const client = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')

    expect(page).toContain('getEstimatorTemplates()')
    expect(page).toContain('initialTemplates={templates ?? []}')
    expect(client).toContain('Latest costing breakdown')
    expect(client).toContain('Applied production')
    expect(client).toContain('Costing history')
    expect(client).toContain('No costing saved for this quality yet')
  })

  it('links new costing and market-run snapshots to the selected quality', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const drafts = read('lib/estimator-drafts.ts')

    expect(estimator).toContain('templateId:              appliedTemplate?.id')
    expect(actions.match(/template_id:\s+params\.templateId \?\? null/g)).toHaveLength(2)
    expect(actions).toContain('production_logs ( meters )')
    expect(drafts).toContain('templateId?: string')
  })
})
