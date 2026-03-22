"use client"

import { useTranslation, Language } from "@/lib/i18n/context"
import { Globe } from "lucide-react"

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation()

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language)
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
      <Globe className="h-4 w-4" />
      <select
        value={language}
        onChange={handleLanguageChange}
        className="bg-transparent border-none outline-none cursor-pointer hover:text-foreground focus:ring-0 text-sm font-medium"
      >
        <option value="en">English</option>
        <option value="hi">हिंदी</option>
        <option value="gu">ગુજરાતી</option>
      </select>
    </div>
  )
}
