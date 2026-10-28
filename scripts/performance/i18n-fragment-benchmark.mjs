// CPU benchmark for the Hindi/Gujarati known-fragment pass (finding 9 in
// docs/performance/latency-20261028/README.md). Compares the full phrase scan
// from main@8a1dee0f's lib/i18n/context.tsx with lib/i18n/known-fragments.ts
// on the real phrase tables, asserts identical output for every string, and
// prints the time to translate a page-sized batch of new strings.
// Usage: node scripts/performance/i18n-fragment-benchmark.mjs [output.json]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createTypeScriptLoader } from './load-typescript.mjs'

const revision = '8a1dee0f7181b411f4615700b29dfa1db486767b'
const load = createTypeScriptLoader()
const { en } = load(resolve('lib/i18n/locales/en.ts'))
const locales = { hi: load(resolve('lib/i18n/locales/hi.ts')).hi, gu: load(resolve('lib/i18n/locales/gu.ts')).gu }
const { legacyPhraseTranslations } = load(resolve('lib/i18n/legacy.ts'))
const { generatedLegacyPhraseTranslations } = load(resolve('lib/i18n/legacy-generated.ts'))
const { BASE_PLAN_PHRASES } = load(resolve('lib/i18n/base-plan-phrases.ts'))
const { translateKnownFragments: indexed } = load(resolve('lib/i18n/known-fragments.ts'))

// The previous implementation, verbatim from main.
const oldContext = execFileSync('git', ['show', `${revision}:lib/i18n/context.tsx`], { encoding: 'utf8' })
const oldSource = ['function phraseBoundaryPattern', 'function translateKnownFragments'].map(signature => {
    const start = oldContext.indexOf(signature)
    const end = oldContext.indexOf('\n}\n', start) + 3
    return oldContext.slice(start, end)
}).join('\n')
const { outputText } = ts.transpileModule(`${oldSource}\nmodule.exports = { translateKnownFragments }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
const oldModule = { exports: {} }
new Function('module', 'exports', outputText)(oldModule, oldModule.exports)
const fullScan = oldModule.exports.translateKnownFragments

// Same construction as collectPhraseMap() in lib/i18n/context.tsx.
function phraseMap(language) {
    const map = new Map()
    const visit = (source, target) => {
        for (const key of Object.keys(source)) {
            if (typeof source[key] === 'string' && typeof target[key] === 'string') map.set(source[key], target[key])
            else if (source[key] && target[key] && typeof source[key] === 'object' && typeof target[key] === 'object') visit(source[key], target[key])
        }
    }
    visit(en, locales[language])
    for (const table of [generatedLegacyPhraseTranslations[language], legacyPhraseTranslations[language], BASE_PLAN_PHRASES[language]]) {
        for (const [source, target] of Object.entries(table)) map.set(source, target)
    }
    return map
}

// Texts a page shows that are not exact phrases: phrases with counts or
// names around them, two phrases joined, and plain values.
function corpus(map) {
    const phrases = [...map.keys()].filter(phrase => phrase.length >= 8)
    const texts = []
    phrases.forEach((phrase, index) => {
        if (index % 3 === 0) texts.push(`${phrase} (${index})`)
        if (index % 5 === 1) texts.push(`Loom ${index % 40}: ${phrase}`)
        if (index % 7 === 2) texts.push(`${phrase}. ${phrases[(index * 31) % phrases.length]}`)
        if (index % 11 === 3) texts.push(`Party ${index} · ${(index * 17.5).toFixed(2)} m · Rs ${index * 3}`)
    })
    return texts
}

function time(fn, texts, map) {
    const started = performance.now()
    const outputs = texts.map(text => fn(text, map))
    return { ms: performance.now() - started, outputs }
}

const report = { revision, method: 'Cold pass over each text once (no translation cache), median of 5 runs; a fresh phrase map per run so the indexed version also pays its one-time index build.', languages: {} }
for (const language of ['hi', 'gu']) {
    const texts = corpus(phraseMap(language))
    const runs = { before: [], after: [] }
    for (let run = 0; run < 5; run += 1) {
        const map = phraseMap(language)
        const before = time(fullScan, texts, map)
        const after = time(indexed, texts, phraseMap(language))
        assert.deepStrictEqual(after.outputs, before.outputs, `${language}: outputs differ`)
        runs.before.push(before.ms)
        runs.after.push(after.ms)
    }
    const median = values => [...values].sort((a, b) => a - b)[2]
    const phrases = phraseMap(language).size
    report.languages[language] = {
        phrases, texts: texts.length,
        beforeMs: Math.round(median(runs.before)), afterMs: Math.round(median(runs.after)),
        beforePerTextMs: +(median(runs.before) / texts.length).toFixed(3), afterPerTextMs: +(median(runs.after) / texts.length).toFixed(3),
    }
    console.log(`${language}: ${phrases} phrases, ${texts.length} texts, full scan ${report.languages[language].beforeMs} ms, indexed ${report.languages[language].afterMs} ms, identical output`)
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2))
