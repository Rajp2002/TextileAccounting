import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";
import type { RuntimeCaching } from "workbox-build";

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

const protectedDocumentHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
]

const staticAssetCaching: RuntimeCaching = {
  urlPattern: ({ sameOrigin, request, url: { pathname } }) => (
    sameOrigin &&
    request.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    (
      pathname.startsWith('/_next/static/') ||
      pathname.startsWith('/images/') ||
      pathname.startsWith('/videos/') ||
      /^\/(?:icon|apple-icon|favicon)/i.test(pathname) ||
      /\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico|mov|mp4|webm)$/i.test(pathname)
    )
  ),
  handler: 'CacheFirst',
  options: {
    cacheName: 'weavly-static-assets-v2',
    expiration: {
      maxEntries: 160,
      maxAgeSeconds: 30 * 24 * 60 * 60,
    },
  },
}

const protectedRscCaching: RuntimeCaching = {
  urlPattern: ({ sameOrigin, request, url: { pathname } }) => (
    sameOrigin &&
    request.method === 'GET' &&
    request.headers.get('RSC') === '1' &&
    !pathname.startsWith('/_next/static/')
  ),
  handler: 'NetworkOnly',
  options: { fetchOptions: { cache: 'no-store' } },
}

const protectedApiCaching: RuntimeCaching = {
  urlPattern: ({ sameOrigin, request, url: { pathname } }) => (
    sameOrigin && request.method === 'GET' && pathname.startsWith('/api/')
  ),
  handler: 'NetworkOnly',
  options: { fetchOptions: { cache: 'no-store' } },
}

const protectedDocumentCaching: RuntimeCaching = {
  urlPattern: ({ sameOrigin, request }) => (
    sameOrigin && request.method === 'GET' && request.mode === 'navigate'
  ),
  handler: 'NetworkOnly',
  options: { fetchOptions: { cache: 'no-store' } },
}

// Keep a final same-origin GET rule so Next Router prefetches and non-RSC
// protected data requests cannot fall through to a generated NetworkFirst
// default. Static assets are matched first and remain safely cacheable.
const protectedSameOriginGetCaching: RuntimeCaching = {
  urlPattern: ({ sameOrigin, request, url: { pathname } }) => (
    sameOrigin &&
    request.method === 'GET' &&
    !pathname.startsWith('/_next/static/') &&
    !pathname.startsWith('/api/')
  ),
  handler: 'NetworkOnly',
  options: { fetchOptions: { cache: 'no-store' } },
}

const authBoundaryRuntimeCaching: RuntimeCaching[] = [
  staticAssetCaching,
  protectedRscCaching,
  protectedApiCaching,
  protectedDocumentCaching,
  protectedSameOriginGetCaching,
]

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  reloadOnOnline: false,
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
    runtimeCaching: authBoundaryRuntimeCaching,
  },
})

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/owner', headers: protectedDocumentHeaders },
      { source: '/owner/:path*', headers: protectedDocumentHeaders },
      { source: '/supervisor', headers: protectedDocumentHeaders },
      { source: '/supervisor/:path*', headers: protectedDocumentHeaders },
    ]
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
