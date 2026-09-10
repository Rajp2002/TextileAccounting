'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface GutterDockOptions {
  /** Width of the application sidebar on desktop in pixels. Default: 248 */
  sidebarWidth?: number
  /** Card width when docked in pixels. Default: 248 */
  cardWidth?: number
  /** Minimum clearance on left and right side of card in pixels. Default: 16 (total gutter 280) */
  minClearance?: number
  /** Optional override for testing or forcing mode */
  forceDocked?: boolean
}

export interface GutterDockResult<T extends HTMLElement = HTMLDivElement> {
  containerRef: React.RefObject<T | null>
  isDocked: boolean
  dockStyle: React.CSSProperties
  gutterWidth: number
}

export function useGutterDock<T extends HTMLElement = HTMLDivElement>(
  options: GutterDockOptions = {}
): GutterDockResult<T> {
  const {
    sidebarWidth = 248,
    cardWidth = 248,
    minClearance = 16,
    forceDocked,
  } = options

  const minGutterRequired = cardWidth + minClearance * 2 // 280px

  const containerRef = useRef<T | null>(null)
  const [dockState, setDockState] = useState<{
    isDocked: boolean
    dockStyle: React.CSSProperties
    gutterWidth: number
  }>({
    isDocked: Boolean(forceDocked),
    dockStyle: forceDocked
      ? {
          position: 'fixed',
          left: `${sidebarWidth + minClearance}px`,
          bottom: '1.5rem',
          width: `${cardWidth}px`,
          zIndex: 25,
        }
      : {},
    gutterWidth: 0,
  })

  const updateDock = useCallback(() => {
    if (typeof window === 'undefined') return

    if (forceDocked !== undefined) {
      setDockState({
        isDocked: forceDocked,
        dockStyle: forceDocked
          ? {
              position: 'fixed',
              left: `${sidebarWidth + minClearance}px`,
              bottom: '1.5rem',
              width: `${cardWidth}px`,
              zIndex: 25,
            }
          : {},
        gutterWidth: minGutterRequired,
      })
      return
    }

    const container = containerRef.current
    if (!container) {
      setDockState(prev => (prev.isDocked ? { isDocked: false, dockStyle: {}, gutterWidth: 0 } : prev))
      return
    }

    const rect = container.getBoundingClientRect()
    // Gutter is the space between sidebar right (248px) and container left edge
    const gutter = rect.left - sidebarWidth

    if (gutter >= minGutterRequired && window.innerWidth >= 1200) {
      // Center the card in the available gutter
      const centeredLeft = Math.round(sidebarWidth + (gutter - cardWidth) / 2)
      setDockState(prev => {
        if (
          prev.isDocked &&
          prev.dockStyle.left === `${centeredLeft}px` &&
          prev.gutterWidth === gutter
        ) {
          return prev
        }
        return {
          isDocked: true,
          dockStyle: {
            position: 'fixed',
            left: `${centeredLeft}px`,
            bottom: '1.5rem',
            width: `${cardWidth}px`,
            zIndex: 25,
          },
          gutterWidth: gutter,
        }
      })
    } else {
      setDockState(prev => {
        if (!prev.isDocked && prev.gutterWidth === gutter) return prev
        return {
          isDocked: false,
          dockStyle: {},
          gutterWidth: Math.max(0, gutter),
        }
      })
    }
  }, [sidebarWidth, cardWidth, minClearance, minGutterRequired, forceDocked])

  useEffect(() => {
    updateDock()

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(updateDock, 60)
    }

    window.addEventListener('resize', handleResize, { passive: true })

    const observer = typeof ResizeObserver !== 'undefined' && containerRef.current
      ? new ResizeObserver(handleResize)
      : null

    if (observer && containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [updateDock])

  return {
    containerRef,
    isDocked: dockState.isDocked,
    dockStyle: dockState.dockStyle,
    gutterWidth: dockState.gutterWidth,
  }
}
