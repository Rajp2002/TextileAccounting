import { buildSentryReleaseScript } from '@/lib/sentry-release'

/**
 * Server-rendered so the release stays out of client bundles (see
 * lib/sentry-release.ts). Same release name the build registers in Sentry.
 */
export function SentryReleaseScript() {
    const release = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA
    if (!release) return null
    return <script dangerouslySetInnerHTML={{ __html: buildSentryReleaseScript(release) }} />
}
