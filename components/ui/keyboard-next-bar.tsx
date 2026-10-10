'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { useTranslation, type Language } from '@/lib/i18n/context'
import {
    DEFAULT_INPUT_SELECTOR,
    findNavigableFormInputs,
    focusAndSelectInput,
    keepFieldInVisibleViewport,
} from '@/lib/form-navigation'

const CONTAINER_SELECTOR = '[data-enter-navigate-container]'
const BAR_HEIGHT = 56

const COPY: Record<Language, { next: string; done: string; previous: string }> = {
    en: { next: 'Next', done: 'Done', previous: 'Previous field' },
    hi: { next: 'अगला', done: 'हो गया', previous: 'पिछला फ़ील्ड' },
    gu: { next: 'આગળ', done: 'થઈ ગયું', previous: 'પાછલું ફીલ્ડ' },
}

/** The editable field the bar steps from, with the fields it can step to. */
function resolveField(element: Element | null) {
    if (!(element instanceof HTMLInputElement) || !element.matches(DEFAULT_INPUT_SELECTOR)) return null
    const container = element.closest<HTMLElement>(CONTAINER_SELECTOR)
    if (!container) return null
    const fields = findNavigableFormInputs(container)
    const index = fields.indexOf(element)
    return index === -1 ? null : { field: element, fields, index }
}

function fieldLabel(field: HTMLInputElement) {
    const text = field.labels?.[0]?.textContent || field.getAttribute('aria-label') || field.placeholder || ''
    // Labels carry inline status such as "— REQUIRED"; the bar names the field only.
    return text.replace(/\s+[—-]\s+REQUIRED$/i, '').replace(/\s*\([^)]*\)$/, '').trim()
}

function fieldUnit(field: HTMLInputElement) {
    return field.closest<HTMLElement>('[data-estimator-unit-field]')?.dataset.estimatorUnitField ?? null
}

/**
 * Phone number pads (the iPhone decimal pad in particular) have no Return key, so the
 * Enter navigation inside `[data-enter-navigate-container]` cannot be reached by typing.
 * While the software keyboard is open, this bar sits on top of it with a large Next
 * (Done on the last field) and a Previous, moving focus inside the user's tap so the
 * keyboard stays open.
 */
export function KeyboardNextBar({ summary }: { summary?: string | null }) {
    const { language } = useTranslation()
    const copy = COPY[language] ?? COPY.en
    const keyboardVisible = useMobileKeyboard()
    const [active, setActive] = useState<HTMLInputElement | null>(null)
    // Bumped after each move so position and label are re-read from the DOM.
    const [, setRevision] = useState(0)

    useEffect(() => {
        let frame = 0
        const sync = () => {
            cancelAnimationFrame(frame)
            // focusout fires before the next field receives focus; read the settled state.
            frame = requestAnimationFrame(() => setActive(resolveField(document.activeElement)?.field ?? null))
        }
        document.addEventListener('focusin', sync)
        document.addEventListener('focusout', sync)
        return () => {
            cancelAnimationFrame(frame)
            document.removeEventListener('focusin', sync)
            document.removeEventListener('focusout', sync)
        }
    }, [])

    const visible = keyboardVisible && active !== null

    // Our bar adds height above the keyboard that the browser does not know about;
    // keep the focused field clear of it once the keyboard has settled.
    useEffect(() => {
        if (!visible || !active) return
        const timer = window.setTimeout(() => keepFieldInVisibleViewport(active), 320)
        return () => window.clearTimeout(timer)
    }, [active, visible])

    const move = useCallback((step: 1 | -1) => {
        const current = resolveField(document.activeElement)
        if (!current) return
        const target = current.fields[current.index + step]
        if (target) {
            focusAndSelectInput(target)
            setRevision(value => value + 1)
        } else if (step === 1) {
            current.field.blur()
        }
    }, [])

    if (!visible || !active) return null

    const current = resolveField(active)
    if (!current) return null
    const isLast = current.index === current.fields.length - 1
    const label = fieldLabel(active)
    const unit = fieldUnit(active)

    // Pressing a bar button must not take focus from the field, or the keyboard closes.
    const keepFocus = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault()

    return (
        <div
            data-keyboard-next-bar
            role="toolbar"
            aria-label={label || undefined}
            className="fixed inset-x-0 z-[70] flex items-center gap-2 border-t border-hairline bg-surface px-3 shadow-xs"
            style={{
                height: BAR_HEIGHT,
                top: `calc(var(--mobile-viewport-top, 0px) + var(--mobile-viewport-height, 100dvh) - ${BAR_HEIGHT}px)`,
            }}
        >
            <button
                type="button"
                aria-label={copy.previous}
                disabled={current.index === 0}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => move(-1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline text-ink disabled:opacity-35"
            >
                <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold text-ink">
                    {label}
                    {unit ? <span className="font-medium text-muted-foreground"> · {unit}</span> : null}
                </p>
                <p className="truncate text-[11px] font-medium text-muted-foreground" data-i18n-skip="true">
                    {current.index + 1}/{current.fields.length}
                    {summary ? <> · {summary}</> : null}
                </p>
            </div>
            <button
                type="button"
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => move(1)}
                className="flex h-11 min-w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-semibold text-surface"
            >
                {isLast ? copy.done : copy.next}
                {isLast ? <Check className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
            </button>
        </div>
    )
}
