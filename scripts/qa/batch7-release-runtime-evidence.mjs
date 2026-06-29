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

function readJson(file) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'))
}

function readText(file) {
  return readFileSync(path.join(root, file), 'utf8')
}

const migrationsDir = path.join(root, 'supabase/migrations')
const migrations = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
  : []
const repositoryMigrationHead = migrations.at(-1)?.replace(/_.+$/, '').replace(/\.sql$/, '') ?? null

const packageJson = readJson('package.json')
const instrumentationFiles = [
  'instrumentation.ts',
  'instrumentation-client.ts',
  'instrumentation.edge.ts',
]

const evidence = {
  runId: `BATCH7-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
  capturedAt: new Date().toISOString(),
  git: {
    branch: git(['branch', '--show-current']),
    head: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    statusShort: gitLines(['status', '--short']),
  },
  releaseGateSource: {
    testScript: packageJson.scripts?.test ?? null,
    prebuildScript: packageJson.scripts?.prebuild ?? null,
    batch7EvidenceScript: packageJson.scripts?.['qa:batch7-release-runtime'] ?? null,
    testGatePresent: packageJson.scripts?.test === 'vitest run' && packageJson.scripts?.prebuild === 'npm run test',
  },
  sentrySourceConfig: {
    withSentryConfigPresent: readText('next.config.ts').includes('withSentryConfig'),
    uploadConfigPresent: readText('next.config.ts').includes('widenClientFileUpload: true'),
    sharedRedactionHelperPresent: existsSync(path.join(root, 'lib/sentry-redaction.ts')),
    instrumentationUsesSharedRedaction: Object.fromEntries(
      instrumentationFiles.map((file) => [file, readText(file).includes('redactSentryEvent(event)')])
    ),
  },
  whatsappWebhookFailClosedSource: {
    metaAppSecretRequired: readText('supabase/functions/whatsapp-webhook/index.ts').includes('if (!appSecret)'),
    missingSecretRejectionPresent: readText('supabase/functions/whatsapp-webhook/index.ts').includes('Webhook signing secret not configured'),
    oldFailOpenWarningAbsent: !readText('supabase/functions/whatsapp-webhook/index.ts').includes('signature verification disabled'),
  },
  migrations: {
    repositoryMigrationHead,
    repositoryMigrationCount: migrations.length,
    productionMigrationHead: null,
    productionMigrationEvidence: 'not collected: direct SQL, db pull, db push, and migration repair are forbidden for this Batch 7 run',
  },
  externalEvidence: {
    deployedUrl: null,
    deployedCommit: null,
    ciRun: null,
    sentryRelease: null,
    sentryMappedEvent: null,
    sentryPayloadReview: null,
    backupRestore: null,
    rollbackForwardFix: null,
    blocker: 'external deployment, Sentry, backup, and rollback provider evidence was not available to this local source-only collector',
  },
}

const outDir = path.join(root, 'output/qa/batch7')
mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, `${evidence.runId}-release-runtime-evidence.json`)
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(outPath)
