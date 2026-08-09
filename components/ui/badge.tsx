import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold leading-[1.35] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-surface-soft text-body border-hairline [a&]:hover:bg-surface-muted",
        destructive:
          "bg-risk-soft text-risk border-risk-soft [a&]:hover:bg-risk-soft focus-visible:ring-risk/20 dark:focus-visible:ring-risk/40",
        outline:
          "border-hairline text-body [a&]:hover:bg-saffron-soft/60 [a&]:hover:text-ink",
        warning:
          "bg-warning-soft text-warning border-warning-soft [a&]:hover:bg-warning-soft",
        success:
          "bg-success-soft text-success border-success-soft [a&]:hover:bg-success-soft",
        risk:
          "bg-risk-soft text-risk border-risk-soft [a&]:hover:bg-risk-soft",
        info:
          "bg-info-soft text-info border-info-soft [a&]:hover:bg-info-soft",
        brand:
          "bg-saffron-soft text-saffron-deep border-saffron-soft [a&]:hover:bg-saffron-soft",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-saffron-deep underline-offset-4 [a&]:hover:underline",

      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
