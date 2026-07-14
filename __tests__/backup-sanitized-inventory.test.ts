import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const captureScript = join(process.cwd(), 'scripts/backup/capture-sanitized-inventory.sh')
const temporaryDirectories: string[] = []

type StorageCounts = {
  bucket_count: number
  object_count: number
  total_bytes: number
}

function inventory(storage: Partial<StorageCounts> = {}) {
  return {
    format_version: 1,
    domains: {},
    auth: {},
    storage: {
      bucket_count: 0,
      object_count: 0,
      total_bytes: 0,
      ...storage,
    },
    migrations: { count: 0, head: null },
    extensions: [],
  }
}

function runCapture(stdout: string, stderr = '', exitCode = 0) {
  const directory = mkdtempSync(join(tmpdir(), 'weavly-inventory-test-'))
  temporaryDirectories.push(directory)
  const binDirectory = join(directory, 'bin')
  const psqlPath = join(binDirectory, 'psql')
  const sqlPath = join(directory, 'inventory.sql')
  const outputPath = join(directory, 'inventory.json')
  const stderrPath = join(directory, 'psql.stderr')
  const argsPath = join(directory, 'psql.args')
  mkdirSync(binDirectory)
  writeFileSync(sqlPath, 'select 1;\n')
  writeFileSync(
    psqlPath,
    `#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\\n' "$*" > "$MOCK_PSQL_ARGS_FILE"
printf '%s' "$MOCK_PSQL_STDOUT"
printf '%s' "$MOCK_PSQL_STDERR" >&2
exit "$MOCK_PSQL_EXIT_CODE"
`
  )
  chmodSync(psqlPath, 0o755)

  const result = spawnSync('bash', [captureScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      MOCK_PSQL_ARGS_FILE: argsPath,
      MOCK_PSQL_STDOUT: stdout,
      MOCK_PSQL_STDERR: stderr,
      MOCK_PSQL_EXIT_CODE: String(exitCode),
      SANITIZED_INVENTORY_DB_URL: 'mock://fixture_user:sentinel_password@fixture_host/fixture_database',
      SANITIZED_INVENTORY_SQL_FILE: sqlPath,
      SANITIZED_INVENTORY_OUTPUT_FILE: outputPath,
      SANITIZED_INVENTORY_STDERR_FILE: stderrPath,
    },
  })

  return { result, outputPath, stderrPath, argsPath }
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true })
  }
})

describe('sanitized backup inventory capture', () => {
  it('generates one compact JSON object at the SQL source and shares capture logic', () => {
    const sql = readFileSync('scripts/backup/sql/sanitized_inventory.sql', 'utf8')
    const backup = readFileSync('scripts/backup/create-supabase-logical-backup.sh', 'utf8')
    const restore = readFileSync('scripts/backup/restore-supabase-logical-backup.sh', 'utf8')

    expect(sql).toContain('SELECT jsonb_build_object(')
    expect(sql).not.toContain('jsonb_pretty')
    expect(backup).toContain('capture-sanitized-inventory.sh')
    expect(restore).toContain('capture-sanitized-inventory.sh')
  })

  it('emits valid JSON and allows continuation for zero Storage counts', () => {
    const expected = inventory()
    const { result, outputPath, argsPath } = runCapture(JSON.stringify(expected))

    expect(result.status).toBe(0)
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(expected)
    expect(result.stdout).toContain('zero buckets, zero objects, zero bytes')
    expect(readFileSync(argsPath, 'utf8')).toContain('--no-psqlrc')
    expect(readFileSync(argsPath, 'utf8')).toContain('--tuples-only')
    expect(readFileSync(argsPath, 'utf8')).toContain('--no-align')
    expect(readFileSync(argsPath, 'utf8')).toContain('--quiet')
    expect(readFileSync(argsPath, 'utf8')).toContain('--set ON_ERROR_STOP=1')
  })

  it('fails closed when Storage contains objects', () => {
    const { result, outputPath } = runCapture(JSON.stringify(inventory({ object_count: 1 })))

    expect(result.status).toBe(3)
    expect(existsSync(outputPath)).toBe(false)
    expect(result.stderr).toContain('Storage inventory is non-zero')
    expect(result.stderr).not.toContain('object_count')
  })

  it('fails closed for aligned or otherwise malformed psql output', () => {
    const malformed = ' {                    +\n   "format_version": 1 +\n }\n'
    const { result, outputPath } = runCapture(malformed)

    expect(result.status).toBe(5)
    expect(existsSync(outputPath)).toBe(false)
    expect(result.stderr).toContain('output was not valid expected JSON')
    expect(result.stderr).not.toContain(malformed.trim())
  })

  it('fails closed when required Storage fields are missing', () => {
    const missing = inventory()
    delete (missing.storage as Partial<StorageCounts>).total_bytes
    const { result, outputPath } = runCapture(JSON.stringify(missing))

    expect(result.status).toBe(5)
    expect(existsSync(outputPath)).toBe(false)
  })

  it('fails closed when psql returns more than one JSON row', () => {
    const multipleRows = `${JSON.stringify(inventory())}\n${JSON.stringify(inventory())}\n`
    const { result, outputPath } = runCapture(multipleRows)

    expect(result.status).toBe(5)
    expect(existsSync(outputPath)).toBe(false)
  })

  it.each([
    { bucket_count: -1 },
    { object_count: 0.5 },
    { total_bytes: '0' },
  ])('rejects non-integer or invalid Storage counts: %o', (invalid) => {
    const candidate = inventory() as Record<string, unknown> & {
      storage: Record<string, unknown>
    }
    Object.assign(candidate.storage, invalid)
    const { result } = runCapture(JSON.stringify(candidate))

    expect(result.status).toBe(5)
  })

  it('keeps psql stderr separate from the JSON file and sanitized workflow output', () => {
    const notice = 'NOTICE: synthetic warning for Unicode relation કાપડ\n'
    const { result, outputPath, stderrPath } = runCapture(JSON.stringify(inventory()), notice)

    expect(result.status).toBe(0)
    expect(() => JSON.parse(readFileSync(outputPath, 'utf8'))).not.toThrow()
    expect(readFileSync(outputPath, 'utf8')).not.toContain('NOTICE')
    expect(readFileSync(stderrPath, 'utf8')).toBe(notice)
    expect(result.stdout).not.toContain(notice.trim())
    expect(result.stderr).not.toContain(notice.trim())
  })

  it('fails closed without echoing psql stderr when the query command fails', () => {
    const diagnostic = 'synthetic connection diagnostic that must remain private\n'
    const { result, outputPath, stderrPath } = runCapture('', diagnostic, 7)

    expect(result.status).toBe(4)
    expect(existsSync(outputPath)).toBe(false)
    expect(readFileSync(stderrPath, 'utf8')).toBe(diagnostic)
    expect(result.stderr).toContain('database output was withheld')
    expect(result.stderr).not.toContain(diagnostic.trim())
  })

  it('accepts valid JSON with unusual whitespace and Unicode identifiers', () => {
    const candidate = inventory() as ReturnType<typeof inventory> & {
      domains: Record<string, unknown>
    }
    candidate.domains['કાપડ વિભાગ'] = { rows: 0, identity_digest: 'synthetic' }
    const formatted = `\n  ${JSON.stringify(candidate, null, 2)}\n\t`
    const { result, outputPath } = runCapture(formatted)

    expect(result.status).toBe(0)
    expect(JSON.parse(readFileSync(outputPath, 'utf8')).domains).toHaveProperty('કાપડ વિભાગ')
  })

  it('does not echo the database URL or fixture credential', () => {
    const { result } = runCapture(JSON.stringify(inventory()))
    const combined = `${result.stdout}\n${result.stderr}`

    expect(combined).not.toContain('mock://')
    expect(combined).not.toContain('sentinel_password')
  })
})
