import { describe, expect, it } from 'vitest'
import { newDiagnostics, parseNameStatus } from '../scripts/ci/lint-changed.mjs'

const unused = (name: string, line: number) => ({
    ruleId: '@typescript-eslint/no-unused-vars',
    severity: 1,
    message: `'${name}' is assigned a value but never used.`,
    line,
})

describe('CI changed-file lint ratchet', () => {
    it('ignores pre-existing diagnostics even when their lines move', () => {
        expect(newDiagnostics([unused('a', 10), unused('b', 20)], [unused('b', 25), unused('a', 12)])).toEqual([])
    })

    it('reports only the diagnostics a change adds', () => {
        const added = unused('c', 30)
        expect(newDiagnostics([unused('a', 10)], [unused('a', 11), added])).toEqual([added])
    })

    it('counts repeated identical diagnostics instead of collapsing them', () => {
        const baseMessages = [{ ruleId: 'x', severity: 2, message: 'same', line: 1 }]
        const headMessages = [
            { ruleId: 'x', severity: 2, message: 'same', line: 1 },
            { ruleId: 'x', severity: 2, message: 'same', line: 9 },
        ]
        expect(newDiagnostics(baseMessages, headMessages)).toEqual([headMessages[1]])
    })

    it('treats a warning that becomes an error as new', () => {
        const error = { ...unused('a', 10), severity: 2 }
        expect(newDiagnostics([unused('a', 10)], [error])).toEqual([error])
    })

    it('reports parse failures, which have no rule id', () => {
        const fatal = { ruleId: null, severity: 2, message: 'Parsing error: Unexpected token', line: 3 }
        expect(newDiagnostics([], [fatal])).toEqual([fatal])
    })

    it('maps added, modified, renamed and deleted files to their base paths', () => {
        const output = [
            'A', 'app/(dashboard)/owner/new.tsx',
            'M', 'lib/estimator.ts',
            'R087', 'lib/old-name.ts', 'lib/new-name.ts',
            'D', 'lib/removed.ts',
            'M', 'docs/readme.md',
            'C100', 'lib/source.mjs', 'lib/copy.mjs',
        ].join('\0') + '\0'
        expect(parseNameStatus(output)).toEqual([
            { path: 'app/(dashboard)/owner/new.tsx', basePath: null },
            { path: 'lib/estimator.ts', basePath: 'lib/estimator.ts' },
            { path: 'lib/new-name.ts', basePath: 'lib/old-name.ts' },
            { path: 'lib/copy.mjs', basePath: null },
        ])
    })
})
