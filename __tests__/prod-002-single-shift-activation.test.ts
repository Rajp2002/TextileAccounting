import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260713124500_allow_single_shift_machine_activation.sql'),
  'utf8'
)

describe('PROD-002 single-shift loom activation', () => {
  it('requires one active day or night worker rather than both shifts', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.machine_meets_activation_requirements')
    expect(migration).toMatch(/AND EXISTS \([\s\S]*SELECT 1[\s\S]*FROM public\.machine_assignments/)
    expect(migration).toContain("ma.shift IN ('day', 'night')")
    expect(migration).toContain('w.is_active = true')
    expect(migration).not.toMatch(/COUNT\s*\(\s*DISTINCT ma\.shift\s*\)[\s\S]*=\s*2/)
  })

  it('keeps active-order validation and an actionable activation error', () => {
    expect(migration).toContain('o.status = \'active\'')
    expect(migration).toContain('at least one active shift worker assigned and an active order')
    expect(migration).toContain("NEW.status = 'active'")
  })

  it('keeps the readiness function and trigger boundary non-public', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.machine_meets_activation_requirements(uuid, uuid, uuid) FROM PUBLIC'
    )
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.enforce_machine_activation_requirements() FROM PUBLIC'
    )
  })
})
