/** Retire unscoped responses left by pre-auth-boundary service workers.
 * Static assets and principal-scoped paid drafts are intentionally untouched.
 */
export async function clearFreeLegacyResponses(storage: CacheStorage): Promise<void> {
  const retired = ['pages', 'pages-rsc', 'pages-rsc-prefetch', 'apis', 'next-data', 'static-data-assets', 'start-url']
  for (const name of await storage.keys()) {
    if (retired.some(base => name === base || name.startsWith(`${base}-`) || name.endsWith(`-${base}`))) {
      await storage.delete(name)
      continue
    }
    // Old Workbox defaults also cached cross-origin Supabase responses.
    if (name === 'cross-origin' || name.startsWith('cross-origin-')) {
      const cache = await storage.open(name)
      for (const request of await cache.keys()) {
        if (/^\/(rest|auth|storage)\/v1(?:\/|$)/.test(new URL(request.url).pathname)) await cache.delete(request)
      }
    }
  }
}
