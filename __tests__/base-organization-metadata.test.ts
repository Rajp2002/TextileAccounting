import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Base organization metadata reconciliation', () => {
  it('repairs the retained QA tenant without using a generated UUID', () => {
    const migration = read('supabase/migrations/20260812130831_reconcile_base_organization_metadata.sql')

    expect(migration).toContain("lower(btrim(organization.name)) = 'base pilot testing'")
    expect(migration).toContain("SET product_experience = 'base'")
    expect(migration).toContain('onboarding_complete = true')
    expect(migration).toContain("subscription.plan_tier = 'base'")
    expect(migration).not.toContain('CREATE TRIGGER')
    expect(migration).not.toContain('12b58c71-bf3f-445f-b3f2-51a7f22a5587')
  })

  it('makes a fresh Base fixture explicit about its product state', () => {
    const fixture = read('scripts/qa/base-estimator-pilot-fixture.mjs')

    expect(fixture).toContain("product_experience: 'base'")
    expect(fixture).toContain("onboarding_complete: true")
  })
})
