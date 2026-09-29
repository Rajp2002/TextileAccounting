"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * On/off switch with the same "liquid" motion as `LiquidSegmented`: the knob
 * squashes into a droplet while pressed, glides across on a spring curve, and
 * the track floods with the brand colour behind it.
 */
function Switch({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch peer relative isolate inline-flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full border border-hairline-strong bg-surface-muted p-0.5 shadow-[inset_0_1px_2px_rgba(22,33,62,0.14)] transition-colors duration-300 outline-none before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] focus-visible:ring-2 focus-visible:ring-saffron/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-loom motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        data-slot="switch-fill"
        className="pointer-events-none absolute inset-0 -z-10 origin-left scale-x-[0.25] rounded-full bg-loom opacity-0 transition-[scale,opacity] duration-[420ms] [transition-timing-function:var(--ease-liquid)] group-data-[state=checked]/switch:scale-x-100 group-data-[state=checked]/switch:opacity-100 motion-reduce:transition-none"
      />
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-surface shadow-[0_2px_4px_rgba(22,33,62,0.3)] ring-0 transition-[translate,scale] duration-[480ms] [transition-timing-function:var(--ease-liquid)] group-active/switch:[scale:1.32_0.88] data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0 motion-reduce:transition-none"
      />
      {children}
    </SwitchPrimitive.Root>
  )
}

export { Switch }
