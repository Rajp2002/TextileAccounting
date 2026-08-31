import { useCallback, useEffect, useRef } from 'react'
import { handleEnterKeyNavigation, type EnterKeyNavigationOptions } from '@/lib/form-navigation'

/**
 * Hook to enable Enter-key navigation on a container or the active window.
 *
 * @param options Configuration options for navigation
 * @returns ref to attach to the container element and an onKeyDown handler
 */
export function useEnterKeyNavigation<T extends HTMLElement = HTMLDivElement>(
    options: EnterKeyNavigationOptions = {}
) {
    const containerRef = useRef<T>(null)
    const optionsRef = useRef(options)
    optionsRef.current = options

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            handleEnterKeyNavigation(event, {
                container: containerRef.current,
                ...optionsRef.current,
            })
        },
        []
    )

    return {
        containerRef,
        onKeyDown,
    }
}
