import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const comparisonScript = join(process.cwd(), 'scripts/backup/compare-sanitized-inventories.sh')
const temporaryDirectories: string[] = []

// Skip the entire suite when jq is not available (e.g. Vercel build containers).
const jqAvailable = spawnSync('jq', ['--version'], { encoding: 'utf8' }).status === 0

function inventory(overrides: Record<string, unknown> = {}) {
  return {
    format_version: 1,
    domains: {
      stock: {
        rows: 2,
        organizations: 1,
        null_org_rows: 0,
        orphan_org_rows: 0,
        identity_digest: 'digest-stock',
      },
    },
    auth: {
      users: 2,
      identities: 2,
      sessions: 1,
      refresh_tokens: 3,
      users_without_profile: 0,
      profiles_without_auth_user: 0,
      identity_digest: 'digest-auth',
    },
    storage: { bucket_count: 0, object_count: 0, total_bytes: 0 },
    migrations: { count: 2, head: '20260716000000' },
    extensions: [{ name: 'pgcrypto', version: '1.3' }],
    ...overrides,
  }
}

function compare(source: object, restored: object) {
  const directory = mkdtempSync(join(tmpdir(), 'weavly-inventory-comparison-'))
  temporaryDirectories.push(directory)
  const sourcePath = join(directory, 'source.json')
  const restoredPath = join(directory, 'restored.json')
  const comparisonPath = join(directory, 'comparison.json')
  writeFileSync(sourcePath, JSON.stringify(source))
  writeFileSync(restoredPath, JSON.stringify(restored))

  const result = spawnSync('bash', [comparisonScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SANITIZED_SOURCE_INVENTORY_FILE: sourcePath,
      SANITIZED_RESTORED_INVENTORY_FILE: restoredPath,
      SANITIZED_INVENTORY_COMPARISON_FILE: comparisonPath,
    },
  })

  return {
    result,
    comparison: JSON.parse(readFileSync(comparisonPath, 'utf8')),
  }
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true })
  }
})

describe.skipIf(!jqAvailable)('sanitized backup inventory comparison', () => {
  it('passes only when normalized inventories are exactly equal', () => {
    const expected = inventory()
    const { result, comparison } = compare(expected, expected)

    expect(result.status).toBe(0)
    expect(comparison).toEqual({ exact_match: true, differences: null })
  })

  it('reports safe mismatch fields without emitting identity digests', () => {
    const source = inventory()
    const restored = inventory({
      domains: {
        stock: {
          rows: 1,
          organizations: 1,
          null_org_rows: 0,
          orphan_org_rows: 0,
          identity_digest: 'different-stock-digest',
        },
      },
      auth: {
        ...(source.auth as Record<string, unknown>),
        sessions: 0,
        identity_digest: 'different-auth-digest',
      },
      extensions: [{ name: 'pgcrypto', version: '1.4' }],
    })

    const { result, comparison } = compare(source, restored)
    const serialized = JSON.stringify(comparison)

    expect(result.status).toBe(5)
    expect(comparison.exact_match).toBe(false)
    expect(comparison.business_inventory_exact_match).toBe(false)
    expect(comparison.extension_names_match).toBe(true)
    expect(comparison.extension_version_differences).toEqual([
      { name: 'pgcrypto', source_version: '1.3', restored_version: '1.4' },
    ])
    expect(comparison.differences.domains).toEqual([
      {
        domain: 'stock',
        source: { rows: 2, organizations: 1, null_org_rows: 0, orphan_org_rows: 0 },
        restored: { rows: 1, organizations: 1, null_org_rows: 0, orphan_org_rows: 0 },
        identity_digest_match: false,
      },
    ])
    expect(comparison.differences.auth.source.sessions).toBe(1)
    expect(comparison.differences.auth.restored.sessions).toBe(0)
    expect(comparison.differences.auth.identity_digest_match).toBe(false)
    expect(comparison.differences.extensions.source[0].version).toBe('1.3')
    expect(comparison.differences.extensions.restored[0].version).toBe('1.4')
    expect(serialized).not.toContain('digest-stock')
    expect(serialized).not.toContain('different-stock-digest')
    expect(serialized).not.toContain('digest-auth')
    expect(serialized).not.toContain('different-auth-digest')
    expect(result.stdout).toBe('')
  })

  it('classifies an extension-only version variance separately from business inventory', () => {
    const source = inventory()
    const restored = inventory({
      extensions: [{ name: 'pgcrypto', version: '1.4' }],
    })

    const { result, comparison } = compare(source, restored)

    expect(result.status).toBe(5)
    expect(comparison.exact_match).toBe(false)
    expect(comparison.business_inventory_exact_match).toBe(true)
    expect(comparison.extension_names_match).toBe(true)
    expect(comparison.extension_version_differences).toEqual([
      { name: 'pgcrypto', source_version: '1.3', restored_version: '1.4' },
    ])
    expect(comparison.differences.domains).toEqual([])
    expect(comparison.differences.auth.identity_digest_match).toBe(true)
    expect(comparison.differences.storage.source).toEqual(comparison.differences.storage.restored)
    expect(comparison.differences.migrations.source).toEqual(comparison.differences.migrations.restored)
  })
})
