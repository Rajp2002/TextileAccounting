/**
 * Finds English copy on Lite screens that has no complete Hindi or Gujarati
 * translation. Lite routes never translate word by word (lib/i18n/lite-surface.ts),
 * so a sentence missing here shows in English to a Hindi or Gujarati reader.
 *
 * Used by __tests__/lite-translation-coverage.test.ts. Run it directly to list
 * what is missing:
 *   node_modules/.bin/jiti scripts/i18n/lite-copy-audit.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

/** Route folders and files that make up the Lite product. */
export const LITE_COPY_ENTRIES = [
    'app/(dashboard)/owner/estimator',
    'app/(dashboard)/owner/quotes',
    'app/(dashboard)/owner/rates',
    'app/(dashboard)/owner/settings',
    'app/(dashboard)/owner/billing',
    'app/(dashboard)/owner/layout.tsx',
    'app/(auth)/onboarding/page.tsx',
    'app/(auth)/onboarding/layout.tsx',
    'app/(auth)/onboarding/plans',
    'app/(auth)/signup',
    'app/(plan-selection)',
]

/**
 * Files reached through imports that put no Lite copy on screen: Base-only
 * modules, guided tours (their copy lives in their own Hindi/Gujarati tables),
 * the PDF document builder (rendered outside the page), logging and data
 * plumbing.
 */
const EXCLUDED_FILES = [
    /^lib\/i18n\//,
    /^lib\/supabase\//,
    /onboarding\/base\//,
    /settings\/supervisor-actions\.ts$/,
    /settings\/audit\//,
    /owner\/production\//,
    /^lib\/base-/,
    /^lib\/(payroll-cycle-engine|stock-navigation|production-mode|challan-payment-terms|terminology|audit-summaries|db|client-storage-cleanup|rate-limit|auth-cache-scope|legal-operator|legal-documents|upgrade-wall|estimator-export|costing-export-model|estimator-tour|rate-book-tour|saved-costings-tour)\.ts$/,
    /^lib\/admin\//,
    // Server-only PDF builders (PR #232): number formats, SVG and CSS, no screen copy.
    /^lib\/document-branding\//,
    /^lib\/document-pdf\.ts$/,
    /^lib\/tours\//,
    /^components\/settings\/(payroll|supervisors)\//,
    /^components\/stock\//,
    /^components\/ui\/audit-diff\.tsx$/,
    /^components\/auth\/auth-handoff\.ts$/,
    /^components\/(estimator\/SavedCostingsTutorial|rates\/RateBookTutorial)\.tsx$/,
]

/** JSX attributes whose values never reach the reader. */
const SKIPPED_ATTRIBUTES = new Set(['className', 'id', 'key', 'href', 'type', 'name', 'role', 'variant', 'size', 'side', 'align', 'inputMode', 'autoComplete', 'pattern', 'src', 'method', 'target', 'rel', 'enterKeyHint', 'form', 'htmlFor', 'value', 'defaultValue', 'icon', 'tone', 'mode', 'as', 'd', 'fill', 'stroke', 'viewBox', 'accept', 'dir', 'lang', 'sizes', 'transform', 'points'])

const IGNORED_CALLEES = /^(t|cn|clsx|require|revalidatePath|redirect|trackPlanEvent|console\.\w+|Sentry\.\w+|logger\.\w+|.*\.(eq|from|select|order|rpc|in|is|neq|match|ilike|like|contains|filter|gte|lte|gt|lt|single|maybeSingle|startsWith|endsWith|includes|split|join|get|has|set|delete|getItem|setItem|removeItem|addEventListener|removeEventListener|querySelector|querySelectorAll|closest|matches|getAttribute|setAttribute|toLocaleString|toLocaleDateString|padStart|padEnd|replace|replaceAll|log|warn|error|info|debug|captureException|captureMessage|t))$/

export type LiteCopy = { text: string; file: string; line: number }

function listFiles(root: string, entry: string): string[] {
    const absolute = path.join(root, entry)
    if (!fs.existsSync(absolute)) return []
    if (fs.statSync(absolute).isFile()) return [entry]
    return fs.readdirSync(absolute).flatMap(name => listFiles(root, path.join(entry, name)))
}

function resolveImport(root: string, from: string, specifier: string) {
    const base = specifier.startsWith('@/') ? specifier.slice(2) : specifier.startsWith('.') ? path.join(path.dirname(from), specifier) : undefined
    if (!base) return undefined
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
        const absolute = path.join(root, candidate)
        if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return path.normalize(candidate)
    }
    return undefined
}

function parse(root: string, file: string) {
    return ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

/** Lite source files: the entries plus everything they import, minus exclusions. */
export function collectLiteFiles(root = process.cwd()) {
    const seen = new Set<string>()
    const queue = LITE_COPY_ENTRIES.flatMap(entry => listFiles(root, entry)).filter(file => /\.tsx?$/.test(file))
    while (queue.length) {
        const file = queue.shift()!
        if (seen.has(file) || !/^(app|components|lib)\//.test(file) || EXCLUDED_FILES.some(rule => rule.test(file))) continue
        seen.add(file)
        parse(root, file).forEachChild(function visit(node) {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return
                const resolved = resolveImport(root, file, node.moduleSpecifier.text)
                if (resolved) queue.push(resolved)
            }
            node.forEachChild(visit)
        })
    }
    return [...seen].sort()
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', bull: '•', copy: '©', nbsp: ' ', middot: '·', rarr: '→', times: '×' }
const normalize = (text: string) => text.replace(/&(\w+);/g, (entity, name: string) => ENTITIES[name] ?? entity).replace(/\s+/g, ' ').trim()

/** Heuristic: does this literal look like words a person reads? */
export function looksLikeCopy(text: string) {
    if (!/[A-Za-z]{2}/.test(text)) return false
    if (/[ऀ-ॿ઀-૿]/.test(text)) return false
    if (/^(use client|use server)$/.test(text)) return false
    if (/^[a-z0-9_.:/#@-]+$/.test(text) || /^[a-z][a-zA-Z0-9]*$/.test(text)) return false
    if (/^(https?:|\/|#|\.|@)/.test(text)) return false
    if (/^[A-Z0-9_]+$/.test(text) && text.length > 3) return false
    if (/\w+_\w+/.test(text) && text.includes(',') && !/[.!?]$/.test(text)) return false
    if (/^\[[^\]]+\]/.test(text)) return false
    if (/^(\{\w+\}[\s,/·:-]*)+$/.test(text)) return false
    if (/\((prefers-|max-width|min-width|display-mode|pointer)/.test(text)) return false
    if (/\bvar\(--|rgba?\(/.test(text)) return false
    if (/\b(flex|grid|px-|py-|text-|bg-|border|rounded|items-|gap-|w-|h-|min-|max-|hidden|sm:|md:|lg:)/.test(text) && /-/.test(text) && !/[.!?]$/.test(text)) return false
    return true
}

/** Every literal on Lite screens that reads as copy, with `{n}` for template values. */
export function collectLiteCopy(root = process.cwd()): LiteCopy[] {
    const copy: LiteCopy[] = []
    for (const file of collectLiteFiles(root)) {
        const source = parse(root, file)
        const add = (node: ts.Node, raw: string) => {
            const text = normalize(raw)
            if (looksLikeCopy(text)) copy.push({ text, file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 })
        }
        source.forEachChild(function visit(node) {
            if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
            if (ts.isJsxText(node)) add(node, node.text)
            else if (ts.isJsxAttribute(node)) {
                const name = node.name.getText()
                if (SKIPPED_ATTRIBUTES.has(name) || name.startsWith('data-')) return
                if (node.initializer && ts.isStringLiteral(node.initializer)) return add(node, node.initializer.text)
            } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                const parent = node.parent
                if (ts.isPropertyAssignment(parent) && parent.name === node) return
                if (ts.isElementAccessExpression(parent) || ts.isLiteralTypeNode(parent) || ts.isCaseClause(parent)) return
                if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(parent.operatorToken.kind)) return
                if (ts.isCallExpression(parent) && IGNORED_CALLEES.test(parent.expression.getText())) return
                add(node, node.text)
            } else if (ts.isTemplateExpression(node)) {
                const text = [node.head.text, ...node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`)].join('')
                if (/[A-Za-z]{3,} [A-Za-z]{2,}/.test(text)) add(node, text)
            }
            node.forEachChild(visit)
        })
    }
    return copy
}

if (process.argv[1] && /lite-copy-audit\.ts$/.test(process.argv[1])) {
    void import('./lite-copy-coverage').then(({ findUntranslatedLiteCopy }) => {
        const missing = findUntranslatedLiteCopy()
        for (const item of missing) console.log(`${item.file}:${item.line}  ${item.text}`)
        console.log(`${missing.length} Lite strings without a complete Hindi and Gujarati translation`)
    })
}
