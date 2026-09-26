// Disposable PostgreSQL for database behavior tests (`npm run test:db`).
// Creates a throwaway cluster in the OS temp directory, listening on
// 127.0.0.1 only, stubs the Supabase auth/storage/extension surface the
// migrations expect, and replays supabase/migrations in order. It never reads
// environment files and refuses any non-loopback connection target.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pg from 'pg'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

// Scheduled WhatsApp jobs need the hosted pg_cron and pg_net extensions.
const HOSTED_EXTENSION_ONLY = /create extension if not exists (pg_cron|pg_net)/i

export function assertLoopback(host) {
    if (!LOOPBACK_HOSTS.has(host)) throw new Error(`Refusing non-loopback database host: ${host}`)
}

export function connect({ host, port, database = 'postgres' }) {
    assertLoopback(host)
    return new pg.Client({ host, port, user: 'postgres', database })
}

function processEnv() {
    const env = { LC_ALL: 'C', LANG: 'C' }
    for (const key of ['PATH', 'HOME', 'TMPDIR']) if (process.env[key] !== undefined) env[key] = process.env[key]
    return env
}

function run(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8', env: processEnv() })
    if (result.error?.code === 'ENOENT') {
        throw new Error(`${command} was not found. npm run test:db needs the PostgreSQL server binaries (initdb, pg_ctl) on PATH.`)
    }
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`)
}

function freeLoopbackPort() {
    return new Promise((resolve, reject) => {
        const server = createServer()
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address()
            server.close(() => resolve(port))
        })
    })
}

export async function startDisposableCluster() {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'weavly-test-db-'))
    const stop = () => {
        spawnSync('pg_ctl', ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], { env: processEnv() })
        rmSync(dataDir, { recursive: true, force: true })
    }
    try {
        run('initdb', ['-D', dataDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-locale'])
        const port = await freeLoopbackPort()
        const serverOptions = [
            `-p ${port}`,
            '-c listen_addresses=127.0.0.1',
            "-c unix_socket_directories=''",
            // Durability is irrelevant for a cluster that is deleted afterwards.
            '-c fsync=off -c synchronous_commit=off -c full_page_writes=off',
        ].join(' ')
        run('pg_ctl', ['-D', dataDir, '-l', path.join(dataDir, 'server.log'), '-o', serverOptions, '-w', 'start'])
        return { host: '127.0.0.1', port, dataDir, stop }
    } catch (error) {
        stop()
        throw error
    }
}

/** Cluster-wide roles that Supabase provides and the migrations grant to. */
export async function createSupabaseRoles(client) {
    for (const role of ['anon', 'authenticated', 'service_role', 'supabase_auth_admin', 'authenticator']) {
        await client.query(`CREATE ROLE ${role}${role === 'service_role' ? ' BYPASSRLS' : ''}`)
    }
}

/**
 * Per-database stand-ins for the hosted Supabase schemas. auth.uid() and
 * auth.jwt() read the same request settings PostgREST sets, so tests can act
 * as a signed-in user with `SET ROLE authenticated` plus JWT claims.
 */
export async function installSupabaseStubs(client) {
    await client.query(`
        CREATE SCHEMA auth;
        CREATE SCHEMA extensions;
        CREATE SCHEMA storage;
        CREATE SCHEMA cron;
        CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
        CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
        CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb$$;
        CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_user::text$$;
        GRANT USAGE ON SCHEMA auth, extensions TO authenticated, anon, service_role;
        CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
        CREATE TABLE storage.objects(id uuid PRIMARY KEY, bucket_id text, name text, owner uuid, metadata jsonb);
        CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1, '/')$$;
        CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text, schedule text, command text, active boolean DEFAULT true);
        CREATE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS $$INSERT INTO cron.job(jobname, schedule, command) VALUES ($1, $2, $3) RETURNING jobid$$;
        CREATE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS $$WITH removed AS (DELETE FROM cron.job WHERE jobname = $1 RETURNING 1) SELECT count(*) > 0 FROM removed$$;
        CREATE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL, database text DEFAULT NULL, username text DEFAULT NULL, active boolean DEFAULT NULL)
            RETURNS void LANGUAGE sql AS $$UPDATE cron.job SET active = coalesce(alter_job.active, cron.job.active) WHERE jobid = job_id$$;
        -- Supabase's documented defaults for existing projects: objects created in
        -- public are granted to the API roles, and migrations revoke selectively.
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
    `)
}

/** Applies every migration in filename order; returns what was applied and skipped. */
export async function replayMigrations(client, migrationsDir) {
    const files = readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort()
    const applied = []
    const skipped = []
    for (const file of files) {
        const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
        if (HOSTED_EXTENSION_ONLY.test(sql)) {
            skipped.push(file)
            continue
        }
        try {
            await client.query(sql)
        } catch (error) {
            throw new Error(`Migration ${file} failed: ${error.message}`)
        }
        applied.push(file)
    }
    return { total: files.length, applied: applied.length, skipped }
}
