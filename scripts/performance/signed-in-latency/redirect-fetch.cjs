// Preloaded into `next start` by the harness. Builds made through
// isolated-command.mjs compile the Supabase URL as http://127.0.0.1:9 (a
// closed port); send those requests to the fake backend instead.
const target = process.env.WEAVLY_FAKE_BACKEND_ORIGIN
if (target) {
    const closedOrigin = /^http:\/\/127\.0\.0\.1:9(?=\/|$)/
    const originalFetch = globalThis.fetch
    globalThis.fetch = function redirectedFetch(input, init) {
        if (typeof input === 'string' && closedOrigin.test(input)) {
            input = input.replace(closedOrigin, target)
        } else if (input instanceof URL && closedOrigin.test(input.href)) {
            input = new URL(input.href.replace(closedOrigin, target))
        } else if (input && typeof input === 'object' && typeof input.url === 'string' && closedOrigin.test(input.url)) {
            input = new Request(input.url.replace(closedOrigin, target), input)
        }
        return originalFetch.call(this, input, init)
    }
}
