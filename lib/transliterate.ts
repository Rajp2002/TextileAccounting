/**
 * Transliteration utility for converting Latin-script Indian names
 * to Devanagari (Hindi) and Gujarati scripts.
 *
 * Uses a phonetic mapping approach optimized for common Indian names.
 */

// Devanagari (Hindi) mappings
const HINDI_CONSONANTS: Record<string, string> = {
  ksh: 'क्ष', gya: 'ज्ञ', shr: 'श्र',
  bh: 'भ', ch: 'च', dh: 'ध', gh: 'घ', jh: 'झ',
  kh: 'ख', ph: 'फ', sh: 'श', th: 'थ', ng: 'ङ',
  ny: 'ञ', tr: 'त्र',
  b: 'ब', c: 'क', d: 'द', f: 'फ', g: 'ग',
  h: 'ह', j: 'ज', k: 'क', l: 'ल', m: 'म',
  n: 'न', p: 'प', q: 'क़', r: 'र', s: 'स',
  t: 'त', v: 'व', w: 'व', x: 'क्स', y: 'य', z: 'ज़',
}

const HINDI_VOWELS: Record<string, string> = {
  aa: 'ा', ai: 'ै', au: 'ौ', ee: 'ी', ei: 'ै',
  oo: 'ू', ou: 'ौ',
  a: 'ा', e: 'े', i: 'ि', o: 'ो', u: 'ु',
}

const HINDI_INITIAL_VOWELS: Record<string, string> = {
  aa: 'आ', ai: 'ऐ', au: 'औ', ee: 'ई', ei: 'ऐ',
  oo: 'ऊ', ou: 'औ',
  a: 'अ', e: 'ए', i: 'इ', o: 'ओ', u: 'उ',
}

// Gujarati mappings
const GUJARATI_CONSONANTS: Record<string, string> = {
  ksh: 'ક્ષ', gya: 'જ્ઞ', shr: 'શ્ર',
  bh: 'ભ', ch: 'ચ', dh: 'ધ', gh: 'ઘ', jh: 'ઝ',
  kh: 'ખ', ph: 'ફ', sh: 'શ', th: 'થ', ng: 'ઙ',
  ny: 'ઞ', tr: 'ત્ર',
  b: 'બ', c: 'ક', d: 'દ', f: 'ફ', g: 'ગ',
  h: 'હ', j: 'જ', k: 'ક', l: 'લ', m: 'મ',
  n: 'ન', p: 'પ', q: 'ક', r: 'ર', s: 'સ',
  t: 'ત', v: 'વ', w: 'વ', x: 'ક્સ', y: 'ય', z: 'ઝ',
}

const GUJARATI_VOWELS: Record<string, string> = {
  aa: 'ા', ai: 'ૈ', au: 'ૌ', ee: 'ી', ei: 'ૈ',
  oo: 'ૂ', ou: 'ૌ',
  a: 'ા', e: 'ે', i: 'િ', o: 'ો', u: 'ુ',
}

const GUJARATI_INITIAL_VOWELS: Record<string, string> = {
  aa: 'આ', ai: 'ઐ', au: 'ઔ', ee: 'ઈ', ei: 'ઐ',
  oo: 'ઊ', ou: 'ઔ',
  a: 'અ', e: 'એ', i: 'ઇ', o: 'ઓ', u: 'ઉ',
}

// Virama (halant) characters
const HINDI_VIRAMA = '्'
const GUJARATI_VIRAMA = '્'

/**
 * Transliterate a single word from Latin to the target script.
 */
function transliterateWord(
  word: string,
  consonants: Record<string, string>,
  vowels: Record<string, string>,
  initialVowels: Record<string, string>,
  virama: string,
): string {
  if (!word) return word

  const lower = word.toLowerCase()
  let result = ''
  let i = 0
  let prevWasConsonant = false

  while (i < lower.length) {
    // Try matching longer sequences first (3, then 2, then 1 char)
    let matched = false

    // Try consonant clusters (3 chars, 2 chars, 1 char)
    for (const len of [3, 2, 1]) {
      const chunk = lower.substring(i, i + len)

      if (consonants[chunk]) {
        if (prevWasConsonant) {
          result += virama + consonants[chunk]
        } else {
          result += consonants[chunk]
        }
        i += len
        prevWasConsonant = true
        matched = true
        break
      }
    }

    if (matched) continue

    // Try vowels (2 chars, 1 char)
    for (const len of [2, 1]) {
      const chunk = lower.substring(i, i + len)

      if (i === 0 || !prevWasConsonant) {
        // Word-initial or after another vowel → use standalone vowel form
        if (initialVowels[chunk]) {
          result += initialVowels[chunk]
          i += len
          prevWasConsonant = false
          matched = true
          break
        }
      }

      if (vowels[chunk]) {
        result += vowels[chunk]
        i += len
        prevWasConsonant = false
        matched = true
        break
      }
    }

    if (matched) continue

    // Non-alphabetic characters (digits, punctuation, etc.) pass through as-is
    result += lower[i]
    prevWasConsonant = false
    i++
  }

  // If word ends with a consonant, add virama for proper rendering
  // But for common name endings, we often want the implicit 'a' sound
  // So we skip this — Hindi/Gujarati display consonants with inherent 'a'

  return result
}

/**
 * Transliterate a full name (handles multi-word names, preserves spacing).
 * If the name already contains non-Latin characters, it is returned as-is.
 */
function transliterateName(
  name: string,
  consonants: Record<string, string>,
  vowels: Record<string, string>,
  initialVowels: Record<string, string>,
  virama: string,
): string {
  if (!name) return name

  // If name already contains non-ASCII characters (likely already in target script), return as-is
  if (/[^\x00-\x7F]/.test(name)) return name

  return name
    .split(/(\s+)/)
    .map(part => {
      if (/^\s+$/.test(part)) return part // Preserve whitespace
      return transliterateWord(part, consonants, vowels, initialVowels, virama)
    })
    .join('')
}

/**
 * Main transliteration function.
 * Converts a Latin-script name to the script matching the given language.
 *
 * @param name - The name to transliterate
 * @param lang - Target language code ('en', 'hi', 'gu')
 * @returns The transliterated name, or the original name if lang is 'en'
 */
export function transliterate(name: string, lang: string): string {
  if (!name) return name

  switch (lang) {
    case 'hi':
      return transliterateName(name, HINDI_CONSONANTS, HINDI_VOWELS, HINDI_INITIAL_VOWELS, HINDI_VIRAMA)
    case 'gu':
      return transliterateName(name, GUJARATI_CONSONANTS, GUJARATI_VOWELS, GUJARATI_INITIAL_VOWELS, GUJARATI_VIRAMA)
    default:
      return name
  }
}
