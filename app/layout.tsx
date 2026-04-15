import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "Loomi — Textile Production Management",
  description: "B2B SaaS PWA for Indian textile manufacturers. Track production, manage workers, and automate daily briefs.",
  // Apple PWA meta tags
  appleWebApp: {
    capable: true,
    title: "Loomi",
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
        className={`${jakarta.variable} ${geistMono.variable} antialiased font-sans`}
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
