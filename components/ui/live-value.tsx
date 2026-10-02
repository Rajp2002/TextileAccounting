"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Changes closer together than this (typing, dragging a slider) form one burst,
 * and a burst settles once, on its first change, so the figure never flickers.
 */
const SETTLE_INTERVAL_MS = 200

/**
 * A live figure (a cost, price or margin) that settles in when its value
 * changes: the new digits rise 3px and fade up over 200ms. Pass the formatted
 * text as `value`; digits are tabular so the width holds while typing.
 */
function LiveValue({
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { value: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const previous = React.useRef(value)
  const lastChange = React.useRef(Number.NEGATIVE_INFINITY)

  React.useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    const now = performance.now()
    const startsBurst = now - lastChange.current >= SETTLE_INTERVAL_MS
    lastChange.current = now
    const element = ref.current
    if (!startsBurst || !element || typeof element.animate !== "function") return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    element.animate(
      [
        { opacity: 0.35, transform: "translateY(3px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    )
  }, [value])

  return (
    <span
      ref={ref}
      data-slot="live-value"
      className={cn("inline-block max-w-full tabular-nums", className)}
      {...props}
    >
      {value}
    </span>
  )
}

export { LiveValue }
