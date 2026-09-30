"use client"

import * as React from "react"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type SwitchFieldProps = Omit<
  React.LabelHTMLAttributes<HTMLLabelElement>,
  "onChange"
> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** `pill` gives a bordered 40–44px control for toolbars and filter rows. */
  variant?: "plain" | "pill"
  icon?: React.ReactNode
  /** Trailing content such as a count badge. */
  trailing?: React.ReactNode
  /** Extra classes for the pill while the switch is on. */
  checkedClassName?: string
}

/** A `Switch` with its label; the whole row is the hit target. */
function SwitchField({
  checked,
  onCheckedChange,
  disabled,
  variant = "plain",
  icon,
  trailing,
  checkedClassName,
  className,
  children,
  ...props
}: SwitchFieldProps) {
  const id = React.useId()
  return (
    <label
      htmlFor={id}
      data-slot="switch-field"
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2.5 text-sm font-semibold text-body",
        variant === "pill" &&
          "min-h-11 rounded-xl border border-hairline bg-surface px-3 text-xs shadow-xs transition-colors hover:bg-surface-soft sm:text-sm",
        variant === "pill" && checked && checkedClassName,
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      {...props}
    >
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      {icon}
      <span>{children}</span>
      {trailing}
    </label>
  )
}

export { SwitchField }
