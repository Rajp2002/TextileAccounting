'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { useTranslation } from '@/lib/i18n/context'
import { getMobileInputNavigation, keepMobileInputVisible, moveMobileInput } from '@/lib/mobile-input-navigation'

export function MobileInputNavigation() {
    const keyboardVisible = useMobileKeyboard()
    const [input, setInput] = useState<HTMLInputElement | null>(null)
    const activeInput = useRef<HTMLInputElement | null>(null)
    const { t } = useTranslation()

    useEffect(() => {
        let frame = 0
        const sync = () => {
            const element = document.activeElement
            if (element instanceof HTMLElement && element.closest('[data-mobile-input-accessory]')) return
            const next = element instanceof HTMLInputElement && getMobileInputNavigation(element) ? element : null
            activeInput.current = next
            setInput(next)
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
        const keepVisible = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                if (activeInput.current) keepMobileInputVisible(activeInput.current)
            })
        }
        keepVisible()
        window.visualViewport?.addEventListener('resize', keepVisible)
        return () => {
            cancelAnimationFrame(frame)
            window.visualViewport?.removeEventListener('resize', keepVisible)
            document.documentElement.style.removeProperty('--mobile-input-accessory-height')
        }
    }, [visible])

    if (!input || !navigation) return null

    const dialog = input.closest<HTMLElement>('[role="dialog"]')
    const move = (direction: 'previous' | 'next') => {
        const field = activeInput.current
        if (field) moveMobileInput(field, direction)
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
