import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { it, expect } from 'vitest'

it('resets restored type state without touching other caches and supports cold builds', () => {
    const root = mkdtempSync(join(tmpdir(), 'weavly-build-cache-'))
    const script = resolve('scripts/reset-build-type-cache.mjs')
    try {
        // A cold checkout has no .next directory.
        execFileSync(process.execPath, [script], { cwd: root })
        mkdirSync(join(root, '.next/cache/webpack'), { recursive: true })
        writeFileSync(join(root, '.next/cache/.tsbuildinfo'), 'unusable restored type state')
        writeFileSync(join(root, '.next/cache/webpack/keep.pack'), 'webpack cache')
        writeFileSync(join(root, 'tsconfig.tsbuildinfo'), 'editor type state')
        execFileSync(process.execPath, [script], { cwd: root })
        expect(existsSync(join(root, '.next/cache/.tsbuildinfo'))).toBe(false)
        expect(readFileSync(join(root, '.next/cache/webpack/keep.pack'), 'utf8')).toBe('webpack cache')
        expect(readFileSync(join(root, 'tsconfig.tsbuildinfo'), 'utf8')).toBe('editor type state')
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})
