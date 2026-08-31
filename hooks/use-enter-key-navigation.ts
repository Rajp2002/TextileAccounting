import { useCallback, useRef } from 'react'
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

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            handleEnterKeyNavigation(event, {
                container: containerRef.current,
                ...options,
            })
        },
        [options]
    )

    return {
        containerRef,
        onKeyDown,
    }
}
