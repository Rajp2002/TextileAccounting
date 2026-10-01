import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { assertLoopback, connect } from '../../scripts/test-db/cluster.mjs'
import { freshDatabase, type Db } from './helpers'

// Refactor Package 1B-1: the disposable database is a faithful, isolated
// replay of supabase/migrations.

let db: Db

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('disposable database harness', () => {
    it('INVARIANT: replays every migration except the hosted pg_cron/pg_net schedules', () => {
        const { migrations } = inject('weavlyDb')
        expect(migrations.skipped).toEqual([
            '20260401030000_pg_cron_schedule.sql',
            '20260402090000_pace_check_cron.sql',
            '20260402100000_monthly_brief_cron.sql',
            '20260402120000_retry_cron.sql',
            '20261001120000_keep_render_function_warm.sql',
        ])
        expect(migrations.applied).toBe(migrations.total - migrations.skipped.length)
        expect(migrations.applied).toBeGreaterThanOrEqual(296)
    })

    it('INVARIANT: every public table has row level security enabled', async () => {
        const { rows } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity ORDER BY tablename")
        expect(rows).toEqual([])
    })

    it('INVARIANT: the harness refuses to connect anywhere but loopback', () => {
        expect(() => assertLoopback('127.0.0.1')).not.toThrow()
        expect(() => assertLoopback('db.example.supabase.co')).toThrow('Refusing non-loopback database host')
        expect(() => connect({ host: '10.0.0.5', port: 5432 })).toThrow('Refusing non-loopback database host')
    })

    it('INVARIANT: the cluster listens on TCP loopback only', async () => {
        const { rows } = await db.query("SELECT current_setting('listen_addresses') AS listen, current_setting('unix_socket_directories') AS sockets")
        expect(rows[0]).toEqual({ listen: '127.0.0.1', sockets: '' })
    })
})
