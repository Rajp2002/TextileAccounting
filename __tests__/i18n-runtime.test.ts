import { describe, expect, it } from 'vitest'
import { applyTranslationGuards, translateFallbackUiText } from '../lib/i18n/runtime'

describe('i18n runtime glossary guards', () => {
  it('keeps textile and business domain terms in English for Hindi translations', () => {
    const translated = applyTranslationGuards(
      'Target meters, stock margin, and gross profit',
      'लक्ष्य मीटर, स्टॉक मार्जिन, और ग्रॉस प्रॉफिट',
      'hi',
    )

    expect(translated).toBe('लक्ष्य meters, stock margin, और gross profit')
  })

  it('keeps textile and business domain terms in English for Gujarati translations', () => {
    const translated = applyTranslationGuards(
      'Stock sale dispatch with yarn batch',
      'સ્ટોક વેચાણ ડિસ્પેચ સાથે યાર્ન બેચ',
      'gu',
    )

    expect(translated).toBe('Stock sale dispatch સાથે yarn batch')
  })

  it('keeps source number tokens intact for exact translations', () => {
    expect(applyTranslationGuards('15th payroll cycle', '15 वीं पेरोल साइकिल', 'hi')).toBe(
      '15th payroll साइकिल',
    )
  })
})

describe('i18n runtime fallback translation', () => {
  it('translates new short Hindi UI labels while preserving numbers and domain terms', () => {
    expect(translateFallbackUiText('Add stock margin 25 meters', 'hi')).toBe(
      'जोड़ें stock margin 25 meters',
    )
  })

  it('translates short setup labels that are not in the exact phrase table', () => {
    expect(translateFallbackUiText('Factory Setup', 'hi')).toBe('फैक्ट्री सेटअप')
    expect(translateFallbackUiText('Factory Setup', 'gu')).toBe('ફેક્ટરી સેટઅપ')
  })

  it('translates new short Gujarati UI labels while preserving numbers and domain terms', () => {
    expect(translateFallbackUiText('Save worker details for loom 3', 'gu')).toBe(
      'સેવ કરો કારીગર વિગતો માટે loom 3',
    )
  })

  it('does not translate emails, URLs, or opaque IDs', () => {
    expect(translateFallbackUiText('owner@example.com', 'hi')).toBeUndefined()
    expect(translateFallbackUiText('https://weavly.app/track/abc', 'gu')).toBeUndefined()
    expect(translateFallbackUiText('ABCD1234', 'hi')).toBeUndefined()
  })
})
