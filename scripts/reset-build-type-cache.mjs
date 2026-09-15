import { rmSync } from 'node:fs'

// Next.js stores incremental type-check state here when using the default
// distDir (.next). Recompute types instead of trusting state restored by CI.
// Keep webpack, dependency, and application caches intact.
const cachePath = '.next/cache/.tsbuildinfo'
rmSync(cachePath, { force: true })
console.log(`[build] Reset ${cachePath}; full TypeScript validation remains enabled.`)
