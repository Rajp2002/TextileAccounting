'use client'
import { useContext } from 'react'
import { I18nContext } from '@/lib/i18n/context'
import { freeSupportingText } from '@/lib/i18n/free-supporting'

export function SupportHistoryExport({ compactMobile = false }: { compactMobile?: boolean }) {
  const language = useContext(I18nContext)?.language ?? 'en'
  return <div className="mt-8 border-t border-hairline pt-4"><a href="/api/support/export" download className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{freeSupportingText(compactMobile ? language : 'en', 'exportSupport')}</a><p className="mt-1 text-xs text-subtle">{freeSupportingText(compactMobile ? language : 'en', 'exportSupportBody')}</p></div>
}
