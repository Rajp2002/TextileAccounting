'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { liteRecordsCopy } from '@/lib/i18n/lite-records'
import styles from './lite-prior-history.module.css'

/** Presentation only: the server supplies this wrapper only for verified Lite. */
export function LitePriorFreeHistory({ children }: { children: ReactNode }) {
  const { language } = useTranslation()
  const copy = liteRecordsCopy[language]
  const [open, setOpen] = useState(false)
  const [hasFeedback, setHasFeedback] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = content.current
    if (!node) return
    const update = () => setHasFeedback(Boolean(node.querySelector('[role="alert"], [aria-invalid="true"]')))
    update()
    const observer = new MutationObserver(update)
    observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-invalid'] })
    return () => observer.disconnect()
  }, [])
  const id = useId()
  const expanded = open || hasFeedback
  return <section className={styles.history} data-lite-prior-history data-expanded={expanded}>
    <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(value => !value)} data-i18n-skip="true" lang={language}><FileText className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{copy.freeHistory}</span><ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /></button>
    <div id={id} ref={content} className={styles.content}>{children}</div>
  </section>
}
