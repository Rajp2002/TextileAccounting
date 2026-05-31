declare module 'next-pwa' {
  import type { NextConfig } from 'next'

  type RuntimeCaching = Record<string, unknown>

  type NextPWAOptions = {
    dest?: string
    disable?: boolean
    register?: boolean
    scope?: string
    sw?: string
    runtimeCaching?: RuntimeCaching[] | ((defaultRuntimeCaching: RuntimeCaching[]) => RuntimeCaching[])
    publicExcludes?: string[]
    buildExcludes?: Array<string | RegExp | ((...args: unknown[]) => boolean)>
    cacheStartUrl?: boolean
    dynamicStartUrl?: boolean
    dynamicStartUrlRedirect?: string
    fallbacks?: {
      document?: string
      image?: string
      audio?: string
      video?: string
      font?: string
      data?: string
    }
    cacheOnFrontEndNav?: boolean
    reloadOnOnline?: boolean
    skipWaiting?: boolean
    clientsClaim?: boolean
    cleanupOutdatedCaches?: boolean
    customWorkerDir?: string
    [key: string]: unknown
  }

  export default function withPWA(options?: NextPWAOptions): (nextConfig?: NextConfig) => NextConfig
}
