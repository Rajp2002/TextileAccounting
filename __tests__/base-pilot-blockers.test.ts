import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { downloadBlob } from '../lib/browser-download'

const root = process.cwd()

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Base pilot blocker regressions', () => {
  it('dispatches a named browser download before revoking its object URL', () => {
    const events: string[] = []
    const anchor = {
      href: '',
      download: '',
      hidden: false,
      click: () => events.push('click'),
      remove: () => events.push('remove'),
    }
    const callbacks: Array<() => void> = []

    vi.stubGlobal('URL', {
      createObjectURL: () => {
        events.push('create')
        return 'blob:base-pilot-export'
      },
      revokeObjectURL: () => events.push('revoke'),
    })
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { appendChild: () => events.push('append') },
    })
    vi.stubGlobal('window', {
      setTimeout: (callback: () => void) => {
        callbacks.push(callback)
        return 1
      },
    })

    const result = downloadBlob(new Blob(['pilot']), 'base-pilot.json')

    expect(result).toEqual({ filename: 'base-pilot.json', objectUrl: 'blob:base-pilot-export' })
    expect(anchor.download).toBe('base-pilot.json')
    expect(events).toEqual(['create', 'append', 'click', 'remove'])
    callbacks[0]?.()
    expect(events).toEqual(['create', 'append', 'click', 'remove', 'revoke'])
  })

  it('keeps export audit writes behind the service-role boundary', () => {
    const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'))
    const migrationName = migrations.find(name => name.endsWith('_harden_export_audit_boundary.sql'))
    expect(migrationName).toBeTruthy()
    const migration = fs.readFileSync(path.join(root, 'supabase/migrations', migrationName!), 'utf8')

    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain('p_actor_id IS NULL')
    expect(migration).toContain('actor.org_id = p_org_id OR actor.role = \'admin\'')
    expect(migration).toContain('FROM authenticated')
    expect(migration).toContain('TO service_role')
    expect(migration).not.toContain('TO authenticated')
  })
})
