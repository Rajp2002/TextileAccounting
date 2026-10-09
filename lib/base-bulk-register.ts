/**
 * Pure parsing and numbering for the "Add in bulk" mode of the Workers and
 * Machines add dialogs. The dialogs use it to preview a batch and the server
 * actions use it again, so both sides agree on what a batch contains.
 */

export const MAX_BULK_WORKERS = 200
export const MAX_BULK_MACHINES = 100

const WORKER_NAME_LIMIT = 120
const MAX_MONTHLY_SALARY = 10_000_000
const DEFAULT_MACHINE_PREFIX = 'Loom'

/** "1. ", "2) ", "- ", "• " or "* " at the start of a pasted list line. */
const LIST_MARKER = /^\s*(?:[-•*]|\d+[.)])\s+/
/** Name, then a comma or tab, then an optional rupee sign and a salary. */
const SALARY_LINE = /^(.*?)[,\t]\s*₹?\s*([\d,]+(?:\.\d{1,2})?)\s*$/

export type BulkWorkerRow = { name: string; monthlySalary: number }
export type BulkSkippedReason = 'repeated' | 'exists'
export type BulkSkipped = { name: string; reason: BulkSkippedReason }
export type BulkLineProblemReason = 'missing_name' | 'missing_salary' | 'invalid_salary' | 'name_too_long'
export type BulkLineProblem = { line: number; text: string; reason: BulkLineProblemReason }

export function normalizeBulkName(value: string) {
    return value.replace(/\s+/g, ' ').trim()
}

/** Matches the `lower(btrim(name))` unique index on workers and machines. */
export function bulkNameKey(value: string) {
    return normalizeBulkName(value).toLowerCase()
}

/** Splits a batch into names to create and names to leave out, in input order. */
export function partitionBulkNames<T extends { name: string }>(rows: readonly T[], existingNames: readonly string[] = []) {
    const existing = new Set(existingNames.map(bulkNameKey))
    const seen = new Set<string>()
    const fresh: T[] = []
    const skipped: BulkSkipped[] = []
    for (const row of rows) {
        const key = bulkNameKey(row.name)
        if (existing.has(key)) skipped.push({ name: row.name, reason: 'exists' })
        else if (seen.has(key)) skipped.push({ name: row.name, reason: 'repeated' })
        else fresh.push(row)
        seen.add(key)
    }
    return { fresh, skipped }
}

export function parseBulkWorkerLines(
    input: string,
    options: { payType: 'piece_rate' | 'fixed_monthly'; existingNames?: readonly string[] },
) {
    const candidates: BulkWorkerRow[] = []
    const problems: BulkLineProblem[] = []

    input.split(/\r?\n/).forEach((rawLine, index) => {
        const line = index + 1
        const text = rawLine.replace(LIST_MARKER, '').trim()
        if (!text) return

        let name = text
        let monthlySalary = 0
        if (options.payType === 'fixed_monthly') {
            const match = SALARY_LINE.exec(text)
            if (!match) {
                problems.push({ line, text, reason: 'missing_salary' })
                return
            }
            name = match[1]
            monthlySalary = Number(match[2].replace(/,/g, ''))
        }

        name = normalizeBulkName(name)
        if (!name) {
            problems.push({ line, text, reason: 'missing_name' })
            return
        }
        if (name.length > WORKER_NAME_LIMIT) {
            problems.push({ line, text, reason: 'name_too_long' })
            return
        }
        if (options.payType === 'fixed_monthly' && !(monthlySalary > 0 && monthlySalary <= MAX_MONTHLY_SALARY)) {
            problems.push({ line, text, reason: 'invalid_salary' })
            return
        }
        candidates.push({ name, monthlySalary })
    })

    const { fresh, skipped } = partitionBulkNames(candidates, options.existingNames)
    return { rows: fresh, skipped, problems }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Names for `count` new machines, "Loom #8", "Loom #9", ... Numbering continues
 * after the highest existing "<prefix> #N" so a second batch never restarts at 1.
 */
export function buildBulkMachineNames(input: { count: number; prefix?: string; existingNames: readonly string[] }) {
    if (!Number.isInteger(input.count) || input.count < 1) return []
    const prefix = normalizeBulkName(input.prefix ?? '') || DEFAULT_MACHINE_PREFIX
    const numbered = new RegExp(`^${escapeRegExp(prefix)} #(\\d+)$`, 'i')
    const taken = new Set(input.existingNames.map(bulkNameKey))

    let highest = 0
    for (const name of input.existingNames) {
        const match = numbered.exec(normalizeBulkName(name))
        if (match) highest = Math.max(highest, Number(match[1]))
    }

    const names: string[] = []
    let next = highest + 1
    while (names.length < input.count) {
        const name = `${prefix} #${next}`
        next += 1
        if (!taken.has(bulkNameKey(name))) names.push(name)
    }
    return names
}
