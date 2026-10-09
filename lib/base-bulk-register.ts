/**
 * Shared rules for the "Add in bulk" mode of the Workers and Machines add dialogs.
 * The dialogs use them to flag rows as people type and the server actions use them
 * again, so both sides agree on what a valid batch is.
 */

export const MAX_BULK_WORKERS = 200
export const MAX_BULK_MACHINES = 100
export const BULK_NAME_LIMIT = 120
export const BULK_ROLE_LIMIT = 80
export const MAX_MONTHLY_SALARY = 10_000_000

export const BASE_MACHINE_TYPE_OPTIONS = [
    { value: 'jacquard', label: 'Jacquard' },
    { value: 'power_loom', label: 'Power loom' },
    { value: 'rapier', label: 'Rapier' },
    { value: 'water_jet', label: 'Water jet' },
    { value: 'air_jet', label: 'Air jet' },
    { value: 'circular', label: 'Circular' },
    { value: 'other', label: 'Other' },
] as const
export type BaseMachineType = typeof BASE_MACHINE_TYPE_OPTIONS[number]['value']

export type BulkPieceRow = { id: string; name: string; error?: string }
export type BulkStaffRow = { id: string; name: string; role: string; monthlySalary?: number; error?: string }
export type BulkMachineRow = { id: string; name: string; error?: string }
export type BulkMachineSection = { id: string; machineType: BaseMachineType; rows: BulkMachineRow[] }

export type BulkNameIssue = 'too_long' | 'exists' | 'repeated'
export type BulkStaffIssue = {
    name?: BulkNameIssue | 'missing_name'
    role?: 'too_long'
    salary?: 'missing_salary' | 'invalid_salary'
}

export function newBulkId(prefix: string) {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function normalizeBulkName(value: string) {
    return value.replace(/\s+/g, ' ').trim()
}

/** Matches the `lower(btrim(name))` unique index on workers and machines. */
export function bulkNameKey(value: string) {
    return normalizeBulkName(value).toLowerCase()
}

/**
 * One verdict per name, in order. Blank names are ignored. A name that is already on
 * the register is `exists`; a later copy of a name seen earlier in the batch is `repeated`.
 */
export function findBulkNameIssues(names: readonly string[], existingNames: readonly string[] = []): (BulkNameIssue | null)[] {
    const existing = new Set(existingNames.map(bulkNameKey))
    const seen = new Set<string>()
    return names.map((raw) => {
        const name = normalizeBulkName(raw)
        if (!name) return null
        if (name.length > BULK_NAME_LIMIT) return 'too_long'
        const key = bulkNameKey(name)
        if (existing.has(key)) return 'exists'
        if (seen.has(key)) return 'repeated'
        seen.add(key)
        return null
    })
}

export function isValidMonthlySalary(value: number | undefined): value is number {
    if (value === undefined || !Number.isFinite(value)) return false
    if (value <= 0 || value > MAX_MONTHLY_SALARY) return false
    return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
}

/** "1. ", "2) ", "- ", "• " or "* " at the start of a pasted list line. */
const LIST_MARKER = /^\s*(?:[-•*]|\d+[.)])\s+/
/** A trailing salary: ", 12000", ", ₹12,000" or ", ₹ 1,05,000.50". */
const TRAILING_SALARY = /^(.*?),\s*₹?\s*([\d,]+(?:\.\d{1,2})?)\s*$/
const SALARY_CELL = /^₹?\s*[\d,]+(?:\.\d{1,2})?$/

function pastedLines(text: string) {
    return text
        .split(/\r?\n/)
        .map((line) => line.replace(LIST_MARKER, '').trim())
        .filter(Boolean)
}

function toSalary(text: string) {
    const value = Number(text.replace(/[₹,\s]/g, ''))
    return Number.isFinite(value) ? value : undefined
}

/** One name per pasted line. */
export function parseBulkNamePaste(text: string): string[] {
    return pastedLines(text).map(normalizeBulkName).filter(Boolean)
}

/**
 * Staff lines from a paste. Spreadsheet rows (tab separated) can come in any column order:
 * the cell that looks like an amount is the salary, the first other cell after the name is
 * the role. Comma lines read "Name, Role, Salary" or "Name, Salary". Anything else is a name.
 */
export function parseBulkStaffPaste(text: string): { name: string; role: string; monthlySalary?: number }[] {
    return pastedLines(text).flatMap((line) => {
        if (line.includes('\t')) {
            const [first, ...rest] = line.split('\t').map((cell) => cell.trim()).filter(Boolean)
            if (!first) return []
            const salaryCell = rest.find((cell) => SALARY_CELL.test(cell))
            const roleCell = rest.find((cell) => cell !== salaryCell)
            return [{ name: normalizeBulkName(first), role: roleCell ?? '', monthlySalary: salaryCell ? toSalary(salaryCell) : undefined }]
        }
        const match = TRAILING_SALARY.exec(line)
        if (!match) return [{ name: normalizeBulkName(line), role: '' }]
        const [name, ...role] = match[1].split(',').map((part) => part.trim()).filter(Boolean)
        if (!name) return []
        return [{ name: normalizeBulkName(name), role: role.join(', '), monthlySalary: toSalary(match[2]) }]
    })
}

const isBlank = (value: string | undefined) => !value || !value.trim()

export function isBulkStaffRowBlank(row: BulkStaffRow) {
    return isBlank(row.name) && isBlank(row.role) && !row.monthlySalary
}

export type BulkWorkersEvaluation = {
    piece: (BulkNameIssue | null)[]
    staff: BulkStaffIssue[]
    pieceNames: string[]
    fixedStaff: { name: string; role: string; monthlySalary: number }[]
    readyCount: number
    overLimit: number
    hasIssues: boolean
    valid: boolean
}

export function evaluateBulkWorkers(
    piece: readonly BulkPieceRow[],
    staff: readonly BulkStaffRow[],
    existingNames: readonly string[],
    joiningDate: string,
): BulkWorkersEvaluation {
    const nameIssues = findBulkNameIssues([...piece.map((row) => row.name), ...staff.map((row) => row.name)], existingNames)
    const pieceIssues = nameIssues.slice(0, piece.length)
    const staffNameIssues = nameIssues.slice(piece.length)

    const pieceNames = piece.flatMap((row, index) => !isBlank(row.name) && !pieceIssues[index] ? [normalizeBulkName(row.name)] : [])

    const fixedStaff: BulkWorkersEvaluation['fixedStaff'] = []
    const staffIssues = staff.map((row, index): BulkStaffIssue => {
        if (isBulkStaffRowBlank(row)) return {}
        const issue: BulkStaffIssue = {}
        if (isBlank(row.name)) issue.name = 'missing_name'
        else if (staffNameIssues[index]) issue.name = staffNameIssues[index]!
        if (normalizeBulkName(row.role).length > BULK_ROLE_LIMIT) issue.role = 'too_long'
        if (!row.monthlySalary) issue.salary = 'missing_salary'
        else if (!isValidMonthlySalary(row.monthlySalary)) issue.salary = 'invalid_salary'
        if (!issue.name && !issue.role && !issue.salary) {
            fixedStaff.push({ name: normalizeBulkName(row.name), role: normalizeBulkName(row.role), monthlySalary: row.monthlySalary! })
        }
        return issue
    })

    const readyCount = pieceNames.length + fixedStaff.length
    const hasIssues = pieceIssues.some(Boolean) || staffIssues.some((issue) => Object.keys(issue).length > 0)
    const overLimit = Math.max(0, readyCount - MAX_BULK_WORKERS)
    return {
        piece: pieceIssues,
        staff: staffIssues,
        pieceNames,
        fixedStaff,
        readyCount,
        overLimit,
        hasIssues,
        valid: readyCount > 0 && !hasIssues && overLimit === 0 && (fixedStaff.length === 0 || Boolean(joiningDate)),
    }
}

export type BulkMachinesEvaluation = {
    sections: (BulkNameIssue | null)[][]
    ready: { machineType: BaseMachineType; names: string[] }[]
    readyCount: number
    overLimit: number
    hasIssues: boolean
    valid: boolean
}

export function evaluateBulkMachines(sections: readonly BulkMachineSection[], existingNames: readonly string[]): BulkMachinesEvaluation {
    const issues = findBulkNameIssues(sections.flatMap((section) => section.rows.map((row) => row.name)), existingNames)
    let offset = 0
    const perSection = sections.map((section) => {
        const slice = issues.slice(offset, offset + section.rows.length)
        offset += section.rows.length
        return slice
    })

    const ready = sections
        .map((section, index) => ({
            machineType: section.machineType,
            names: section.rows.flatMap((row, rowIndex) => !isBlank(row.name) && !perSection[index][rowIndex] ? [normalizeBulkName(row.name)] : []),
        }))
        .filter((section) => section.names.length > 0)

    const readyCount = ready.reduce((total, section) => total + section.names.length, 0)
    const hasIssues = perSection.some((slice) => slice.some(Boolean))
    const overLimit = Math.max(0, readyCount - MAX_BULK_MACHINES)
    return { sections: perSection, ready, readyCount, overLimit, hasIssues, valid: readyCount > 0 && !hasIssues && overLimit === 0 }
}

/** The first machine type no section uses yet, so "Add another type" starts somewhere new. */
export function nextUnusedMachineType(used: readonly BaseMachineType[]): BaseMachineType {
    return BASE_MACHINE_TYPE_OPTIONS.find((option) => !used.includes(option.value))?.value ?? 'other'
}

export type BulkWorkersDraft = { piece: BulkPieceRow[]; staff: BulkStaffRow[]; joiningDate: string }
export type BulkMachinesDraft = { sections: BulkMachineSection[] }

export function emptyBulkWorkersDraft(today: string): BulkWorkersDraft {
    return { piece: [], staff: [], joiningDate: today }
}

export function emptyBulkMachinesDraft(): BulkMachinesDraft {
    return { sections: [{ id: newBulkId('section'), machineType: 'power_loom', rows: [] }] }
}

/** True when the owner has typed nothing yet, so closing the dialog needs no confirmation. */
export function isBulkWorkersDraftEmpty(draft: BulkWorkersDraft) {
    return draft.piece.every((row) => isBlank(row.name)) && draft.staff.every(isBulkStaffRowBlank)
}

export function isBulkMachinesDraftEmpty(draft: BulkMachinesDraft) {
    return draft.sections.every((section) => section.rows.every((row) => isBlank(row.name)))
}
