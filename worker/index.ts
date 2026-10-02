/// <reference lib="webworker" />

const LEGACY_PROTECTED_CACHE_NAMES = [
  'pages',
  'pages-rsc',
  'pages-rsc-prefetch',
  'apis',
  'next-data',
  'static-data-assets',
  'start-url',
  'cross-origin',
]

function isLegacyProtectedRuntimeCache(cacheName: string) {
  return LEGACY_PROTECTED_CACHE_NAMES.some((legacyName) => (
    cacheName === legacyName ||
    cacheName.endsWith(`-${legacyName}`) ||
    cacheName.startsWith(`${legacyName}-`)
  ))
}

const serviceWorkerSelf = self as unknown as ServiceWorkerGlobalScope

// Defined by Next's webpack configuration and inherited by the custom-worker
// child compilation. The URL stays /sw.js across deployments.
declare const __WEAVLY_BUILD_ID__: string

serviceWorkerSelf.addEventListener('message', (event) => {
  if (event.data?.type === 'WEAVLY_GET_BUILD_ID') {
    event.ports[0]?.postMessage({ type: 'WEAVLY_BUILD_ID', buildId: __WEAVLY_BUILD_ID__ })
  }
})

serviceWorkerSelf.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter(isLegacyProtectedRuntimeCache)
        .map((cacheName) => caches.delete(cacheName))
    ))
  )
})
