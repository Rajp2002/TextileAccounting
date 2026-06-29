import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function gitLines(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd().split('\n').filter(Boolean)
}

function readText(file) {
  return readFileSync(path.join(root, file), 'utf8')
}

function readJson(file) {
  return JSON.parse(readText(file))
}

function latestMigrationHead() {
  const migrationsDir = path.join(root, 'supabase/migrations')
  if (!existsSync(migrationsDir)) return null

  const migrations = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
  return migrations.at(-1)?.replace(/_.+$/, '').replace(/\.sql$/, '') ?? null
}

function readLocalSentryDsnShape() {
  const envPath = path.join(root, '.env.local')
  if (!existsSync(envPath)) return { configured: false }

  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((candidate) => candidate.match(/^\s*NEXT_PUBLIC_SENTRY_DSN\s*=/))

  if (!line) return { configured: false }

  const raw = line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
  try {
    const parsed = new URL(raw)
    return {
      configured: true,
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.host,
      projectId: parsed.pathname.replace(/^\//, ''),
      hasPublicKey: Boolean(parsed.username),
      publicKeyLength: parsed.username.length,
    }
  } catch {
    return { configured: Boolean(raw), parseError: true }
  }
}

const packageJson = readJson('package.json')
const nextConfig = readText('next.config.ts')
const clientInstrumentation = readText('instrumentation-client.ts')
const nodeInstrumentation = readText('instrumentation.ts')
const edgeInstrumentation = readText('instrumentation.edge.ts')
const proxy = readText('proxy.ts')
const webhook = readText('supabase/functions/whatsapp-webhook/index.ts')

const repositoryMigrationHead = latestMigrationHead()

const rowDefinitionsInspected = {
  'TECH-009': {
    source: 'docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md',
    test: 'Verify required environment variables without exposing values.',
    expected: 'Missing variables produce an intentional safe failure.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
  'TECH-010': {
    source: 'docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md',
    test: 'Verify production source maps, Sentry, and release version.',
    expected: 'Errors are attributable to the deployed commit without leaking PII.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
  'TECH-011': {
    source: 'docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md',
    test: 'Verify backup schedule and perform restore into a disposable project.',
    expected: 'Restored org, users, production, stock, receivables, and payroll reconcile.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
  'TECH-012': {
    source: 'docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md',
    test: 'Verify rollback procedure for application and database.',
    expected: 'Team can restore the last known good application and has a forward-fix plan for non-reversible migrations.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
  'SEC-011': {
    source: 'docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md',
    test: 'Secrets in client bundle, logs, repository, Sentry.',
    expected: 'None exposed.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
  'SIGNOFF-10': {
    source: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
    test: 'No unexplained console/server/Sentry error.',
    expected: 'Satisfied with current-run evidence.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
  'WA-008': {
    source: 'docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md',
    test: 'Webhook valid/invalid signature and status callback.',
    expected: 'Only valid callback updates intended delivery row.',
    activeMatrixSource: 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md',
  },
}

const humanEvidence = {
  freshProductionDeployment: {
    project: 'textile-accounting',
    url: 'https://textile-accounting.vercel.app',
    environment: 'Production',
    status: 'Ready / completed',
    branch: 'main',
    deployedCommitPrefix: '2538da25b2fa',
    buildCompleted: true,
    deploymentCompleted: true,
    buildDuration: '3m 38s',
    buildErrors: 'none observed',
    vercelWarningItemsShown: 24,
    sentryNoAuthTokenWarningsGone: true,
    buildLogSearches: {
      'No auth token provided': 'no results',
      'not create release': 'no results',
      'upload source maps': 'no results',
    },
  },
  sentryRelease: {
    accessible: true,
    org: 'vastra',
    project: 'javascript-nextjs',
    releaseExists: true,
    releaseName: '2538da25b2fa',
    releaseCommitSha: '2538da25b2fa',
    matchesDeployedCommit: true,
    deployEnvironment: 'production',
    deployedAtDescription: 'Jun 29, about 12 minutes before screenshot',
    createdAtDescription: 'Jun 29, 3:10 PM',
    finalizedAtDescription: 'Jun 29, 3:11 PM',
    sourceMapsOrArtifactsVisible: true,
    sourceMapArtifactCount: 529,
    mappedEventId: null,
    mappedStackFrameOriginalSourceProof: null,
    issuesInRelease: 0,
    errorCount: 0,
    transactionCount: 0,
    livePayloadInspectionAvailable: false,
  },
  deployedBrowserSmoke: {
    routes: [
      {
        route: '/login',
        pageLoadedVisually: true,
        consoleErrorsObserved: true,
        failedNetworkRequestsObserved: true,
        cspBlobWorkerErrorVisible: false,
        monitoring403Visible: true,
        summary: 'Login form loaded; previous CSP worker error was gone; repeated /monitoring?... HTTP 403 errors remained.',
      },
      {
        route: '/privacy',
        pageLoadedVisually: true,
        consoleErrorsObserved: true,
        failedNetworkRequestsObserved: true,
        cspBlobWorkerErrorVisible: false,
        monitoring403Visible: true,
        summary: 'Privacy Policy page loaded; previous CSP worker error was gone; repeated /monitoring?... HTTP 403 errors remained.',
      },
    ],
    safeDataCopied: 'no cookies, auth headers, request bodies, tokens, full env contents, or secrets',
  },
  restore: {
    backupScheduleVisible: false,
    disposableRestorePerformed: false,
  },
  rollback: {
    disposableRollbackEnvironmentAvailable: false,
    rollbackTested: false,
    forwardFixTested: false,
  },
  whatsappWebhook: {
    deployedWebhookUrlTested: false,
    validSignatureProofAvailable: false,
    invalidSignatureProofAvailable: false,
  },
}

const localConfiguration = {
  releaseGatePresent: packageJson.scripts?.test === 'vitest run' && packageJson.scripts?.prebuild === 'npm run test',
  sentryTunnel: {
    withSentryTunnelRoute: nextConfig.includes("tunnelRoute: '/monitoring'"),
    manualClientTunnelRemoved: !clientInstrumentation.includes('tunnel:') && !clientInstrumentation.includes('/api/sentry-tunnel'),
    manualApiTunnelRouteRemoved: !existsSync(path.join(root, 'app/api/sentry-tunnel/route.ts')),
    proxyExcludesMonitoring: proxy.includes('?!monitoring|_next/static'),
    proxyNoLongerWhitelistsManualTunnel: !proxy.includes("pathname === '/api/sentry-tunnel'"),
    sdkRewriteBehavior: '/monitoring?o=<orgId>&p=<projectId>&r=<region> rewrites to the Sentry SaaS envelope ingest endpoint',
  },
  csp: {
    workerSrcSelfBlob: nextConfig.includes("worker-src 'self' blob:;"),
    noWildcardWorkerSrc: !nextConfig.includes('worker-src *'),
    connectSrcAllowsSelf: nextConfig.includes("connect-src 'self'"),
    connectSrcAllowsSentryIngest: nextConfig.includes('https://*.ingest.sentry.io'),
  },
  sentryReleaseSourceMaps: {
    withSentryConfigPresent: nextConfig.includes('withSentryConfig'),
    authTokenOptionPresent: nextConfig.includes('authToken: process.env.SENTRY_AUTH_TOKEN'),
    releaseNameTiedToDeploymentCommit: nextConfig.includes('process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA'),
    widenClientFileUploadPresent: nextConfig.includes('widenClientFileUpload: true'),
    sentryAuthTokenEnvAvailableToLocalProcess: Boolean(process.env.SENTRY_AUTH_TOKEN),
    localDsnShape: readLocalSentryDsnShape(),
  },
  redaction: {
    sharedHelperPresent: existsSync(path.join(root, 'lib/sentry-redaction.ts')),
    clientUsesSharedRedaction: clientInstrumentation.includes('redactSentryEvent(event)'),
    nodeUsesSharedRedaction: nodeInstrumentation.includes('redactSentryEvent(event)'),
    edgeUsesSharedRedaction: edgeInstrumentation.includes('redactSentryEvent(event)'),
  },
  whatsappWebhookFailClosedSource: {
    requiresMetaAppSecret: webhook.includes('if (!appSecret)'),
    rejectsMissingSecret: webhook.includes('Webhook signing secret not configured'),
    rejectsMissingSignature: webhook.includes('Missing signature'),
    rejectsInvalidSignature: webhook.includes('Invalid signature'),
    oldFailOpenWarningAbsent: !webhook.includes('signature verification disabled'),
  },
}

const monitoring403Diagnosis = {
  observedOnFreshDeployment: true,
  likelyCause: 'Sentry ingest/client-key/project configuration rejected tunneled browser envelopes with HTTP 403 after the Next.js tunnel rewrite.',
  evidenceForNotProxyAuth: [
    'proxy.ts matcher excludes /monitoring before auth/session checks run',
    'next.config.ts uses @sentry/nextjs withSentryConfig tunnelRoute /monitoring',
    '@sentry/nextjs rewrites /monitoring?o=<orgId>&p=<projectId>&r=<region> to the Sentry SaaS envelope ingest endpoint',
    'Fresh /login and /privacy pages loaded visually, so deployment protection is not blocking the whole site',
    'CSP worker-src blob issue disappeared after Batch 8, leaving only /monitoring HTTP 403',
  ],
  localFixApplied: [
    'Removed stale manual app/api/sentry-tunnel route that the client no longer used',
    'Removed stale proxy public-route exception for /api/sentry-tunnel',
    'Added regression assertions that the manual route and whitelist remain absent',
  ],
  localFixExpectedToResolveFreshMonitoring403: false,
  externalProofNeeded: [
    'Confirm the Vercel Production NEXT_PUBLIC_SENTRY_DSN exactly belongs to Sentry org vastra project javascript-nextjs and matches the enabled Client Key used by release 2538da25b2fa.',
    'In Sentry Project Settings > Client Keys (DSN), confirm the browser client key is enabled and Allowed Domains permits textile-accounting.vercel.app or is not restricting this origin.',
    'Check Sentry project ingest filters/rate limits/security settings for rejected store/envelope requests around the smoke-test time.',
    'After any provider/env change, redeploy and repeat /login and /privacy browser smoke; closure needs no /monitoring 403 and no unexplained console/server/Sentry errors.',
  ],
}

const rowClassifications = {
  'TECH-009': {
    classification: 'partial',
    reason: 'WhatsApp webhook source still fails closed for missing/invalid signing inputs, but no deployed valid-signature and invalid-signature callback proof was provided.',
    evidence: ['supabase/functions/whatsapp-webhook/index.ts', '__tests__/release-runtime-config.test.ts'],
  },
  'TECH-010': {
    classification: 'pass-ready',
    reason: 'The row definition asks for production source maps, Sentry, and release version. Fresh deployment evidence shows release 2538da25b2fa exists for production, matches the deployed commit prefix, has 529 source-map/artifact entries, had no old auth-token/source-map skipped warnings, and had no build errors. No mapped event exists, so mapped-stack proof remains unavailable but is not explicitly required by the inspected row definition.',
    evidence: ['human evidence packet: fresh production deployment after SENTRY_AUTH_TOKEN', 'human evidence packet: Sentry release 2538da25b2fa with 529 artifacts'],
    caveats: ['No mapped event ID is available.', 'No live event payload is available for redaction inspection.'],
  },
  'TECH-011': {
    classification: 'blocked-external-evidence',
    reason: 'No disposable restore exercise, restored project ref, or restored data reconciliation evidence was provided.',
    evidence: ['human evidence packet: restore unavailable'],
  },
  'TECH-012': {
    classification: 'blocked-external-evidence',
    reason: 'No exercised application rollback or database forward-fix/restore exercise evidence was provided.',
    evidence: ['human evidence packet: rollback unavailable'],
  },
  'SEC-011': {
    classification: 'blocked-external-evidence',
    reason: 'Source redaction is locally tested, but no live Sentry event payload exists for current deployed commit inspection.',
    evidence: ['lib/sentry-redaction.ts', '__tests__/release-runtime-config.test.ts', 'human evidence packet: no live event payload'],
  },
  'SIGNOFF-10': {
    classification: 'blocked-partial',
    reason: 'Fresh deployed /login and /privacy pages load and the prior CSP worker error is gone, but repeated /monitoring?... HTTP 403 console/network errors remain. The active matrix requires clean browser/server/Sentry evidence.',
    evidence: ['human evidence packet: /login smoke', 'human evidence packet: /privacy smoke', 'monitoring403Diagnosis'],
  },
  'WA-008': {
    classification: 'not-closed',
    reason: 'No deployed valid-signature and invalid-signature WhatsApp status callback proof was provided.',
    evidence: ['human evidence packet: WhatsApp webhook proof unavailable'],
  },
}

const evidence = {
  runId: `BATCH8B-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
  capturedAt: new Date().toISOString(),
  git: {
    branch: git(['branch', '--show-current']),
    head: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    statusShort: gitLines(['status', '--short']),
  },
  repository: {
    migrationHead: repositoryMigrationHead,
  },
  rowDefinitionsInspected,
  humanEvidence,
  localConfiguration,
  monitoring403Diagnosis,
  rowClassifications,
  notes: [
    'No Supabase mutation, db push, db pull, migration repair, direct SQL, --include-all, npm audit, package install, or lockfile work was performed by this script.',
    'SENTRY_AUTH_TOKEN availability is recorded only as a boolean; no secret values are read or printed.',
    'The raw Sentry DSN is not printed; only non-secret shape fields are recorded.',
    'TECH-007 remains closed and is intentionally not reclassified by Batch 8B.',
  ],
}

const outDir = path.join(root, 'output/qa/batch8b')
mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, `${evidence.runId}-release-evidence-monitoring.json`)
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(outPath)
