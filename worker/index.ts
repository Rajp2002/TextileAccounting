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

serviceWorkerSelf.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter(isLegacyProtectedRuntimeCache)
        .map((cacheName) => caches.delete(cacheName))
    ))
  )
})
