"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { en } from "./locales/en"
import { hi } from "./locales/hi"
import { gu } from "./locales/gu"

export type Language = "en" | "hi" | "gu"

interface I18nContextProps {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined)

const translations: Record<Language, any> = { en, hi, gu }

export function I18nProvider({ children }: { children: ReactNode }) {
  // We initialize with 'en' to avoid hydration mismatch if server rendering
  // Client-side effect will update the language if stored
  const [language, setLanguageState] = useState<Language>("en")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const savedLang = localStorage.getItem("loomi_language") as Language
    if (savedLang && ["en", "hi", "gu"].includes(savedLang)) {
      setLanguageState(savedLang)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("loomi_language", lang)
  }

  const t = (key: string): string => {
    const keys = key.split(".")
    
    // During SSR or first render before mount, we default to English
    // but React hydration expects exact text matches so we just use the current default language.
    const activeLang = isMounted ? language : "en"
    
    let value = translations[activeLang]

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        value = undefined
        break
      }
    }
    
    if (typeof value === "string") {
      return value
    }
    
    // Fallback to English
    let fallback = translations["en"]
    for (const k of keys) {
      if (fallback && typeof fallback === "object" && k in fallback) {
        fallback = fallback[k]
      } else {
        return key
      }
    }

    if (typeof fallback === "string") {
      return fallback
    }

    return key
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
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
