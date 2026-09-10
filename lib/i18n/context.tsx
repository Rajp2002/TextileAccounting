"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react"
import { en } from "./locales/en"
import { BASE_PLAN_PHRASES, isBasePlanSurfacePath } from "./base-plan-phrases"
import { applyTranslationGuards, translateStrictBasePlanText } from "./runtime"

export type Language = "en" | "hi" | "gu"
interface TranslationTree {
  [key: string]: string | TranslationTree
}
type InterpolationValues = Record<string, string | number | null | undefined>
type LocalizedTextState = {
  source: string
  applied: string
}
type ElementAttributeStates = Map<string, LocalizedTextState>
type TranslationResources = {
  translation: TranslationTree
  legacy: Record<string, string>
  generatedLegacy: Record<string, string>
}

export type LanguageLoadStatus = "idle" | "loading" | "ready" | "error"
export type LanguageChangeResult =
  | { ok: true; language: Language }
  | { ok: false; language: Language; error: string }

interface I18nContextProps {
  language: Language
  setLanguage: (lang: Language) => Promise<LanguageChangeResult>
  languageStatus: LanguageLoadStatus
  pendingLanguage: Language | null
  languageError: string | null
  t: (key: string, values?: InterpolationValues) => string
  tx: (text: string, values?: InterpolationValues) => string
}

export const I18nContext = createContext<I18nContextProps | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = "weavly_language"
const SUPPORTED_LANGUAGES: Language[] = ["en", "hi", "gu"]
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "aria-description", "alt"] as const
const SKIP_TEXT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"])
const SKIP_TRANSLATION_SELECTOR = '[data-i18n-skip="true"]'
const translationCache = new WeakMap<Map<string, string>, Map<string, string | undefined>>()
const reverseTranslationCache = new WeakMap<Map<string, string>, Map<string, string>>()
const resourcePromises = new Map<Exclude<Language, "en">, Promise<TranslationResources>>()

function loadLanguageResources(language: Exclude<Language, "en">) {
  const existing = resourcePromises.get(language)
  if (existing) return existing

  const localePromise = language === "hi" ? import("./locales/hi").then(({ hi }) => hi) : import("./locales/gu").then(({ gu }) => gu)
  const resourcePromise = Promise.all([
    localePromise,
    import("./legacy").then(({ legacyPhraseTranslations }) => legacyPhraseTranslations[language]),
    import("./legacy-generated").then(({ generatedLegacyPhraseTranslations }) => generatedLegacyPhraseTranslations[language]),
  ])
    .then(([translation, legacy, generatedLegacy]) => ({ translation, legacy, generatedLegacy }))
    .catch((error) => {
      resourcePromises.delete(language)
      throw error
    })

  resourcePromises.set(language, resourcePromise)
  return resourcePromise
}

function isLanguage(value: string | null): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

function getNestedTranslation(translation: TranslationTree, key: string) {
  const keys = key.split(".")
  let value: string | TranslationTree | undefined = translation

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

function collectPhraseMap(language: Language, resources?: TranslationResources) {
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

  visit(en, resources?.translation ?? en)

  if (language !== "en" && resources) {
    Object.entries(resources.generatedLegacy).forEach(([source, target]) => {
      phraseMap.set(source, target)
    })
    Object.entries(resources.legacy).forEach(([source, target]) => {
      phraseMap.set(source, target)
    })

    Object.entries(BASE_PLAN_PHRASES[language]).forEach(([source, target]) => {
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

function translateSourceText(source: string, language: Language, phraseMap: Map<string, string>, strictBasePlan = false) {
  if (language === "en") return source

  let cache = translationCache.get(phraseMap)
  if (!cache) {
    cache = new Map<string, string | undefined>()
    translationCache.set(phraseMap, cache)
  }
  const cacheKey = `${strictBasePlan ? "base" : "legacy"}:${source}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const translated = phraseMap.get(source) ?? translateKnownFragments(source, phraseMap)
  if (translated) {
    const guarded = strictBasePlan
      ? translateStrictBasePlanText(translated, language) ?? translated
      : applyTranslationGuards(source, translated, language)
    cache.set(cacheKey, guarded)
    return guarded
  }

  const fallback = strictBasePlan ? translateStrictBasePlanText(source, language) : undefined
  cache.set(cacheKey, fallback)
  return fallback
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
  if (parent.closest(SKIP_TRANSLATION_SELECTOR)) return false
  return originals.has(node) || /[A-Za-z]/.test(node.nodeValue ?? "")
}

function translateTextNode(node: Text, language: Language, phraseMap: Map<string, string>, originals: WeakMap<Text, LocalizedTextState>, strictBasePlan: boolean) {
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
  const translated = translateSourceText(originalKey, language, phraseMap, strictBasePlan)
  if (!translated) return

  const nextValue = preserveOuterWhitespace(state.source, translated)
  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue
  }
  originals.set(node, { source: state.source, applied: nextValue })
}

function translateElementAttributes(
  element: Element,
  language: Language,
  phraseMap: Map<string, string>,
  originals: WeakMap<Element, ElementAttributeStates>,
  strictBasePlan: boolean,
) {
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    if (element.closest(SKIP_TRANSLATION_SELECTOR)) return
    const value = element.getAttribute(attribute)
    let states = originals.get(element)
    let state = states?.get(attribute)
    if (!value || (!state && !/[A-Za-z]/.test(value))) continue

    const valueKey = value.trim().replace(/\s+/g, " ")
    const knownCurrentEnglish = phraseMap.has(valueKey)
    const translatedSource = language === "en" ? undefined : getReversePhraseMap(phraseMap).get(valueKey)

    if (!state) {
      state = { source: translatedSource ?? value, applied: value }
      states = states ?? new Map<string, LocalizedTextState>()
      states.set(attribute, state)
      originals.set(element, states)
    } else if (knownCurrentEnglish || (value !== state.applied && value !== state.source && !translatedSource)) {
      state = { source: value, applied: value }
      states?.set(attribute, state)
    }

    const originalKey = state.source.trim().replace(/\s+/g, " ")
    const translated = translateSourceText(originalKey, language, phraseMap, strictBasePlan)
    if (translated && value !== translated) {
      element.setAttribute(attribute, translated)
      states?.set(attribute, { source: state.source, applied: translated })
    } else if (translated) {
      states?.set(attribute, { source: state.source, applied: value })
    }
  }
}

function translateSubtree(
  root: Node,
  language: Language,
  phraseMap: Map<string, string>,
  textOriginals: WeakMap<Text, LocalizedTextState>,
  attributeOriginals: WeakMap<Element, ElementAttributeStates>,
  strictBasePlan: boolean,
) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language, phraseMap, textOriginals, strictBasePlan)
    return
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElementAttributes(root as Element, language, phraseMap, attributeOriginals, strictBasePlan)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let current = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language, phraseMap, textOriginals, strictBasePlan)
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(current as Element, language, phraseMap, attributeOriginals, strictBasePlan)
    }
    current = walker.nextNode()
  }
}

function LegacyTextLocalizer({ language, phraseMap }: { language: Language; phraseMap: Map<string, string> }) {
  const textOriginals = useRef(new WeakMap<Text, LocalizedTextState>())
  const attributeOriginals = useRef(new WeakMap<Element, ElementAttributeStates>())
  const hasLocalized = useRef(false)

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return
    // English is already rendered by React. Avoid walking every route and
    // observing every edit unless we need to restore a translated document.
    if (language === "en" && !hasLocalized.current) return

    const strictBasePlan = isBasePlanSurfacePath(window.location.pathname)
    translateSubtree(document.body, language, phraseMap, textOriginals.current, attributeOriginals.current, strictBasePlan)
    hasLocalized.current = language !== "en"
    if (language === "en") {
      textOriginals.current = new WeakMap()
      attributeOriginals.current = new WeakMap()
      return
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const currentStrictBasePlan = isBasePlanSurfacePath(window.location.pathname)
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target as Text, language, phraseMap, textOriginals.current, currentStrictBasePlan)
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateElementAttributes(mutation.target, language, phraseMap, attributeOriginals.current, currentStrictBasePlan)
        }

        mutation.addedNodes.forEach((node) => {
          translateSubtree(node, language, phraseMap, textOriginals.current, attributeOriginals.current, currentStrictBasePlan)
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
  const [resources, setResources] = useState<Partial<Record<Language, TranslationResources>>>({
    en: { translation: en, legacy: {}, generatedLegacy: {} },
  })
  const requestedLanguage = useRef<Language>("en")
  const [languageStatus, setLanguageStatus] = useState<LanguageLoadStatus>("idle")
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null)
  const [languageError, setLanguageError] = useState<string | null>(null)

  const activateLanguage = useCallback(async (lang: Language): Promise<LanguageChangeResult> => {
    requestedLanguage.current = lang
    setLanguageError(null)

    if (lang === "en") {
      setPendingLanguage(null)
      setLanguageState("en")
      setLanguageStatus("ready")
      localStorage.setItem(LANGUAGE_STORAGE_KEY, "en")
      return { ok: true, language: "en" }
    }

    if (resources[lang]) {
      setPendingLanguage(null)
      setLanguageState(lang)
      setLanguageStatus("ready")
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
      return { ok: true, language: lang }
    }

    setPendingLanguage(lang)
    setLanguageStatus("loading")

    try {
      const loadedResources = await loadLanguageResources(lang)
      if (requestedLanguage.current !== lang) {
        return { ok: false, language: lang, error: "Language change was superseded." }
      }
      setResources((current) => current[lang]
        ? current
        : { ...current, [lang]: loadedResources })
      setPendingLanguage(null)
      setLanguageState(lang)
      setLanguageStatus("ready")
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
      return { ok: true, language: lang }
    } catch {
      if (requestedLanguage.current !== lang) {
        return { ok: false, language: lang, error: "Language change was superseded." }
      }
      setPendingLanguage(null)
      setLanguageStatus("error")
      setLanguageError("The selected language could not be loaded.")
      return { ok: false, language: lang, error: "The selected language could not be loaded." }
    }
  }, [resources])

  useEffect(() => {
    let disposed = false
    queueMicrotask(() => {
      if (disposed) return
      setIsMounted(true)
      const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (isLanguage(savedLang)) {
        void activateLanguage(savedLang)
      }
    })
    return () => {
      disposed = true
    }
  }, [activateLanguage])

  const setLanguage = useCallback((lang: Language) => activateLanguage(lang), [activateLanguage])

  const activeLang = isMounted && resources[language] ? language : "en"
  const activeResources = resources[activeLang]
  const phraseMap = useMemo(() => collectPhraseMap(activeLang, activeResources), [activeLang, activeResources])

  useEffect(() => {
    document.documentElement.lang = activeLang
    document.documentElement.dir = "ltr"
  }, [activeLang])

  const t = useCallback((key: string, values?: InterpolationValues): string => {
    // During SSR or first render before mount, default to English so hydration text matches.
    const value = getNestedTranslation(activeResources?.translation ?? en, key) ?? getNestedTranslation(en, key) ?? key
    return interpolate(value, values)
  }, [activeResources])

  const tx = useCallback((text: string, values?: InterpolationValues): string => {
    const strictBasePlan = typeof window !== "undefined" && isBasePlanSurfacePath(window.location.pathname)
    const value = translateSourceText(text, activeLang, phraseMap, strictBasePlan) ?? text
    return interpolate(value, values)
  }, [activeLang, phraseMap])

  return (
    <I18nContext.Provider value={{ language, setLanguage, languageStatus, pendingLanguage, languageError, t, tx }}>
      <LegacyTextLocalizer language={activeLang} phraseMap={phraseMap} />
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    return {
      language: "en" as Language,
      setLanguage: async (lang: Language) => ({ ok: true as const, language: lang }),
      languageStatus: "ready" as LanguageLoadStatus,
      pendingLanguage: null,
      languageError: null,
      t: (key: string, values?: InterpolationValues) => interpolate(key, values),
      tx: (text: string, values?: InterpolationValues) => interpolate(text, values),
    }
  }
  return context
}
