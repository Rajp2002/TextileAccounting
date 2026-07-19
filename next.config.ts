import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

// ─── Security Headers ─────────────────────────────────────────────────────────
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://checkout.razorpay.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data: https://checkout.razorpay.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://lumberjack-dx.razorpay.com;
  media-src 'self';
  worker-src 'self' blob:;
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

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheStartUrl: false,
  // cacheStartUrl is disabled because "/" can redirect differently by auth
  // state. Keep dynamicStartUrl disabled too: the plugin otherwise adds its
  // own NetworkFirst cache for "/" even when cacheStartUrl is false.
  dynamicStartUrl: false,
  reloadOnOnline: false,
  // Keep the package's static asset strategies, while replacing only the
  // dynamic response caches below by their stable cache names.
  extendDefaultRuntimeCaching: true,
  fallbacks: {
    document: '/_offline',
  },
  publicExcludes: [
    '!videos/**/*',
    '!**/*.map',
    '!.DS_Store',
  ],
  workboxOptions: {
    exclude: [/\.map$/],
    skipWaiting: false,
    clientsClaim: false,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: 'NetworkOnly',
        options: { cacheName: 'next-data' },
      },
      {
        urlPattern: ({ sameOrigin, url: { pathname } }) =>
          sameOrigin &&
          pathname.startsWith('/api/') &&
          !pathname.startsWith('/api/auth/callback'),
        handler: 'NetworkOnly',
        method: 'GET',
        options: { cacheName: 'apis' },
      },
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          request.headers.get('RSC') === '1' &&
          request.headers.get('Next-Router-Prefetch') === '1' &&
          sameOrigin &&
          !pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
        options: { cacheName: 'pages-rsc-prefetch' },
      },
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          request.headers.get('RSC') === '1' &&
          sameOrigin &&
          !pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
        options: { cacheName: 'pages-rsc' },
      },
      {
        // Restrict this override to real document navigations. Custom runtime
        // rules are evaluated before the retained defaults, so a broad
        // same-origin matcher here would accidentally bypass static caches.
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          request.mode === 'navigate' &&
          sameOrigin &&
          !pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
        options: { cacheName: 'pages' },
      },
    ],
  },
})

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async rewrites() {
    return [{ source: '/_offline', destination: '/offline' }]
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

export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: {
    name: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    deploy: process.env.VERCEL_ENV ? { env: process.env.VERCEL_ENV } : undefined,
  },
  // Upload source maps silently (they're hidden from the browser, only for readable stack traces)
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Route Sentry tunnel to avoid ad-blocker interference
  tunnelRoute: '/monitoring',
});
