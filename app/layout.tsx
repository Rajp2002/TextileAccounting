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
  themeColor: "#FFF8EA",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "Weavly — Factory OS for Textile Weaving Units",
  description: "Weavly connects fabric costing, loom production logs, dispatches, advances, payroll, and WhatsApp briefs for grey fabric weaving factories.",
  // Apple PWA meta tags
  appleWebApp: {
    capable: true,
    title: "Weavly",
    // 'black-translucent' lets content extend behind the status bar
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-icon.png",
  },
}

import Providers from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        {/* Inline script: adds app-ready class to body as early as possible
            so the PWA splash background (#fdf6e9) transitions to the real
            app background without waiting for a full React render cycle.
            dangerouslySetInnerHTML is safe here — this is static JS with no
            user input. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.body.classList.add('app-ready');`,
          }}
        />
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}
