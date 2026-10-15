'use client'

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { legacyStatus, needsCount, type LegacyStock } from '@/lib/legacy-stock'

/**
 * One quality's legacy stock in plain words. An unknown balance says "not counted" and never shows 0 m;
 * an estimate is always called an estimate; a balance below zero is shown as metres to count, not hidden.
 */
export function LegacyStatusLine({ legacy, className }: { legacy: LegacyStock; className?: string }) {
    const { t, language } = useTranslation()
    const tx = (key: string, values?: Record<string, string | number>) => t(`qualityStock.${key}`, values)
    const metres = (value: number) => Number(value).toLocaleString(language === 'en' ? 'en-IN' : `${language}-IN`, { maximumFractionDigits: 2 })
    const shortDate = (iso: string) => new Date(iso).toLocaleDateString(`${language}-IN`, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    const status = legacyStatus(legacy)
    const balance = legacy.balance_meters === null ? 0 : Number(legacy.balance_meters)
    const values = {
        meters: metres(Math.abs(balance)),
        date: legacy.basis_at ? shortDate(legacy.basis_at) : '',
    }
    const facts = [
        legacy.dispatched_meters > 0 ? tx('legacySentSince', { meters: metres(legacy.dispatched_meters), date: shortDate(legacy.started_at) }) : null,
        legacy.onboarded_meters > 0 ? tx('legacyTaggedSince', { meters: metres(legacy.onboarded_meters) }) : null,
    ].filter(Boolean)
    const warn = needsCount(status)
    return (
        <p data-legacy-status={status} className={cn('text-[13px] text-body', className)}>
            <span className={cn('inline-flex items-center gap-1.5 font-semibold', warn ? 'text-[var(--wv-ochre-800)]' : status === 'closed' ? 'text-[var(--wv-moss-700)]' : 'text-ink')}>
                {warn && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                {status === 'closed' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full border-2 border-muted-foreground', (warn || status === 'closed') && 'hidden')} />
                {tx(`legacyStatus_${status}`, values)}
            </span>
            {facts.length > 0 && <span className="text-muted-foreground"> · {facts.join(' · ')}</span>}
        </p>
    )
}
