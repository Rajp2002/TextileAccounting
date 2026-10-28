// Preloaded into `next start` by the harness's --cold mode.
//
// 1. `next start` loads every route's server code at boot
//    (experimental.preloadEntriesOnStart); Vercel runs Next in minimal mode,
//    which does not, so a function's first request loads its route's code.
//    Turn the preload off so first requests here pay the same loading.
// 2. Record every CommonJS file evaluated, with its own time (compile and
//    top-level evaluation, minus files it required). Webpack chunk files only
//    register module factories; the modules themselves run inside whichever
//    file first requires them (usually the route's page.js or route.js).
//    Each record names its root: the outermost file of the synchronous
//    require chain it was loaded in (Proxy's middleware.js, instrumentation.js,
//    next.config, a route's page.js), so time can be grouped by what pulled
//    it in. Written to WEAVLY_COLD_MODULE_LOG on exit.
// Preloads run before any bundler or loader; getBuiltinModule needs no require().
const Module = process.getBuiltinModule('node:module')
const { writeFileSync } = process.getBuiltinModule('node:fs')

const originalLoad = Module._load
Module._load = function load(...loadArgs) {
    const exported = originalLoad.apply(this, loadArgs)
    // NextNodeServer, however it was required.
    if (typeof exported?.default?.prototype?.unstable_preloadEntries === 'function') {
        exported.default.prototype.unstable_preloadEntries = async function skipPreload() {}
    }
    return exported
}

const output = process.env.WEAVLY_COLD_MODULE_LOG
if (output) {
    const records = []
    const childTime = []
    const chain = []
    const compile = Module.prototype._compile
    Module.prototype._compile = function timedCompile(content, filename) {
        const startedAt = performance.now()
        childTime.push(0)
        chain.push(filename)
        const root = chain[0]
        try {
            return compile.apply(this, arguments)
        } finally {
            const totalMs = performance.now() - startedAt
            const children = childTime.pop()
            chain.pop()
            if (childTime.length) childTime[childTime.length - 1] += totalMs
            records.push({ file: filename, root, at: performance.timeOrigin + startedAt, totalMs, selfMs: totalMs - children, bytes: content.length })
        }
    }
    process.on('exit', () => writeFileSync(output, JSON.stringify(records)))
}
