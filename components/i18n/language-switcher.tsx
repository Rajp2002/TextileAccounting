"use client"

import { useTranslation, Language } from "@/lib/i18n/context"
import { Globe, Loader2 } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/app-notifications"

const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिंदी", short: "हि" },
  { code: "gu", label: "ગુજરાતી", short: "ગુ" },
]

interface LanguageSwitcherProps {
  className?: string
  placement?: "top" | "bottom"
}

export function LanguageSwitcher({ className, placement = "top" }: LanguageSwitcherProps) {
  const { language, setLanguage, languageStatus, pendingLanguage, languageError, tx, t } = useTranslation()
  const [open, setOpen] = useState(false)

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]
  const pending = LANGUAGES.find(l => l.code === pendingLanguage)
  const isLoading = languageStatus === "loading"

  const handleLanguageChange = async (nextLanguage: Language) => {
    if (nextLanguage === language || isLoading) {
      setOpen(false)
      return
    }
    setOpen(false)
    const result = await setLanguage(nextLanguage)
    if (result.ok) {
      const targetLabel = LANGUAGES.find(item => item.code === result.language)?.label ?? result.language
      const successTitle = result.language === "hi"
        ? `भाषा बदलकर ${targetLabel} हो गई`
        : result.language === "gu"
          ? `ભાષા ${targetLabel} માં બદલાઈ`
          : `Language changed to ${targetLabel}`
      toast.success(successTitle)
    } else if (result.error !== "Language change was superseded.") {
      const targetLabel = LANGUAGES.find(item => item.code === nextLanguage)?.label ?? nextLanguage
      const failureTitle = nextLanguage === "hi" ? `${targetLabel} लोड नहीं हो सकी` : nextLanguage === "gu" ? `${targetLabel} લોડ થઈ શકી નથી` : `Could not load ${targetLabel}`
      const fallbackDescription = t("common.language_fallback")
      toast.error(failureTitle, {
        description: fallbackDescription,
      })
    }
  }

  return (
    <div className="relative" data-i18n-skip="true">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5",
          className
        )}
        aria-label={tx("Switch language")}
        aria-busy={isLoading}
      >
        {isLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Globe className="h-4 w-4 shrink-0" />}
        <span className="font-medium" data-i18n-skip="true">{isLoading ? t("common.language_loading", { language: pending?.label ?? "…" }) : current.label}</span>
        <svg className={cn("h-3 w-3 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {isLoading
          ? t("common.language_loading", { language: pending?.label ?? "…" })
          : languageError
            ? t("common.language_fallback")
            : ""}
      </span>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn(
            "absolute left-0 z-50 min-w-[130px] overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => void handleLanguageChange(lang.code)}
                disabled={isLoading}
                aria-current={language === lang.code ? "true" : undefined}
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
