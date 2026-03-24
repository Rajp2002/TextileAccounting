'use client'

import { useTranslation } from '@/lib/i18n/context'
import { transliterate } from '@/lib/transliterate'

/**
 * React hook that returns a function to transliterate names
 * based on the currently selected language.
 */
export function useTransliterate() {
  const { language } = useTranslation()
  return (name: string) => transliterate(name, language)
}
