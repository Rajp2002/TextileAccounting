import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold leading-[1.3] transition-[color,background-color,border-color,box-shadow,transform] duration-150 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-button)] hover:bg-[var(--wv-action-primary-hover)] hover:text-primary-foreground",
        saffron:
          "bg-saffron text-ink shadow-[var(--shadow-button)] hover:bg-[var(--wv-action-accent-hover)]",
        destructive:
          "bg-risk text-white shadow-[var(--shadow-button)] hover:bg-risk/90 focus-visible:ring-risk/20 dark:focus-visible:ring-risk/40",
        outline:
          "border border-input bg-surface text-ink shadow-xs hover:border-[var(--wv-border-strong)] hover:bg-surface-soft hover:text-ink",
        secondary:
          "border border-input bg-surface text-ink shadow-xs hover:border-[var(--wv-border-strong)] hover:bg-surface-soft hover:text-ink",
        ghost:
          "text-body hover:bg-surface-soft hover:text-ink",
        link: "text-saffron-deep underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
