"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// The look lives in app/globals.css ("Toasts"), keyed on Sonner's data
// attributes, so callers that import `sonner` directly get it too.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // The app has no dark theme. Following the OS would hand Sonner its dark
      // palette and wash the description text out on our light card.
      theme="light"
      className="toaster group"
      // Top centre stays clear of the floating bottom-right shortcuts, the
      // mobile tab bar, bottom sheets and the on-screen keyboard.
      position="top-center"
      offset={{ top: 16 }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: "max(12px, env(safe-area-inset-left, 0px))", right: "max(12px, env(safe-area-inset-right, 0px))", bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      gap={8}
      duration={4200}
      closeButton
      icons={{
        success: <CircleCheckIcon />,
        info: <InfoIcon />,
        warning: <TriangleAlertIcon />,
        error: <OctagonXIcon />,
        loading: <Loader2Icon className="animate-spin" />,
        close: <XIcon />,
      }}
      {...props}
    />
  )
}

export { Toaster }
