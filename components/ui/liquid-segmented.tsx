"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type LiquidSegmentedOption<T extends string = string> = {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  /** DOM id on the option button (tours and labels anchor to it). */
  id?: string
  title?: string
  disabled?: boolean
  /** `aria-controls` target when the group has role="tablist". */
  controls?: string
  ariaLabel?: string
  /** Extra attributes for the option button, e.g. guided-tour anchors. */
  attrs?: Record<`data-${string}`, string>
}

type LiquidSegmentedProps<T extends string> = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "role"
> & {
  value: T
  onValueChange: (value: T) => void
  options: readonly LiquidSegmentedOption<T>[]
  /** `radiogroup` for a setting, `tablist` when the options swap a panel. */
  role?: "radiogroup" | "tablist"
  size?: "sm" | "md"
  fullWidth?: boolean
  disabled?: boolean
  optionClassName?: string
}

const SIZE_CLASS = {
  sm: "min-h-10 px-3 text-xs",
  md: "min-h-11 px-4 text-[13px]",
} as const

/**
 * Pill segmented control with a "liquid" thumb: the thumb glides to the chosen
 * option on a spring curve and stretches like a droplet while it travels.
 * Options share equal-width columns so the thumb position is pure CSS
 * (`--liquid-index`), which keeps server rendering and first paint correct.
 */
function LiquidSegmented<T extends string>({
  value,
  onValueChange,
  options,
  role = "radiogroup",
  size = "md",
  fullWidth = false,
  disabled = false,
  optionClassName,
  className,
  style,
  onKeyDown,
  ...props
}: LiquidSegmentedProps<T>) {
  const groupRef = React.useRef<HTMLDivElement>(null)
  const thumbRef = React.useRef<HTMLSpanElement>(null)
  const activeIndex = options.findIndex((option) => option.value === value)
  const previousIndex = React.useRef(activeIndex)

  React.useEffect(() => {
    const from = previousIndex.current
    previousIndex.current = activeIndex
    const thumb = thumbRef.current
    if (!thumb || from === activeIndex || from < 0 || activeIndex < 0) return
    if (typeof thumb.animate !== "function") return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const distance = Math.abs(activeIndex - from)
    const stretch = 1 + Math.min(0.3 + 0.12 * (distance - 1), 0.6)
    thumb.animate(
      [
        { scale: "1 1" },
        { scale: `${stretch} 0.84`, offset: 0.4 },
        { scale: "1 1" },
      ],
      { duration: 520, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)" }
    )
  }, [activeIndex])

  const optionRole = role === "tablist" ? "tab" : "radio"

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || disabled) return
    const enabled = options
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => !option.disabled)
    if (enabled.length === 0) return
    const position = enabled.findIndex(({ index }) => index === activeIndex)
    let next: number | null = null
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (position + 1) % enabled.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (position - 1 + enabled.length) % enabled.length
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = enabled.length - 1
    }
    if (next === null) return
    event.preventDefault()
    const target = enabled[next]
    onValueChange(target.option.value)
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>(`[role="${optionRole}"]`)
      [target.index]?.focus()
  }

  const count = Math.max(options.length, 1)

  return (
    <div
      ref={groupRef}
      data-slot="liquid-segmented"
      role={role}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative isolate grid rounded-full border border-hairline bg-surface-soft p-1 shadow-[inset_0_1px_2px_rgba(22,33,62,0.08)]",
        fullWidth ? "w-full" : "w-fit",
        className
      )}
      style={
        {
          gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
          "--liquid-index": Math.max(activeIndex, 0),
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <span
        ref={thumbRef}
        aria-hidden="true"
        data-slot="liquid-segmented-thumb"
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 z-0 rounded-full bg-loom shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_-3px_rgba(22,33,62,0.55)] transition-[translate,opacity] duration-[520ms] [transition-timing-function:var(--ease-liquid)] motion-reduce:transition-none",
          activeIndex < 0 && "opacity-0"
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${count})`,
          translate: "calc(var(--liquid-index) * 100%) 0",
        }}
      />
      {options.map((option, index) => {
        const selected = index === activeIndex
        const isTabStop = selected || (activeIndex < 0 && index === 0)
        return (
          <button
            key={option.value}
            id={option.id}
            type="button"
            role={optionRole}
            aria-checked={optionRole === "radio" ? selected : undefined}
            aria-selected={optionRole === "tab" ? selected : undefined}
            aria-controls={option.controls}
            aria-label={option.ariaLabel}
            {...option.attrs}
            title={option.title}
            tabIndex={isTabStop ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => {
              if (!selected) onValueChange(option.value)
            }}
            className={cn(
              "mobile-touch-target group/option relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full font-semibold leading-tight whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-saffron/70 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-soft disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
              SIZE_CLASS[size],
              selected ? "text-white" : "text-body/70 hover:text-ink",
              optionClassName
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { LiquidSegmented }
