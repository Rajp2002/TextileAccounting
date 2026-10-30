'use client'

import { useContext, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, LogOut, MessageSquare } from 'lucide-react'
import { I18nContext } from '@/lib/i18n/context'
import { customerSupportText } from '@/lib/i18n/customer-support'
import styles from './customer-support.module.css'

/** Support remains reachable independently of a customer's plan or workspace access. */
export function SupportShell({ children }: { children: ReactNode }) {
  const language = useContext(I18nContext)?.language ?? 'en'
  const text = (key: Parameters<typeof customerSupportText>[1]) => customerSupportText(language, key)

  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#support-main">{text('support')}</a>
    <aside className={styles.sidebar} aria-label={text('support')}>
      <Link href="/" className={styles.brand} aria-label="Weavly">
        {/* This fixed-size local wordmark is shared with the workspace navigation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/WeavlyLogo.png" alt="Weavly" width={176} height={112} />
      </Link>
      <nav className={styles.navigation} aria-label={text('support')}>
        <Link href="/owner/estimator" className={styles.workspaceLink}><ArrowLeft aria-hidden="true" />{text('workspaceBack')}</Link>
        <Link href="/support" className={styles.currentLink} aria-current="location"><MessageSquare aria-hidden="true" />{text('support')}</Link>
      </nav>
      <div className={styles.sidebarFooter}>
        <p>{text('inApp')}</p>
        <form method="post" action="/auth/signout">
          <button type="submit" className={styles.signOut} title={text('signOutNote')}><LogOut aria-hidden="true" /><span>{text('signOut')}</span></button>
        </form>
      </div>
    </aside>
    <main id="support-main" tabIndex={-1} className={styles.main}>
      <div className={styles.content}>{children}</div>
    </main>
  </div>
}
