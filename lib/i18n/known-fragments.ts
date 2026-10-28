/**
 * Replaces every known phrase (8+ characters) that occurs in an English text
 * with its translation, longest phrase first, at word boundaries. Returns
 * undefined when nothing changed.
 *
 * The phrase table has thousands of entries, so scanning all of them for
 * every new text is slow on phones. The table is indexed once per phrase map
 * by each phrase's first four characters: a text can contain a phrase only
 * if it contains that phrase's first four characters. The candidates are then
 * checked and ordered exactly as a full scan would (length descending, ties
 * in phrase-map order), so the output is the same.
 */
type FragmentIndex = {
    buckets: Map<string, number[]>
    phrases: string[]
    replacements: string[]
    patterns: Array<ReturnType<typeof phraseBoundaryPattern> | undefined>
}

const MIN_PHRASE_LENGTH = 8
const KEY_LENGTH = 4
const indexes = new WeakMap<Map<string, string>, FragmentIndex>()

function phraseBoundaryPattern(source: string) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
    const startsWithWord = /^[A-Za-z0-9]/.test(source)
    const endsWithWord = /[A-Za-z0-9]$/.test(source)
    return {
        pattern: new RegExp(`${startsWithWord ? "(^|[^A-Za-z0-9])" : ""}${escaped}${endsWithWord ? "(?=$|[^A-Za-z0-9])" : ""}`, "g"),
        startsWithWord,
    }
}

function buildIndex(phraseMap: Map<string, string>): FragmentIndex {
    // Stable sort: equal lengths keep phrase-map order, as the full scan did.
    const entries = Array.from(phraseMap.entries())
        .filter(([phrase, replacement]) => phrase.length >= MIN_PHRASE_LENGTH && phrase !== replacement)
        .sort((a, b) => b[0].length - a[0].length)
    const buckets = new Map<string, number[]>()
    entries.forEach(([phrase], rank) => {
        const key = phrase.slice(0, KEY_LENGTH)
        const bucket = buckets.get(key)
        if (bucket) bucket.push(rank)
        else buckets.set(key, [rank])
    })
    return {
        buckets,
        phrases: entries.map(([phrase]) => phrase),
        replacements: entries.map(([, replacement]) => replacement),
        patterns: new Array(entries.length),
    }
}

export function translateKnownFragments(source: string, phraseMap: Map<string, string>) {
    let index = indexes.get(phraseMap)
    if (!index) {
        index = buildIndex(phraseMap)
        indexes.set(phraseMap, index)
    }

    const ranks: number[] = []
    const seenKeys = new Set<string>()
    for (let start = 0; start + KEY_LENGTH <= source.length; start += 1) {
        const key = source.slice(start, start + KEY_LENGTH)
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        const bucket = index.buckets.get(key)
        if (!bucket) continue
        for (const rank of bucket) {
            if (source.includes(index.phrases[rank])) ranks.push(rank)
        }
    }
    if (!ranks.length) return undefined
    ranks.sort((a, b) => a - b)

    let translated = source
    for (const rank of ranks) {
        const replacement = index.replacements[rank]
        let boundary = index.patterns[rank]
        if (!boundary) {
            boundary = phraseBoundaryPattern(index.phrases[rank])
            index.patterns[rank] = boundary
        }
        const { pattern, startsWithWord } = boundary
        translated = translated.replace(pattern, (match, prefix = "") => {
            if (!startsWithWord) return replacement
            return `${prefix}${replacement}`
        })
    }

    return translated === source ? undefined : translated
}
