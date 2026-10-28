import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";
import type { RuntimeCaching } from "workbox-build";
import { archiveRuntimeSourceMaps } from './scripts/prune-runtime-source-maps.mjs';

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

const sensitiveRouteCaching: RuntimeCaching = {
  urlPattern: ({ sameOrigin, url: { pathname } }) => (
    sameOrigin && /^\/(?:api\/)?(?:admin|support)(?:\/|$)/.test(pathname)
  ),
  handler: 'NetworkOnly',
  options: { fetchOptions: { cache: 'no-store' } },
}

const authBoundaryRuntimeCaching: RuntimeCaching[] = [
  sensitiveRouteCaching,
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
  // The install downloads everything precached, on a phone's first visit
  // (landing page included) and again for whatever changed after a deploy.
  // Images and fonts are left to the CacheFirst static-asset rule below,
  // which keeps the ones a page actually loads: precaching them added
  // 2.1 MB of mostly unused screenshots and logos and 1 MB of font subsets
  // (next/font emits every Unicode subset; pages use Latin only).
  publicExcludes: [
    '!videos/**/*',
    '!images/**/*',
    '!**/*.map',
    '!.DS_Store',
  ],
  workboxOptions: {
    exclude: [/\.map$/, /static\/media\/.+\.woff2?$/],
    skipWaiting: false,
    clientsClaim: false,
    cleanupOutdatedCaches: true,
    runtimeCaching: authBoundaryRuntimeCaching,
  },
})

const nextConfig: NextConfig = {
  // VTracer loads its WASM file from node_modules at runtime; keep it unbundled so the file is traced.
  serverExternalPackages: ['@visioncortex/vtracer'],
  webpack(config, { buildId, webpack, isServer }) {
    config.plugins.push(new webpack.DefinePlugin({
      __WEAVLY_BUILD_ID__: JSON.stringify(buildId),
      // No Sentry performance tracing in the browser: its code was about half
      // of the Sentry chunk every page loads, landing and login included.
      // Errors are still reported, and lib/web-vitals keeps the page timings.
      // Server builds keep tracing.
      ...(isServer ? {} : { __SENTRY_TRACING__: false }),
    }))
    return config
  },
  compiler: {
    async runAfterProductionCompile({ distDir }) {
      console.log('[build] Archived uploaded server source maps:', await archiveRuntimeSourceMaps(distDir))
    },
  },
  // Sentry uploads these build artifacts separately. Keep them on disk for
  // upload, but do not copy server debugging maps into every runtime bundle.
  // Scope this to generated maps; application files and dependencies stay traced.
  outputFileTracingExcludes: {
    '/*': ['./.next/server/**/*.map'],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/admin/:path*', headers: protectedDocumentHeaders },
      { source: '/api/admin/:path*', headers: protectedDocumentHeaders },
      { source: '/support/:path*', headers: protectedDocumentHeaders },
      { source: '/api/support/:path*', headers: protectedDocumentHeaders },
      { source: '/free/:path*', headers: protectedDocumentHeaders },
      { source: '/api/free/:path*', headers: protectedDocumentHeaders },
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
    // Reuse a page visited in the last 30 seconds, so switching back to a tab is instant
    // instead of a skeleton and a server round trip. Server actions that revalidate clear
    // this cache, so the user's own saves show at once; another device's edits can take
    // up to 30 seconds to appear on a revisited tab (accepted 2026-10-08).
    staleTimes: { dynamic: 30 },
  },
  images: { formats: ['image/avif', 'image/webp'] },
};

export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // The SDK compiles the release into client code when it creates one, which
  // changed the shared Sentry chunk on every deploy and made every user
  // re-download and recompile it. Turn that off here, and let the plugin below
  // still create the release, upload source maps and mark the deploy. The
  // browser reads the release from the page (lib/sentry-release.ts).
  release: { create: false },
  webpack: {
    // Sentry wrapped Proxy and every page and route, which put another copy of
    // its SDK in each bundle; turning that off made a cold first request
    // 18-24% faster (docs/performance/latency-20261028/README.md, Task G).
    // Request errors still reach Sentry through onRequestError in
    // instrumentation.ts; Sentry's per-route spans and Proxy transactions stop.
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
    unstable_sentryWebpackPluginOptions: {
      release: {
        name: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
        inject: false,
        deploy: process.env.VERCEL_ENV ? { env: process.env.VERCEL_ENV } : undefined,
      },
    },
  },
  // Upload source maps silently (they're hidden from the browser, only for readable stack traces)
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Route Sentry tunnel to avoid ad-blocker interference
  tunnelRoute: '/monitoring',
  // Client init sets debug: false, so the SDK's debug logging is dead weight
  // in every first-load bundle.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
