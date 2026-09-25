import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-[var(--color-placeholder)] focus-visible:border-ring focus-visible:ring-ring/25 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-24 w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
