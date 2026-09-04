'use client'

import { useEffect, useState } from 'react'

/** Keep fixed mobile controls out of the way of the software keyboard. */
export function useMobileKeyboard() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const viewport = window.visualViewport
        const touchDevice = window.matchMedia('(any-pointer: coarse)')
        let baselineHeight = viewport?.height ?? window.innerHeight
        let baselineWidth = window.innerWidth
        let keyboardWasOpen = false
        let focusFrame = 0

        const isEditing = () => {
            const element = document.activeElement
            if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled
            if (element instanceof HTMLInputElement) {
                return !element.readOnly && !element.disabled && element.inputMode !== 'none'
                    && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(element.type)
            }
            return element instanceof HTMLElement && element.isContentEditable
        }

        const sync = () => {
            const height = viewport?.height ?? window.innerHeight
            // Rotation changes the resting height; don't mistake it for a keyboard.
            if (Math.abs(window.innerWidth - baselineWidth) > 80) {
                baselineWidth = window.innerWidth
                baselineHeight = window.innerHeight
            }
            // Ignore pinch zoom, which also shrinks the visual viewport.
            const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.05
            const shrunk = !zoomed && baselineHeight - height > 150
            keyboardWasOpen = Boolean(shrunk && (isEditing() || keyboardWasOpen))
            setVisible(touchDevice.matches && keyboardWasOpen)
            if (!shrunk && !zoomed && (!isEditing() || height > baselineHeight)) {
                baselineHeight = height
            }
        }

        const onFocus = () => {
            // Hide before iOS starts its keyboard animation. Viewport expansion
            // restores controls even when tapping Done leaves the input focused.
            if (touchDevice.matches && isEditing()) setVisible(true)
        }
        const onBlur = () => {
            cancelAnimationFrame(focusFrame)
            focusFrame = requestAnimationFrame(() => {
                if (!isEditing()) sync()
            })
        }

        sync()
        document.addEventListener('focusin', onFocus)
        document.addEventListener('focusout', onBlur)
        viewport?.addEventListener('resize', sync)
        window.addEventListener('resize', sync)
        return () => {
            cancelAnimationFrame(focusFrame)
            document.removeEventListener('focusin', onFocus)
            document.removeEventListener('focusout', onBlur)
            viewport?.removeEventListener('resize', sync)
            window.removeEventListener('resize', sync)
        }
    }, [])

    return visible
}
