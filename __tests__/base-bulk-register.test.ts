import { describe, expect, it } from 'vitest'
import {
    MAX_BULK_MACHINES,
    MAX_BULK_WORKERS,
    buildBulkMachineNames,
    bulkNameKey,
    normalizeBulkName,
    parseBulkWorkerLines,
    partitionBulkNames,
} from '../lib/base-bulk-register'

describe('normalizeBulkName', () => {
    it('trims and collapses inner whitespace', () => {
        expect(normalizeBulkName('  Ramesh   Patel ')).toBe('Ramesh Patel')
    })
    it('keys names case-insensitively like the database unique index', () => {
        expect(bulkNameKey('  RAMESH  patel')).toBe('ramesh patel')
    })
})

describe('parseBulkWorkerLines (piece rate)', () => {
    it('reads one name per line and ignores blank lines', () => {
        const result = parseBulkWorkerLines('Ramesh\n\n  Suresh  \r\nMahesh\n', { payType: 'piece_rate' })
        expect(result.rows.map(row => row.name)).toEqual(['Ramesh', 'Suresh', 'Mahesh'])
        expect(result.problems).toEqual([])
        expect(result.skipped).toEqual([])
    })
    it('strips bullets and list numbers pasted from chat or notes', () => {
        const result = parseBulkWorkerLines('1. Ramesh\n2) Suresh\n- Mahesh\n• Dinesh\n* Kiran', { payType: 'piece_rate' })
        expect(result.rows.map(row => row.name)).toEqual(['Ramesh', 'Suresh', 'Mahesh', 'Dinesh', 'Kiran'])
    })
    it('keeps a comma inside a piece-rate name instead of treating it as a salary', () => {
        const result = parseBulkWorkerLines('Patel, Ramesh', { payType: 'piece_rate' })
        expect(result.rows).toEqual([{ name: 'Patel, Ramesh', monthlySalary: 0 }])
    })
    it('skips names repeated in the list, case-insensitively, keeping the first', () => {
        const result = parseBulkWorkerLines('Ramesh\nramesh\nSuresh\nRAMESH ', { payType: 'piece_rate' })
        expect(result.rows.map(row => row.name)).toEqual(['Ramesh', 'Suresh'])
        expect(result.skipped).toEqual([
            { name: 'ramesh', reason: 'repeated' },
            { name: 'RAMESH', reason: 'repeated' },
        ])
    })
    it('skips names already in the factory', () => {
        const result = parseBulkWorkerLines('Ramesh\nSuresh', { payType: 'piece_rate', existingNames: [' suresh '] })
        expect(result.rows.map(row => row.name)).toEqual(['Ramesh'])
        expect(result.skipped).toEqual([{ name: 'Suresh', reason: 'exists' }])
    })
    it('flags names longer than the 120 character limit as problems', () => {
        const result = parseBulkWorkerLines(`${'a'.repeat(121)}\nRamesh`, { payType: 'piece_rate' })
        expect(result.rows.map(row => row.name)).toEqual(['Ramesh'])
        expect(result.problems).toEqual([expect.objectContaining({ line: 1, reason: 'name_too_long' })])
    })
    it('reports the one-based line number of each problem', () => {
        const result = parseBulkWorkerLines('Ramesh\n\n' + 'b'.repeat(130), { payType: 'piece_rate' })
        expect(result.problems[0].line).toBe(3)
    })
})

describe('parseBulkWorkerLines (monthly salary)', () => {
    const options = { payType: 'fixed_monthly' as const }
    it('reads "Name, salary" lines', () => {
        const result = parseBulkWorkerLines('Ramesh, 12000\nSuresh Patel,18500.50', options)
        expect(result.rows).toEqual([
            { name: 'Ramesh', monthlySalary: 12000 },
            { name: 'Suresh Patel', monthlySalary: 18500.5 },
        ])
        expect(result.problems).toEqual([])
    })
    it('accepts tab separated pastes from a spreadsheet', () => {
        const result = parseBulkWorkerLines('Ramesh\t12000', options)
        expect(result.rows).toEqual([{ name: 'Ramesh', monthlySalary: 12000 }])
    })
    it('accepts a rupee sign and thousands separators', () => {
        const result = parseBulkWorkerLines('Ramesh, ₹12,000\nSuresh,₹ 1,05,000', options)
        expect(result.rows).toEqual([
            { name: 'Ramesh', monthlySalary: 12000 },
            { name: 'Suresh', monthlySalary: 105000 },
        ])
    })
    it('keeps extra commas in the name and reads the salary from the end', () => {
        const result = parseBulkWorkerLines('Ramesh Patel, Weaver, 12000', options)
        expect(result.rows).toEqual([{ name: 'Ramesh Patel, Weaver', monthlySalary: 12000 }])
    })
    it('flags a line with no salary', () => {
        const result = parseBulkWorkerLines('Ramesh\nSuresh, 9000', options)
        expect(result.rows.map(row => row.name)).toEqual(['Suresh'])
        expect(result.problems).toEqual([expect.objectContaining({ line: 1, text: 'Ramesh', reason: 'missing_salary' })])
    })
    it('flags a zero or oversized salary', () => {
        const result = parseBulkWorkerLines('Ramesh, 0\nSuresh, 10000001\nMahesh, 10000000', options)
        expect(result.rows.map(row => row.name)).toEqual(['Mahesh'])
        expect(result.problems.map(problem => [problem.line, problem.reason])).toEqual([[1, 'invalid_salary'], [2, 'invalid_salary']])
    })
    it('flags a salary with no name', () => {
        const result = parseBulkWorkerLines(', 12000', options)
        expect(result.rows).toEqual([])
        expect(result.problems).toEqual([expect.objectContaining({ line: 1, reason: 'missing_name' })])
    })
    it('flags a salary with more than two decimals', () => {
        const result = parseBulkWorkerLines('Ramesh, 100.123', options)
        expect(result.rows).toEqual([])
        expect(result.problems).toEqual([expect.objectContaining({ reason: 'missing_salary' })])
    })
    it('skips duplicates by name regardless of salary', () => {
        const result = parseBulkWorkerLines('Ramesh, 9000\nramesh, 12000', { ...options, existingNames: [] })
        expect(result.rows).toEqual([{ name: 'Ramesh', monthlySalary: 9000 }])
        expect(result.skipped).toEqual([{ name: 'ramesh', reason: 'repeated' }])
    })
})

describe('partitionBulkNames', () => {
    it('separates fresh names from repeated and existing ones in input order', () => {
        const { fresh, skipped } = partitionBulkNames(
            [{ name: 'Ramesh' }, { name: 'Suresh' }, { name: 'ramesh' }, { name: 'Mahesh' }],
            ['mahesh'],
        )
        expect(fresh).toEqual([{ name: 'Ramesh' }, { name: 'Suresh' }])
        expect(skipped).toEqual([
            { name: 'ramesh', reason: 'repeated' },
            { name: 'Mahesh', reason: 'exists' },
        ])
    })
})

describe('buildBulkMachineNames', () => {
    it('numbers from 1 when there are no machines yet', () => {
        expect(buildBulkMachineNames({ count: 3, existingNames: [] })).toEqual(['Loom #1', 'Loom #2', 'Loom #3'])
    })
    it('continues after the highest existing numbered name', () => {
        expect(buildBulkMachineNames({ count: 2, existingNames: ['Loom #1', 'loom #7', 'Loom #3'] })).toEqual(['Loom #8', 'Loom #9'])
    })
    it('uses a custom prefix and ignores other prefixes when numbering', () => {
        expect(buildBulkMachineNames({ count: 2, prefix: ' Rapier ', existingNames: ['Loom #12', 'Rapier #2'] })).toEqual(['Rapier #3', 'Rapier #4'])
    })
    it('treats a blank prefix as Loom', () => {
        expect(buildBulkMachineNames({ count: 1, prefix: '   ', existingNames: [] })).toEqual(['Loom #1'])
    })
    it('starts after a lone numbered machine without reusing its name', () => {
        const names = buildBulkMachineNames({ count: 3, existingNames: ['Loom #2'] })
        expect(names).toEqual(['Loom #3', 'Loom #4', 'Loom #5'])
    })
    it('does not treat regex characters in the prefix specially', () => {
        expect(buildBulkMachineNames({ count: 2, prefix: 'A.B (x)', existingNames: ['AxB (x) #9'] })).toEqual(['A.B (x) #1', 'A.B (x) #2'])
    })
    it('returns an empty list for a count that is not a whole positive number', () => {
        expect(buildBulkMachineNames({ count: 0, existingNames: [] })).toEqual([])
        expect(buildBulkMachineNames({ count: -2, existingNames: [] })).toEqual([])
        expect(buildBulkMachineNames({ count: 2.5, existingNames: [] })).toEqual([])
        expect(buildBulkMachineNames({ count: Number.NaN, existingNames: [] })).toEqual([])
    })
})

describe('limits', () => {
    it('caps one batch at 200 workers and 100 machines', () => {
        expect(MAX_BULK_WORKERS).toBe(200)
        expect(MAX_BULK_MACHINES).toBe(100)
    })
})
