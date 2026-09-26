// Fail CI only on lint diagnostics that a change introduces. Each changed file
// is linted as it is now and as it was at the base commit; diagnostics are
// compared by rule, severity and message, so shifted line numbers do not count.
// Existing debt in a touched file is reported but does not fail the job.
// Usage: node scripts/ci/lint-changed.mjs [base-commit]
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LINTED_FILE = /\.(?:[cm]?[jt]sx?)$/

function git(args) {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function isCommit(ref) {
    try {
        git(['cat-file', '-e', `${ref}^{commit}`])
        return true
    } catch {
        return false
    }
}

export function resolveBase(candidates) {
    for (const candidate of candidates) {
        if (candidate && !/^0+$/.test(candidate) && isCommit(candidate)) return candidate
    }
    return git(['merge-base', 'origin/main', 'HEAD']).trim()
}

/** Parses `git diff -z --name-status -M` output into { path, basePath } pairs. */
export function parseNameStatus(output) {
    const fields = output.split('\0').filter(Boolean)
    const files = []
    for (let index = 0; index < fields.length;) {
        const status = fields[index++]
        if (status.startsWith('R') || status.startsWith('C')) {
            const basePath = fields[index++]
            const path = fields[index++]
            files.push({ path, basePath: status.startsWith('R') ? basePath : null })
        } else {
            const path = fields[index++]
            if (status !== 'D') files.push({ path, basePath: status === 'A' ? null : path })
        }
    }
    return files.filter(file => LINTED_FILE.test(file.path))
}

function diagnosticKey(message) {
    return `${message.ruleId ?? 'fatal'}|${message.severity}|${message.message}`
}

/** Returns head diagnostics whose rule/severity/message count exceeds the base count. */
export function newDiagnostics(baseMessages, headMessages) {
    const remaining = new Map()
    for (const message of baseMessages) {
        const key = diagnosticKey(message)
        remaining.set(key, (remaining.get(key) ?? 0) + 1)
    }
    const introduced = []
    for (const message of headMessages) {
        const key = diagnosticKey(message)
        const count = remaining.get(key) ?? 0
        if (count > 0) remaining.set(key, count - 1)
        else introduced.push(message)
    }
    return introduced
}

function escapeAnnotation(value) {
    return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

async function main() {
    const { ESLint } = await import('eslint')
    const base = resolveBase([process.argv[2], process.env.PR_BASE_SHA, process.env.PUSH_BEFORE_SHA])
    const files = parseNameStatus(git(['diff', '-z', '--name-status', '-M', base, 'HEAD']))
    if (files.length === 0) {
        console.log(`No changed JavaScript or TypeScript files since ${base}.`)
        return 0
    }

    const eslint = new ESLint({ warnIgnored: false })
    let introducedCount = 0
    let existingCount = 0
    for (const file of files) {
        if (await eslint.isPathIgnored(file.path)) continue
        const [head] = await eslint.lintFiles([file.path])
        const baseMessages = file.basePath
            ? (await eslint.lintText(git(['show', `${base}:${file.basePath}`]), { filePath: file.path }))[0]?.messages ?? []
            : []
        const headMessages = head?.messages ?? []
        const introduced = newDiagnostics(baseMessages, headMessages)
        introducedCount += introduced.length
        existingCount += headMessages.length - introduced.length
        for (const message of introduced) {
            const level = message.severity === 2 ? 'error' : 'warning'
            console.log(`::error file=${file.path},line=${message.line ?? 1},col=${message.column ?? 1}::${escapeAnnotation(`${level} ${message.ruleId ?? 'parse'}: ${message.message}`)}`)
        }
    }

    console.log(`Linted ${files.length} changed file(s) against ${base}: ${introducedCount} new diagnostic(s), ${existingCount} pre-existing.`)
    return introducedCount === 0 ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    main().then(code => { process.exitCode = code }, error => {
        console.error(error)
        process.exitCode = 1
    })
}
