import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  themeColor: "#F4F2EC",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
}

export const metadata: Metadata = {
  applicationName: "Weavly",
  title: "Weavly — Textile Costing & Production Management",
  description: "Textile costing for weaving factories. Start with Free, choose Lite for unlimited costings and yarn rates, or Base for production and worker settlement.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Weavly",
    // 'black-translucent' lets content extend behind the status bar and keeps env(safe-area-inset-top) active
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-icon.png?v=3",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#F4F2EC",
    "msapplication-tap-highlight": "no",
  },
}

import Providers from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"
import { SignInTimingReporter } from "@/components/telemetry/sign-in-timing-reporter"
import { LogoutTimingReporter } from "@/components/telemetry/logout-timing-reporter"
import { AppIntroPrePaintScript } from "@/components/intro/intro-pre-paint-script"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <AppIntroPrePaintScript />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        {/* Static timing mark, recorded before the route content arrives. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if (window.performance && typeof window.performance.mark === 'function') window.performance.mark('route_navigation_start');`,
          }}
        />
        <Providers>
          {children}
        </Providers>
        <SignInTimingReporter />
        <LogoutTimingReporter />
        <Toaster />
      </body>
    </html>
  )
}
