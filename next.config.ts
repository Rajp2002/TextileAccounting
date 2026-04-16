import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ─── Security Headers ─────────────────────────────────────────────────────────
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://checkout.razorpay.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data: https://checkout.razorpay.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://o*.ingest.sentry.io https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-dx.razorpay.com;
  media-src 'self';
  frame-src https://api.razorpay.com https://checkout.razorpay.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self' https://api.razorpay.com https://checkout.razorpay.com;
`.replace(/\s{2,}/g, ' ').trim()

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }] : []),
  { key: 'Content-Security-Policy', value: cspHeader },
]


const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        // Production Vercel deployment
        'textile-accounting.vercel.app',
        // All Vercel preview deployments  (textile-accounting-*.vercel.app)
        ...(process.env.NEXT_PUBLIC_SITE_URL
          ? [process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, '')]
          : []),
        // Vercel system env (set automatically on all deployments)
        ...(process.env.VERCEL_URL ? [process.env.VERCEL_URL] : []),
      ],
    },
    optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],
  },
  images: { formats: ['image/avif', 'image/webp'] },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps silently (they're hidden from the browser, only for readable stack traces)
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Route Sentry tunnel to avoid ad-blocker interference
  tunnelRoute: '/monitoring',
});



