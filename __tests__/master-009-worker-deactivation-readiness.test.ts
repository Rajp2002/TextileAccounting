import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('MASTER-009 worker deactivation readiness', () => {
  it('re-evaluates assigned looms without deleting assignment or production history', () => {
    const migration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260711061412_inactivate_looms_after_worker_deactivation.sql'),
      'utf8'
    )

    expect(migration).toContain('AFTER UPDATE OF is_active ON public.workers')
    expect(migration).toContain('NEW.is_active IS FALSE')
    expect(migration).toContain('public.machine_meets_activation_requirements')
    expect(migration).toMatch(/UPDATE public\.machines AS m\s+SET status = 'inactive'/)
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.(machine_assignments|production_logs)/i)
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.inactivate_machines_after_worker_status_change() FROM PUBLIC'
    )
  })

  it('counts only assignments whose worker is still active in Factory Today', () => {
    const source = fs.readFileSync(
      path.join(root, 'app/(dashboard)/owner/today/actions.ts'),
      'utf8'
    )

    expect(source).toContain(".select('machine_id, shift, worker_id, workers!inner(id)')")
    expect(source).toContain(".eq('workers.is_active', true)")
  })
})
