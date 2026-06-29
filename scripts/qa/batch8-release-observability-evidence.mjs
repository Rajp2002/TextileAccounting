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

const packageJson = readJson('package.json')
const nextConfig = readText('next.config.ts')
const clientInstrumentation = readText('instrumentation-client.ts')
const proxy = readText('proxy.ts')
const webhook = readText('supabase/functions/whatsapp-webhook/index.ts')

const repositoryMigrationHead = latestMigrationHead()

const humanEvidence = {
  vercelProductionDeployment: {
    project: 'textile-accounting',
    url: 'https://textile-accounting.vercel.app',
    environment: 'Production',
    status: 'Ready / Latest',
    branch: 'main',
    commit: 'f9a0727c1131a2bb1d65b4994d57b4148cb27eea',
    deploymentId: 'dpl_HmaJirR5GZMyTZnwJrxxREaRJjGw',
    buildCompleted: true,
    buildErrors: 'none reported',
    sentryBuildWarnings: [
      'No auth token provided. Will not create release.',
      'No auth token provided. Will not upload source maps.',
    ],
  },
  deployedBrowserSmoke: {
    routes: ['/login', '/privacy'],
    pagesLoadedVisually: true,
    consoleErrorsObserved: true,
    consoleErrorSummary: [
      'CSP blocked blob worker because worker-src did not include blob:',
      'Repeated /monitoring?... requests returned HTTP 403',
    ],
    safeDataCopied: 'no cookies, auth headers, request bodies, tokens, or secrets',
  },
  supabaseMigrations: {
    method: 'supabase migration list --linked',
    expectedHead: '20260628185344',
    localRemoteAlignedThrough: '20260628185344',
    pendingMigrations: 'none reported',
    failedOrOutOfOrderMigrations: 'none reported',
  },
  sentry: {
    org: 'vastra',
    project: 'javascript-nextjs',
    currentReleaseForDeployedCommit: null,
    sourceMapsOrArtifactsVisible: false,
    mappedEventId: null,
    livePayloadInspectionAvailable: false,
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

const localHardening = {
  releaseGatePresent: packageJson.scripts?.test === 'vitest run' && packageJson.scripts?.prebuild === 'npm run test',
  sentryTunnel: {
    withSentryTunnelRoute: nextConfig.includes("tunnelRoute: '/monitoring'"),
    manualClientTunnelRemoved: !clientInstrumentation.includes('tunnel:') && !clientInstrumentation.includes('/api/sentry-tunnel'),
    proxyExcludesMonitoring: proxy.includes('?!monitoring|_next/static'),
  },
  csp: {
    workerSrcSelfBlob: nextConfig.includes("worker-src 'self' blob:;"),
    noWildcardWorkerSrc: !nextConfig.includes('worker-src *'),
  },
  sentryReleaseSourceMaps: {
    withSentryConfigPresent: nextConfig.includes('withSentryConfig'),
    authTokenOptionPresent: nextConfig.includes('authToken: process.env.SENTRY_AUTH_TOKEN'),
    releaseNameTiedToDeploymentCommit: nextConfig.includes('process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA'),
    widenClientFileUploadPresent: nextConfig.includes('widenClientFileUpload: true'),
    sentryAuthTokenEnvAvailable: Boolean(process.env.SENTRY_AUTH_TOKEN),
  },
  redaction: {
    sharedHelperPresent: existsSync(path.join(root, 'lib/sentry-redaction.ts')),
    clientUsesSharedRedaction: clientInstrumentation.includes('redactSentryEvent(event)'),
    nodeUsesSharedRedaction: readText('instrumentation.ts').includes('redactSentryEvent(event)'),
    edgeUsesSharedRedaction: readText('instrumentation.edge.ts').includes('redactSentryEvent(event)'),
  },
  whatsappWebhookFailClosedSource: {
    requiresMetaAppSecret: webhook.includes('if (!appSecret)'),
    rejectsMissingSecret: webhook.includes('Webhook signing secret not configured'),
    rejectsMissingSignature: webhook.includes('Missing signature'),
    rejectsInvalidSignature: webhook.includes('Invalid signature'),
    oldFailOpenWarningAbsent: !webhook.includes('signature verification disabled'),
  },
}

const rowClassifications = {
  'TECH-007': {
    classification: repositoryMigrationHead === humanEvidence.supabaseMigrations.localRemoteAlignedThrough ? 'pass-ready' : 'blocked',
    reason: 'Provided Supabase migration list evidence shows local and remote aligned through the repository migration head with no pending, failed, or out-of-order migrations.',
    evidence: ['human evidence packet: supabase migration list --linked', `repositoryMigrationHead=${repositoryMigrationHead}`],
  },
  'TECH-009': {
    classification: 'partial',
    reason: 'WhatsApp webhook source fails closed for missing/invalid signing inputs, but no deployed webhook runtime proof was provided.',
    evidence: ['supabase/functions/whatsapp-webhook/index.ts', 'release-runtime-config test coverage'],
  },
  'TECH-010': {
    classification: 'blocked-external-config-evidence',
    reason: 'Vercel build logs reported missing SENTRY_AUTH_TOKEN, so Sentry release creation and source-map upload did not run; no release, artifacts, or mapped event was found.',
    evidence: ['human evidence packet: Vercel Sentry warnings', 'human evidence packet: Sentry dashboard inspection'],
  },
  'TECH-011': {
    classification: 'blocked-external-evidence',
    reason: 'No backup schedule screenshot, disposable restore, restored project ref, or restored data reconciliation evidence was provided.',
    evidence: ['human evidence packet: restore unavailable'],
  },
  'TECH-012': {
    classification: 'blocked-external-evidence',
    reason: 'No disposable rollback or database forward-fix/restore exercise evidence was provided.',
    evidence: ['human evidence packet: rollback unavailable'],
  },
  'SEC-011': {
    classification: 'blocked-external-evidence',
    reason: 'Source redaction is locally tested, but no live Sentry event payload exists for current deployed commit inspection.',
    evidence: ['lib/sentry-redaction.ts', 'release-runtime-config redaction tests', 'human evidence packet: no live event'],
  },
  'SIGNOFF-10': {
    classification: 'blocked-partial',
    reason: 'Deployment loaded visually, but provided browser smoke showed CSP and /monitoring console/network errors; Sentry release/source-map/live event evidence is also unavailable.',
    evidence: ['human evidence packet: /login smoke', 'human evidence packet: /privacy smoke'],
  },
  'WA-008': {
    classification: 'not-closed',
    reason: 'No deployed valid-signature and invalid-signature WhatsApp callback proof was provided.',
    evidence: ['human evidence packet: WhatsApp webhook proof unavailable'],
  },
}

const evidence = {
  runId: `BATCH8-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
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
  humanEvidence,
  localHardening,
  rowClassifications,
  notes: [
    'No Supabase mutation, db push, db pull, migration repair, direct SQL, --include-all, npm audit, package install, or lockfile work was performed by this script.',
    'SENTRY_AUTH_TOKEN availability is recorded only as a boolean; no secret values are read or printed.',
    'External rows remain blocked or partial unless exact deployed/provider evidence exists.',
  ],
}

const outDir = path.join(root, 'output/qa/batch8')
mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, `${evidence.runId}-release-observability-evidence.json`)
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(outPath)
