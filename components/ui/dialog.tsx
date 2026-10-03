"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-ink/35 backdrop-blur-[3px]",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  hideOverlay = false,
  mobilePresentation = "sheet",
  tone,
  watermark: Watermark,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Solid brand-coloured card for short confirmations; omit for standard surface dialogs. */
  tone?: "brand" | "danger"
  /** Large faded icon drawn behind the content of a toned dialog. */
  watermark?: React.ElementType
  showCloseButton?: boolean
  hideOverlay?: boolean
  mobilePresentation?: "sheet" | "center"
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      {!hideOverlay && <DialogOverlay />}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-mobile-presentation={hideOverlay ? "center" : mobilePresentation}
        data-close-button={showCloseButton}
        data-tone={tone}
        className={cn(
          "bg-surface text-ink modal-spring fixed top-[50%] left-[50%] z-50 grid w-full max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-xl border border-hairline p-4 shadow-[var(--shadow-modal)] duration-200 outline-none sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-2xl sm:p-6",
          // Tone overrides follow the surface defaults; use Tailwind v4 gradient utilities.
          tone && "overflow-x-hidden border-transparent text-white",
          tone === "brand" && "bg-[#16213e] bg-linear-to-br from-[#2a3a6b] to-[#16213e]",
          tone === "danger" && "bg-[#7a2418] bg-linear-to-br from-[#b4432f] to-[#7a2418]",
          className
        )}
        {...props}
      >
        {tone && Watermark && (
          <Watermark
            aria-hidden
            className="pointer-events-none absolute -top-16 -left-16 z-0 size-64 rotate-12 text-white/10"
          />
        )}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full text-current opacity-80 transition-opacity hover:bg-surface-soft hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/**
 * Hero block for short confirmation modals: a faded watermark icon behind a
 * circular badge, centred above the title. Pair with `tone` on DialogContent.
 */
function DialogHero({
  icon: Icon,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { icon: React.ElementType }) {
  return (
    <div
      data-slot="dialog-hero"
      className={cn("relative z-10 flex flex-col items-center gap-2 text-center", className)}
      {...props}
    >
      <div className="grid size-16 place-items-center rounded-full bg-white text-3xl text-[#1f2d54] shadow-xs [&_svg]:size-8">
        <Icon aria-hidden />
      </div>
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-[1.3] font-semibold text-ink", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      asChild
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm leading-[1.45]", className)}
    >
      {/* Renders as a div instead of a paragraph to prevent HTML nesting errors when block elements are inside */}
      <div {...props} />
    </DialogPrimitive.Description>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
