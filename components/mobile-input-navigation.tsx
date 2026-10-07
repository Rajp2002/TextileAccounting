'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { useTranslation } from '@/lib/i18n/context'
import { hasIosFieldBar } from '@/lib/form-navigation'
import { getMobileInputNavigation, keepMobileInputVisible, moveMobileInput, openNextCollapsedSection } from '@/lib/mobile-input-navigation'

export function MobileInputNavigation() {
    const keyboardVisible = useMobileKeyboard()
    const [input, setInput] = useState<HTMLInputElement | null>(null)
    const activeInput = useRef<HTMLInputElement | null>(null)
    const [, setFlowVersion] = useState(0)
    const { t } = useTranslation()

    useEffect(() => {
        // iOS always draws its own ∧ ∨ ✓ bar for these fields and no page can remove it. A second
        // bar would only cover the field iOS has just scrolled above its own, so iOS keeps the flow;
        // its ∨ cannot open a collapsed yarn row, so the next row opens while the field before it is used.
        const iosFieldBar = hasIosFieldBar()
        let frame = 0
        const sync = () => {
            const element = document.activeElement
            if (element instanceof HTMLElement && element.closest('[data-mobile-input-accessory]')) return
            const field = element instanceof HTMLInputElement && getMobileInputNavigation(element) ? element : null
            if (iosFieldBar) {
                if (field) openNextCollapsedSection(field)
                return
            }
            activeInput.current = field
            setInput(field)
        }
        const onBlur = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(sync)
        }
        sync()
        document.addEventListener('focusin', sync)
        document.addEventListener('focusout', onBlur)
        return () => {
            cancelAnimationFrame(frame)
            document.removeEventListener('focusin', sync)
            document.removeEventListener('focusout', onBlur)
        }
    }, [])

    const navigation = input && keyboardVisible ? getMobileInputNavigation(input) : null
    const visible = Boolean(navigation)
    useEffect(() => {
        if (!visible) return
        document.documentElement.style.setProperty('--mobile-input-accessory-height', '56px')
        let frame = 0
        let refreshFrame = 0
        const keepVisible = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                if (activeInput.current) keepMobileInputVisible(activeInput.current)
            })
        }
        // Typing can add or remove fields (a component count adds yarn rows).
        const refresh = () => {
            cancelAnimationFrame(refreshFrame)
            refreshFrame = requestAnimationFrame(() => setFlowVersion(version => version + 1))
        }
        keepVisible()
        window.visualViewport?.addEventListener('resize', keepVisible)
        document.addEventListener('input', refresh)
        return () => {
            cancelAnimationFrame(frame)
            cancelAnimationFrame(refreshFrame)
            window.visualViewport?.removeEventListener('resize', keepVisible)
            document.removeEventListener('input', refresh)
            document.documentElement.style.removeProperty('--mobile-input-accessory-height')
        }
    }, [visible])

    if (!input || !navigation) return null

    const dialog = input.closest<HTMLElement>('[role="dialog"]')
    const move = (direction: 'previous' | 'next') => {
        const field = activeInput.current
        // A collapsed yarn row must open within this tap so its field can take focus.
        if (field) moveMobileInput(field, direction, toggle => flushSync(() => toggle.click()))
    }

    // Inside a modal, keep the controls in its focus/accessibility boundary.
    return createPortal(
        <div
            role="group"
            aria-label={t('common.input_navigation')}
            data-mobile-input-accessory="true"
            data-in-dialog={Boolean(dialog)}
            className="mobile-input-accessory"
            onPointerDown={event => event.preventDefault()}
        >
            <button type="button" disabled={!navigation.previous} onClick={() => move('previous')} aria-label={t('common.previous_field')}>
                <ChevronLeft aria-hidden="true" /><span>{t('common.previous_field')}</span>
            </button>
            <button type="button" disabled={!navigation.next} onClick={() => move('next')} aria-label={t('common.next_field')} data-primary={Boolean(navigation.next)}>
                <span>{t('common.next_field')}</span><ChevronRight aria-hidden="true" />
            </button>
            <button type="button" data-primary={!navigation.next} onClick={() => {
                activeInput.current?.blur()
                activeInput.current = null
                setInput(null)
            }}>
                <Check aria-hidden="true" /><span>{t('common.keyboard_done')}</span>
            </button>
        </div>,
        dialog ?? document.body,
    )
}
