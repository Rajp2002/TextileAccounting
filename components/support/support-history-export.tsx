'use client'
import { useContext } from 'react'
import { Download } from 'lucide-react'
import { I18nContext } from '@/lib/i18n/context'
import { customerSupportText } from '@/lib/i18n/customer-support'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from './customer-support.module.css'

export function SupportHistoryExport({ compactMobile = false }: { compactMobile?: boolean }) {
  const language = useContext(I18nContext)?.language ?? 'en'
  const text = (key: Parameters<typeof customerSupportText>[1]) => customerSupportText(language, key)
  return <section className={cn(styles.panel, styles.export)} aria-labelledby="support-export-heading" data-compact-mobile={compactMobile || undefined}>
    <div className={styles.exportIcon}><Download aria-hidden="true" /></div>
    <div><h2 id="support-export-heading">{text('historyTitle')}</h2><p>{text('historyBody')}</p></div>
    <Button asChild variant="outline" size="lg"><a href="/api/support/export" download><Download data-icon="inline-start" aria-hidden="true" />{text('downloadHistory')}</a></Button>
  </section>
}
