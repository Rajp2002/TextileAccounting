'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ChevronDown, LockKeyhole, MessagesSquare, Plus, RefreshCw, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { categories, type CustomerTicketDetail, type Ticket, type TicketList } from '@/lib/support/contracts'
import type { CustomerSupportText } from '@/lib/i18n/customer-support'
import { cn } from '@/lib/utils'
import styles from './customer-support.module.css'

type TextProps = { text: CustomerSupportText; formatLabel: (value: string) => string; timestamp: (value: string | null) => string }

function StatusBadge({ status, text, formatLabel }: { status: Ticket['status']; text: CustomerSupportText; formatLabel: TextProps['formatLabel'] }) {
  const variant = status === 'resolved' ? 'success' : status === 'waiting_on_customer' ? 'warning' : status === 'new' ? 'brand' : 'info'
  return <Badge variant={variant}>{status === 'waiting_on_customer' ? text('waitingOnYou') : formatLabel(status)}</Badge>
}

function PrivateConversation({ text }: { text: CustomerSupportText }) {
  return <div className={styles.privacy}>
    <LockKeyhole aria-hidden="true" />
    <div><h3>{text('privateHeading')}</h3><p>{text('privateBody')}</p></div>
  </div>
}

function SupportGuide({ text }: { text: CustomerSupportText }) {
  const tips = [['tipWhere', 'tipWhereBody'], ['tipWhat', 'tipWhatBody'], ['tipError', 'tipErrorBody']] as const
  return <aside className={cn(styles.panel, styles.guide)} aria-labelledby="support-guide-heading">
    <h2 id="support-guide-heading">{text('helpFaster')}</h2>
    <ol>{tips.map(([title, body], index) => <li className={styles.tip} key={title}>
      <span className={styles.tipNumber} aria-hidden="true">{index + 1}</span>
      <div><h3>{text(title)}</h3><p>{text(body)}</p></div>
    </li>)}</ol>
    <PrivateConversation text={text} />
  </aside>
}

function ErrorNotice({ children, onRetry, retryLabel }: { children: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return <div role="alert" className={styles.error}>{children}{onRetry && <div><button type="button" onClick={onRetry}>{retryLabel}</button></div>}</div>
}

export function CustomerSupportLoading({ text, error, onRetry }: { text: CustomerSupportText; error: string; onRetry: () => void }) {
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2>{text('support')}</h2></div>
    {error ? <div className={styles.listError}><ErrorNotice onRetry={onRetry} retryLabel={text('retry')}>{error}</ErrorNotice></div> : <div className={styles.skeleton} role="status" aria-label={text('loadingTicket')}>
      <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" />
      <span className="sr-only">{text('loadingTicket')}</span>
    </div>}
  </section>
}

type InboxProps = TextProps & {
  list: TicketList | null; error: string; submitError: string; busy: boolean; uncertain: boolean; compose: boolean; composeId: string
  subject: string; category: string; body: string; filtered: boolean; hasCursor: boolean
  onCompose: (open: boolean) => void; onChange: (field: 'subject' | 'category' | 'body', value: string) => void
  onSubmit: () => void; onRefresh: () => void; onFirstPage: () => void; onNextPage: () => void; onViewAll: () => void
}

export function CustomerSupportInboxView(props: InboxProps) {
  const { text, formatLabel, timestamp, list, error, submitError, busy, uncertain, compose, composeId, subject, category, body } = props
  const subjectRef = useRef<HTMLInputElement>(null)
  const newTicketRef = useRef<HTMLButtonElement>(null)
  const wasComposing = useRef(false)
  useEffect(() => {
    if (compose) subjectRef.current?.focus({ preventScroll: true })
    else if (wasComposing.current) newTicketRef.current?.focus()
    wasComposing.current = compose
  }, [compose])
  const canSubmit = subject.trim().length >= 3 && Boolean(body.trim()) && !busy

  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>{text('support')}</h1><p>{text('welcome')}</p></div>
      <Button ref={newTicketRef} size="lg" aria-expanded={compose} aria-controls={compose ? composeId : undefined} disabled={busy} onClick={() => props.onCompose(!compose)}>
        {compose ? <X data-icon="inline-start" aria-hidden="true" /> : <Plus data-icon="inline-start" aria-hidden="true" />}{compose ? text('close') : text('newTicket')}
      </Button>
    </header>
    <div className={styles.columns}>
      <div className={styles.primaryColumn}>
        {compose ? <section id={composeId} className={cn(styles.panel, styles.composer)} aria-labelledby={`${composeId}-heading`}>
          <div className={styles.composerHeading}><div><h2 id={`${composeId}-heading`}>{text('ask')}</h2><p>{text('composeIntro')}</p></div></div>
          {uncertain && <p role="status" className={styles.notice}>{text('uncertainSubmission')}</p>}
          <form onSubmit={event => { event.preventDefault(); if (canSubmit) props.onSubmit() }}>
            <fieldset disabled={busy || uncertain} className={styles.fields}>
              <label className={styles.field} htmlFor={`${composeId}-subject`}>{text('subject')}
                <Input ref={subjectRef} id={`${composeId}-subject`} required minLength={3} maxLength={160} placeholder={text('subjectPlaceholder')} value={subject} onChange={event => props.onChange('subject', event.target.value)} />
              </label>
              <div className={styles.field}>
                <label htmlFor={`${composeId}-category`}>{text('category')}</label>
                <Select value={category} onValueChange={value => props.onChange('category', value)} disabled={busy || uncertain}>
                  <SelectTrigger id={`${composeId}-category`}><SelectValue /></SelectTrigger>
                  <SelectContent className={styles.selectContent}><SelectGroup>{categories.map(value => <SelectItem key={value} value={value}>{formatLabel(value)}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </div>
              <label className={styles.field} htmlFor={`${composeId}-description`}>{text('description')}
                <Textarea id={`${composeId}-description`} required maxLength={10000} placeholder={text('descriptionPlaceholder')} value={body} onChange={event => props.onChange('body', event.target.value)} />
              </label>
            </fieldset>
            <p className={styles.safety}><LockKeyhole aria-hidden="true" />{text('safeData')}</p>
            {submitError && <div className="mt-5"><ErrorNotice>{submitError}</ErrorNotice></div>}
            <div className={styles.formFooter}>
              <p>{text('requiredFields')}</p>
              <div><Button variant="ghost" size="lg" type="button" disabled={busy} onClick={() => props.onCompose(false)}>{text('close')}</Button><Button type="submit" size="lg" disabled={!canSubmit}>
                <Send data-icon="inline-start" aria-hidden="true" />{busy ? text('submitting') : uncertain ? text('retrySubmission') : text('submit')}
              </Button></div>
            </div>
          </form>
        </section> : <>
          {(subject || body) && <p role="status" className={styles.notice}>{text('draft')}</p>}
          <section className={styles.panel} aria-labelledby="support-tickets-heading" aria-busy={!list && !error}>
            <div className={styles.panelHeading}><h2 id="support-tickets-heading">{text('tickets')}</h2><Button variant="outline" size="lg" disabled={!list && !error} onClick={props.onRefresh}><RefreshCw data-icon="inline-start" aria-hidden="true" />{text('refresh')}</Button></div>
            {error && <div className={styles.listError}><ErrorNotice onRetry={props.onRefresh} retryLabel={text('retryLoading')}>{error}</ErrorNotice></div>}
            {!list && !error && <div className={styles.skeleton} role="status" aria-label={text('loading')}><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><span className="sr-only">{text('loading')}</span></div>}
            {list?.items.length === 0 && <div className={styles.empty}>
              <div className={styles.emptyIcon}><MessagesSquare aria-hidden="true" /></div>
              <h3>{props.filtered || props.hasCursor ? text('filteredEmpty') : text('emptyHeading')}</h3>
              <p>{text('emptyBody')}</p>
              {props.filtered || props.hasCursor ? <Button variant="outline" size="lg" onClick={props.onViewAll}>{text('allTickets')}</Button> : <Button size="lg" onClick={() => props.onCompose(true)}><Plus data-icon="inline-start" aria-hidden="true" />{text('firstTicket')}</Button>}
            </div>}
            {list?.items.map(ticket => <article key={ticket.id} className={styles.ticketRow}>
              <div className={styles.ticketContent}>
                <h3><Link href={`/support/${ticket.id}`}>{ticket.subject}</Link></h3>
                <div className={styles.ticketMeta}><StatusBadge status={ticket.status} text={text} formatLabel={formatLabel} /><span>{formatLabel(ticket.category)}</span></div>
                <p className={styles.ticketUpdated}>{text('updated', { date: timestamp(ticket.updatedAt) })}{ticket.nextUpdateDueAt && <><br />{text('promise', { date: timestamp(ticket.nextUpdateDueAt) })} IST</>}</p>
              </div>
              <Button asChild variant="outline" size="lg"><Link href={`/support/${ticket.id}`}>{text('open')}<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
            </article>)}
            {list && (list.items.length > 0 || props.hasCursor) && <div className={styles.listFooter}>
              <p>{text('checked', { date: timestamp(list.asOf) })}</p>
              <div className={styles.pagination}>{props.hasCursor && <Button variant="outline" size="lg" onClick={props.onFirstPage}>{text('firstPage')}</Button>}{list.nextCursor && <Button variant="outline" size="lg" onClick={props.onNextPage}>{text('nextPage')}<ArrowRight data-icon="inline-end" aria-hidden="true" /></Button>}</div>
            </div>}
          </section>
        </>}
      </div>
      <SupportGuide text={text} />
    </div>
  </div>
}

type ThreadProps = TextProps & {
  detail: CustomerTicketDetail; error: string; notice: string; busy: boolean; pending: string | null; reply: string
  onReplyChange: (value: string) => void; onSend: () => void; onRefresh: () => void; onLoadOlder: (kind: 'message' | 'event') => void
}

export function CustomerSupportThreadView({ detail, text, formatLabel, timestamp, error, notice, busy, pending, reply, onReplyChange, onSend, onRefresh, onLoadOlder }: ThreadProps) {
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const { ticket } = detail
  return <div className={styles.page}>
    <header>
      <Link href="/support" className={styles.back}><ArrowLeft aria-hidden="true" />{text('back')}</Link>
      <div className={cn(styles.pageHeader, styles.threadHeader)}>
        <div className={styles.threadHeading}><StatusBadge status={ticket.status} text={text} formatLabel={formatLabel} /><h1>{ticket.subject}</h1><p>{text('updated', { date: timestamp(ticket.updatedAt) })}</p></div>
        <Button size="lg" onClick={() => { replyRef.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); replyRef.current?.focus({ preventScroll: true }) }}><Send data-icon="inline-start" aria-hidden="true" />{text('reply')}</Button>
      </div>
    </header>
    <div className={styles.columns}>
      <div className={styles.primaryColumn}>
        {error && <ErrorNotice onRetry={onRefresh} retryLabel={text('refreshTicket')}>{error.replace('Nothing has been confirmed sent. Your draft is retained in memory.', text('unsent'))}</ErrorNotice>}
        {notice && <p role="status" className={styles.notice}>{notice === 'Reply sent in-app.' ? text('sent') : notice}</p>}
        {pending && <p role="status" className={styles.notice}>{text('pendingAction')}</p>}
        <section className={styles.panel} aria-labelledby="support-conversation-heading">
          <div className={styles.panelHeading}><h2 id="support-conversation-heading">{text('conversationTitle')}</h2><p>{text('inApp')}</p></div>
          {detail.nextMessageBefore && <div className={styles.conversationFooter}><Button variant="outline" size="lg" disabled={busy} onClick={() => onLoadOlder('message')}>{text('loadOlder')}</Button></div>}
          {detail.messages.map(message => <article className={styles.message} data-author={message.authorKind} key={message.id}>
            <div className={styles.messageMeta}><strong>{message.authorKind === 'founder' ? text('founder') : text('you')}</strong><time dateTime={message.createdAt}>{timestamp(message.createdAt)} IST</time></div>
            <p className={styles.messageBody}>{message.body}</p>
          </article>)}
          {!detail.messages.length && <p className="p-6 text-sm text-muted-foreground">{text('noMessages')}</p>}
        </section>
        <section className={cn(styles.panel, styles.composer, styles.replySection)} aria-labelledby="support-reply-heading">
          <div className={styles.composerHeading}><div><h2 id="support-reply-heading">{text('replyTitle')}</h2>{ticket.status === 'resolved' && <p>{text('resolvedHelp')}</p>}</div></div>
          <label className={styles.field}>{text('message')}<Textarea ref={replyRef} value={reply} maxLength={10000} placeholder={text('replyPlaceholder')} disabled={busy || Boolean(pending)} onChange={event => onReplyChange(event.target.value)} /></label>
          <div className={styles.formFooter}><p>{text('enter')}</p><div><Button size="lg" disabled={busy || Boolean(pending && pending !== 'reply') || !reply.trim()} onClick={onSend}><Send data-icon="inline-start" aria-hidden="true" />{busy ? text('sending') : pending === 'reply' ? text('retryReply') : text('sendReply')}</Button></div></div>
        </section>
        <details className={cn(styles.panel, styles.history)}>
          <summary>{text('history')}<ChevronDown aria-hidden="true" /></summary>
          {detail.nextEventBefore && <Button variant="outline" size="lg" disabled={busy} onClick={() => onLoadOlder('event')}>{text('loadHistory')}</Button>}
          <ol>{detail.events.map(event => <li key={event.id}><span>{formatLabel(event.eventType)}{typeof event.after.status === 'string' && <> · {formatLabel(event.after.status)}</>}</span><time dateTime={event.createdAt}>{timestamp(event.createdAt)} IST</time></li>)}</ol>
        </details>
      </div>
      <aside className={cn(styles.panel, styles.details)} aria-labelledby="support-details-heading">
        <h2 id="support-details-heading">{text('ticketDetails')}</h2>
        <dl><div><dt>{text('status')}</dt><dd><StatusBadge status={ticket.status} text={text} formatLabel={formatLabel} /></dd></div><div><dt>{text('category')}</dt><dd>{formatLabel(ticket.category)}</dd></div><div><dt>{text('opened')}</dt><dd><time dateTime={ticket.createdAt}>{timestamp(ticket.createdAt)} IST</time></dd></div>{ticket.nextUpdateDueAt && <div><dt>{text('nextUpdate')}</dt><dd><time dateTime={ticket.nextUpdateDueAt}>{timestamp(ticket.nextUpdateDueAt)} IST</time></dd></div>}</dl>
        <PrivateConversation text={text} />
      </aside>
    </div>
  </div>
}
