"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react"
import { en } from "./locales/en"
import { hi } from "./locales/hi"
import { gu } from "./locales/gu"
import { legacyPhraseTranslations } from "./legacy"
import { generatedLegacyPhraseTranslations } from "./legacy-generated"

export type Language = "en" | "hi" | "gu"
interface TranslationTree {
  [key: string]: string | TranslationTree
}
type InterpolationValues = Record<string, string | number | null | undefined>
type LocalizedTextState = {
  source: string
  applied: string
}

interface I18nContextProps {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, values?: InterpolationValues) => string
  tx: (text: string, values?: InterpolationValues) => string
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined)

const translations: Record<Language, TranslationTree> = { en, hi, gu }
const LANGUAGE_STORAGE_KEY = "weavly_language"
const SUPPORTED_LANGUAGES: Language[] = ["en", "hi", "gu"]
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "aria-description", "alt"] as const
const SKIP_TEXT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"])
const translationCache = new WeakMap<Map<string, string>, Map<string, string | undefined>>()
const reverseTranslationCache = new WeakMap<Map<string, string>, Map<string, string>>()

function isLanguage(value: string | null): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

function getNestedTranslation(language: Language, key: string) {
  const keys = key.split(".")
  let value: string | TranslationTree | undefined = translations[language]

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k]
    } else {
      return undefined
    }
  }

  return typeof value === "string" ? value : undefined
}

function interpolate(template: string, values?: InterpolationValues) {
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value === null || value === undefined ? match : String(value)
  })
}

function collectPhraseMap(language: Language) {
  const phraseMap = new Map<string, string>()

  function visit(source: TranslationTree, target: TranslationTree) {
    for (const key of Object.keys(source)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (typeof sourceValue === "string" && typeof targetValue === "string") {
        phraseMap.set(sourceValue, targetValue)
      } else if (
        sourceValue &&
        targetValue &&
        typeof sourceValue === "object" &&
        typeof targetValue === "object"
      ) {
        visit(sourceValue, targetValue)
      }
    }
  }

  visit(en, translations[language])

  if (language !== "en") {
    Object.entries(generatedLegacyPhraseTranslations[language]).forEach(([source, target]) => {
      phraseMap.set(source, target)
    })
    Object.entries(legacyPhraseTranslations[language]).forEach(([source, target]) => {
      phraseMap.set(source, target)
    })
  }

  return phraseMap
}

function phraseBoundaryPattern(source: string) {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  const startsWithWord = /^[A-Za-z0-9]/.test(source)
  const endsWithWord = /[A-Za-z0-9]$/.test(source)
  return {
    pattern: new RegExp(`${startsWithWord ? "(^|[^A-Za-z0-9])" : ""}${escaped}${endsWithWord ? "(?=$|[^A-Za-z0-9])" : ""}`, "g"),
    startsWithWord,
  }
}

function translateKnownFragments(source: string, phraseMap: Map<string, string>) {
  let translated = source

  const entries = Array.from(phraseMap.entries())
    .filter(([phrase, replacement]) => phrase.length >= 8 && phrase !== replacement && source.includes(phrase))
    .sort((a, b) => b[0].length - a[0].length)

  for (const [phrase, replacement] of entries) {
    const { pattern, startsWithWord } = phraseBoundaryPattern(phrase)
    translated = translated.replace(pattern, (match, prefix = "") => {
      if (!startsWithWord) return replacement
      return `${prefix}${replacement}`
    })
  }

  return translated === source ? undefined : translated
}

function translateSourceText(source: string, language: Language, phraseMap: Map<string, string>) {
  if (language === "en") return source

  let cache = translationCache.get(phraseMap)
  if (!cache) {
    cache = new Map<string, string | undefined>()
    translationCache.set(phraseMap, cache)
  }
  if (cache.has(source)) return cache.get(source)

  const translated = phraseMap.get(source) ?? translateKnownFragments(source, phraseMap)
  cache.set(source, translated)
  return translated
}

function getReversePhraseMap(phraseMap: Map<string, string>) {
  let reverseMap = reverseTranslationCache.get(phraseMap)
  if (!reverseMap) {
    const nextReverseMap = new Map<string, string>()
    phraseMap.forEach((target, source) => {
      if (source !== target) nextReverseMap.set(target.trim().replace(/\s+/g, " "), source)
    })
    reverseTranslationCache.set(phraseMap, nextReverseMap)
    reverseMap = nextReverseMap
  }
  return reverseMap
}

function preserveOuterWhitespace(original: string, replacement: string) {
  const leading = original.match(/^\s*/)?.[0] ?? ""
  const trailing = original.match(/\s*$/)?.[0] ?? ""
  return `${leading}${replacement}${trailing}`
}

function shouldTranslateTextNode(node: Text, originals: WeakMap<Text, LocalizedTextState>) {
  const parent = node.parentElement
  if (!parent || SKIP_TEXT_TAGS.has(parent.tagName) || parent.isContentEditable) return false
  return originals.has(node) || /[A-Za-z]/.test(node.nodeValue ?? "")
}

function translateTextNode(node: Text, language: Language, phraseMap: Map<string, string>, originals: WeakMap<Text, LocalizedTextState>) {
  if (!shouldTranslateTextNode(node, originals)) return

  const current = node.nodeValue ?? ""
  const currentKey = current.trim().replace(/\s+/g, " ")
  const knownCurrentEnglish = phraseMap.has(currentKey)
  const translatedSource = language === "en" ? undefined : getReversePhraseMap(phraseMap).get(currentKey)
  let state = originals.get(node)

  if (!state) {
    state = { source: translatedSource ?? current, applied: current }
    originals.set(node, state)
  } else if (knownCurrentEnglish || (current !== state.applied && current !== state.source && !translatedSource)) {
    state = { source: current, applied: current }
    originals.set(node, state)
  }

  const originalKey = state.source.trim().replace(/\s+/g, " ")
  const translated = translateSourceText(originalKey, language, phraseMap)
  if (!translated) return

  const nextValue = preserveOuterWhitespace(state.source, translated)
  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue
  }
  originals.set(node, { source: state.source, applied: nextValue })
}

function translateElementAttributes(element: Element, language: Language, phraseMap: Map<string, string>) {
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute)
    const originalAttribute = `data-i18n-original-${attribute}`
    const appliedAttribute = `data-i18n-applied-${attribute}`
    const original = element.getAttribute(originalAttribute)
    const applied = element.getAttribute(appliedAttribute)
    if (!value || (!original && !/[A-Za-z]/.test(value))) continue

    const valueKey = value.trim().replace(/\s+/g, " ")
    const knownCurrentEnglish = phraseMap.has(valueKey)
    const translatedSource = language === "en" ? undefined : getReversePhraseMap(phraseMap).get(valueKey)
    let source = original

    if (!source) {
      source = translatedSource ?? value
      element.setAttribute(originalAttribute, source)
    } else if (knownCurrentEnglish || (applied !== null && value !== applied && value !== source && !translatedSource)) {
      source = value
      element.setAttribute(originalAttribute, source)
    }

    const originalKey = source.trim().replace(/\s+/g, " ")
    const translated = translateSourceText(originalKey, language, phraseMap)
    if (translated && value !== translated) {
      element.setAttribute(attribute, translated)
      element.setAttribute(appliedAttribute, translated)
    } else if (translated) {
      element.setAttribute(appliedAttribute, value)
    }
  }
}

function translateSubtree(root: Node, language: Language, phraseMap: Map<string, string>, originals: WeakMap<Text, LocalizedTextState>) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language, phraseMap, originals)
    return
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElementAttributes(root as Element, language, phraseMap)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let current = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language, phraseMap, originals)
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(current as Element, language, phraseMap)
    }
    current = walker.nextNode()
  }
}

function LegacyTextLocalizer({ language, phraseMap }: { language: Language; phraseMap: Map<string, string> }) {
  const originals = useRef(new WeakMap<Text, LocalizedTextState>())

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return

    translateSubtree(document.body, language, phraseMap, originals.current)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target as Text, language, phraseMap, originals.current)
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateElementAttributes(mutation.target, language, phraseMap)
        }

        mutation.addedNodes.forEach((node) => {
          translateSubtree(node, language, phraseMap, originals.current)
        })
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      characterData: true,
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [language, phraseMap])

  return null
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // We initialize with 'en' to avoid hydration mismatch if server rendering
  // Client-side effect will update the language if stored
  const [language, setLanguageState] = useState<Language>("en")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    let disposed = false
    queueMicrotask(() => {
      if (disposed) return
      setIsMounted(true)
      const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (isLanguage(savedLang)) {
        setLanguageState(savedLang)
      }
    })
    return () => {
      disposed = true
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  }

  const activeLang = isMounted ? language : "en"
  const phraseMap = useMemo(() => collectPhraseMap(activeLang), [activeLang])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = "ltr"
  }, [language])

  const t = useCallback((key: string, values?: InterpolationValues): string => {
    // During SSR or first render before mount, default to English so hydration text matches.
    const value = getNestedTranslation(activeLang, key) ?? getNestedTranslation("en", key) ?? key
    return interpolate(value, values)
  }, [activeLang])

  const tx = useCallback((text: string, values?: InterpolationValues): string => {
    const value = translateSourceText(text, activeLang, phraseMap) ?? text
    return interpolate(value, values)
  }, [activeLang, phraseMap])

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, tx }}>
      <LegacyTextLocalizer language={activeLang} phraseMap={phraseMap} />
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within an I18nProvider")
  }
  return context
}
