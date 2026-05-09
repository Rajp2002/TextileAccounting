"use client"

import { useTranslation, Language } from "@/lib/i18n/context"
import { Globe } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिंदी", short: "हि" },
  { code: "gu", label: "ગુજ", short: "ગુ" },
]

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation()
  const [open, setOpen] = useState(false)

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5",
          className
        )}
        aria-label="Switch language"
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span className="font-medium">{current.label}</span>
        <svg className={cn("h-3 w-3 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[130px] bg-background border border-border rounded-xl shadow-lg py-1 overflow-hidden">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code)
                  setOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  language === lang.code
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {language === lang.code && (
                  <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {language !== lang.code && <span className="w-3.5 shrink-0" />}
                {lang.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
