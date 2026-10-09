import { describe, expect, it } from 'vitest'
import {
    BASE_MACHINE_TYPE_OPTIONS,
    MAX_BULK_MACHINES,
    MAX_BULK_WORKERS,
    bulkNameKey,
    emptyBulkMachinesDraft,
    emptyBulkWorkersDraft,
    evaluateBulkMachines,
    evaluateBulkWorkers,
    findBulkNameIssues,
    isBulkMachinesDraftEmpty,
    isBulkWorkersDraftEmpty,
    isValidMonthlySalary,
    nextUnusedMachineType,
    normalizeBulkName,
    parseBulkNamePaste,
    parseBulkStaffPaste,
    type BulkMachineSection,
    type BulkPieceRow,
    type BulkStaffRow,
} from '../lib/base-bulk-register'

const piece = (...names: string[]): BulkPieceRow[] => names.map((name, index) => ({ id: `p${index}`, name }))
const staff = (...rows: [string, string, number?][]): BulkStaffRow[] => rows.map(([name, role, monthlySalary], index) => ({ id: `s${index}`, name, role, monthlySalary }))
const section = (machineType: BulkMachineSection['machineType'], ...names: string[]): BulkMachineSection => ({ id: machineType, machineType, rows: names.map((name, index) => ({ id: `${machineType}${index}`, name })) })

describe('names', () => {
    it('trims and collapses inner whitespace', () => {
        expect(normalizeBulkName('  Ramesh   Patel ')).toBe('Ramesh Patel')
    })
    it('keys names case-insensitively like the database unique index', () => {
        expect(bulkNameKey('  RAMESH  patel')).toBe('ramesh patel')
    })
})

describe('findBulkNameIssues', () => {
    it('ignores blank names and passes fresh ones', () => {
        expect(findBulkNameIssues(['Ramesh', '', '   ', 'Suresh'])).toEqual([null, null, null, null])
    })
    it('flags names already on the register, case-insensitively', () => {
        expect(findBulkNameIssues(['Ramesh', 'Suresh'], [' suresh '])).toEqual([null, 'exists'])
    })
    it('flags only the later copy of a repeated name', () => {
        expect(findBulkNameIssues(['Ramesh', 'ramesh', 'Suresh', 'RAMESH '])).toEqual([null, 'repeated', null, 'repeated'])
    })
    it('flags names over 120 characters', () => {
        expect(findBulkNameIssues(['a'.repeat(121), 'a'.repeat(120)])).toEqual(['too_long', null])
    })
})

describe('isValidMonthlySalary', () => {
    it('accepts positive amounts up to 1 crore with at most two decimals', () => {
        for (const value of [1, 12000, 18500.5, 18500.55, 10_000_000]) expect(isValidMonthlySalary(value)).toBe(true)
    })
    it('rejects zero, negatives, too large, more decimals and nothing', () => {
        for (const value of [0, -5, 10_000_001, 100.123, Number.NaN, undefined]) expect(isValidMonthlySalary(value)).toBe(false)
    })
})

describe('parseBulkNamePaste', () => {
    it('reads one name per line, skipping blanks', () => {
        expect(parseBulkNamePaste('Ramesh\n\n  Suresh  \r\nMahesh\n')).toEqual(['Ramesh', 'Suresh', 'Mahesh'])
    })
    it('strips bullets and list numbers from chat or notes', () => {
        expect(parseBulkNamePaste('1. Ramesh\n2) Suresh\n- Mahesh\n• Dinesh\n* Kiran')).toEqual(['Ramesh', 'Suresh', 'Mahesh', 'Dinesh', 'Kiran'])
    })
    it('keeps machine numbers that start with digits', () => {
        expect(parseBulkNamePaste('01\n02\n10A')).toEqual(['01', '02', '10A'])
    })
})

describe('parseBulkStaffPaste', () => {
    it('reads "Name, Role, Salary" comma lines', () => {
        expect(parseBulkStaffPaste('Ramesh, Supervisor, 18000\nSuresh Patel, Weaving master, ₹22,500')).toEqual([
            { name: 'Ramesh', role: 'Supervisor', monthlySalary: 18000 },
            { name: 'Suresh Patel', role: 'Weaving master', monthlySalary: 22500 },
        ])
    })
    it('reads "Name, Salary" and plain names', () => {
        expect(parseBulkStaffPaste('Mahesh, 15000\nDinesh')).toEqual([
            { name: 'Mahesh', role: '', monthlySalary: 15000 },
            { name: 'Dinesh', role: '' },
        ])
    })
    it('reads spreadsheet rows in any column order', () => {
        expect(parseBulkStaffPaste('Ramesh\tSupervisor\t18000\nSuresh\t22,000\tManager\nMahesh\t15000')).toEqual([
            { name: 'Ramesh', role: 'Supervisor', monthlySalary: 18000 },
            { name: 'Suresh', role: 'Manager', monthlySalary: 22000 },
            { name: 'Mahesh', role: '', monthlySalary: 15000 },
        ])
    })
    it('keeps extra commas in a role', () => {
        expect(parseBulkStaffPaste('Ramesh, Shift, night, 9000')).toEqual([{ name: 'Ramesh', role: 'Shift, night', monthlySalary: 9000 }])
    })
})

describe('evaluateBulkWorkers', () => {
    it('counts ready piece-rate names and fixed staff and ignores blank rows', () => {
        const result = evaluateBulkWorkers(piece('Ramesh', '', 'Suresh'), staff(['Mahesh', 'Supervisor', 18000], ['', '']), [], '2026-10-10')
        expect(result.pieceNames).toEqual(['Ramesh', 'Suresh'])
        expect(result.fixedStaff).toEqual([{ name: 'Mahesh', role: 'Supervisor', monthlySalary: 18000 }])
        expect(result.readyCount).toBe(3)
        expect(result.hasIssues).toBe(false)
        expect(result.valid).toBe(true)
    })
    it('is not valid when nothing is entered', () => {
        expect(evaluateBulkWorkers(piece(''), staff(['', '']), [], '2026-10-10').valid).toBe(false)
    })
    it('flags repeats across both sections, keeping the first', () => {
        const result = evaluateBulkWorkers(piece('Ramesh'), staff(['ramesh', 'Supervisor', 18000]), [], '2026-10-10')
        expect(result.staff[0]).toEqual({ name: 'repeated' })
        expect(result.valid).toBe(false)
    })
    it('flags names already on the register in either section', () => {
        const result = evaluateBulkWorkers(piece('Ramesh'), staff(['Suresh', '', 9000]), ['RAMESH', 'suresh'], '2026-10-10')
        expect(result.piece).toEqual(['exists'])
        expect(result.staff[0].name).toBe('exists')
        expect(result.hasIssues).toBe(true)
    })
    it('needs a name and a valid salary for a fixed row that has anything in it', () => {
        const result = evaluateBulkWorkers([], staff(['', 'Supervisor', 9000], ['Mahesh', '', undefined], ['Dinesh', '', 100.123], ['Kiran', '', 0]), [], '2026-10-10')
        expect(result.staff).toEqual([
            { name: 'missing_name' },
            { salary: 'missing_salary' },
            { salary: 'invalid_salary' },
            { salary: 'missing_salary' },
        ])
        expect(result.valid).toBe(false)
    })
    it('flags a role over 80 characters', () => {
        expect(evaluateBulkWorkers([], staff(['Mahesh', 'r'.repeat(81), 9000]), [], '2026-10-10').staff[0]).toEqual({ role: 'too_long' })
    })
    it('needs a joining date only when there is fixed staff', () => {
        expect(evaluateBulkWorkers(piece('Ramesh'), [], [], '').valid).toBe(true)
        expect(evaluateBulkWorkers([], staff(['Mahesh', '', 9000]), [], '').valid).toBe(false)
    })
    it('blocks a batch over the cap and says by how many', () => {
        const names = Array.from({ length: MAX_BULK_WORKERS + 3 }, (_, index) => `Worker ${index}`)
        const result = evaluateBulkWorkers(piece(...names), [], [], '2026-10-10')
        expect(result.overLimit).toBe(3)
        expect(result.valid).toBe(false)
    })
})

describe('evaluateBulkMachines', () => {
    it('groups ready names by section and skips blank rows and empty sections', () => {
        const result = evaluateBulkMachines([section('power_loom', '01', '02', ''), section('rapier', ''), section('water_jet', 'WJ-1')], [])
        expect(result.ready).toEqual([
            { machineType: 'power_loom', names: ['01', '02'] },
            { machineType: 'water_jet', names: ['WJ-1'] },
        ])
        expect(result.readyCount).toBe(3)
        expect(result.valid).toBe(true)
    })
    it('flags a name repeated in another section, because names are unique across the factory', () => {
        const result = evaluateBulkMachines([section('power_loom', '01'), section('rapier', '01')], [])
        expect(result.sections).toEqual([[null], ['repeated']])
        expect(result.valid).toBe(false)
    })
    it('flags names already on the register', () => {
        const result = evaluateBulkMachines([section('power_loom', 'Loom #1', '02')], ['loom #1'])
        expect(result.sections).toEqual([['exists', null]])
        expect(result.hasIssues).toBe(true)
    })
    it('is not valid when nothing is entered and blocks a batch over the cap', () => {
        expect(evaluateBulkMachines([section('power_loom', '')], []).valid).toBe(false)
        const names = Array.from({ length: MAX_BULK_MACHINES + 2 }, (_, index) => `M${index}`)
        const result = evaluateBulkMachines([section('power_loom', ...names)], [])
        expect(result.overLimit).toBe(2)
        expect(result.valid).toBe(false)
    })
})

describe('machine types', () => {
    it('offers the same seven types the single form does', () => {
        expect(BASE_MACHINE_TYPE_OPTIONS.map((option) => option.value)).toEqual(['jacquard', 'power_loom', 'rapier', 'water_jet', 'air_jet', 'circular', 'other'])
    })
    it('starts a new section on the first type not already used', () => {
        expect(nextUnusedMachineType([])).toBe('jacquard')
        expect(nextUnusedMachineType(['jacquard', 'power_loom'])).toBe('rapier')
        expect(nextUnusedMachineType(BASE_MACHINE_TYPE_OPTIONS.map((option) => option.value))).toBe('other')
    })
})

describe('limits', () => {
    it('caps one batch at 200 workers and 100 machines', () => {
        expect(MAX_BULK_WORKERS).toBe(200)
        expect(MAX_BULK_MACHINES).toBe(100)
    })
})

describe('bulk drafts', () => {
    it('start empty and stay empty until a cell has text', () => {
        expect(isBulkWorkersDraftEmpty(emptyBulkWorkersDraft('2026-10-10'))).toBe(true)
        expect(isBulkMachinesDraftEmpty(emptyBulkMachinesDraft())).toBe(true)
        expect(isBulkWorkersDraftEmpty({ ...emptyBulkWorkersDraft('2026-10-10'), piece: piece('', '  ') })).toBe(true)
    })
    it('count any typed name, role or salary as a change', () => {
        expect(isBulkWorkersDraftEmpty({ ...emptyBulkWorkersDraft('2026-10-10'), piece: piece('Ramesh') })).toBe(false)
        expect(isBulkWorkersDraftEmpty({ ...emptyBulkWorkersDraft('2026-10-10'), staff: staff(['', '', 9000]) })).toBe(false)
        expect(isBulkMachinesDraftEmpty({ sections: [section('rapier', '01')] })).toBe(false)
    })
    it('open with one power loom section and the joining date set to today', () => {
        expect(emptyBulkMachinesDraft().sections.map((entry) => entry.machineType)).toEqual(['power_loom'])
        expect(emptyBulkWorkersDraft('2026-10-10').joiningDate).toBe('2026-10-10')
    })
})
