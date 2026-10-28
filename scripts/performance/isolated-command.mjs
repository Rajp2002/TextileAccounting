// Run local tests/builds without inheriting configured remote-service targets.
// Usage: node scripts/performance/isolated-command.mjs npm run build
import { readFileSync, readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const env = Object.fromEntries(
    ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL', 'SYSTEMROOT']
        .filter(key => process.env[key] !== undefined)
        .map(key => [key, process.env[key]]),
)
// Next loads .env files itself. Explicit empty values prevent those files
// restoring credentials or hosted URLs to this child process.
for (const file of readdirSync('.').filter(file => file.startsWith('.env'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) {
        env[match[1]] = ''
    }
}
Object.assign(env, {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-performance-placeholder',
    NEXT_PUBLIC_SUPABASE_PROJECT_ID: 'localperformance',
    SUPABASE_SERVICE_ROLE_KEY: 'local-performance-placeholder',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '',
    SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '',
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
    RUN_LIVE_SUPABASE_TESTS: '0', NEXT_TELEMETRY_DISABLED: '1',
})
// Performance harness builds may compile a Sentry DSN that points at the
// harness's fake backend, so Sentry initialises as in production. Loopback only.
const harnessDsn = process.env.WEAVLY_HARNESS_SENTRY_DSN
if (harnessDsn) {
    if (!/^http:\/\/[a-z0-9]+@127\.0\.0\.1:\d+\/\d+$/.test(harnessDsn)) throw new Error('WEAVLY_HARNESS_SENTRY_DSN must be a loopback DSN')
    env.NEXT_PUBLIC_SENTRY_DSN = harnessDsn
}
const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('Pass a command and arguments')
const child = spawn(command, args, { env, stdio: 'inherit' })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
