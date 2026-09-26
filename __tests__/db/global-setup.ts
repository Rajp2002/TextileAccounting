import path from 'node:path'
import type { TestProject } from 'vitest/node'
import {
    connect,
    createSupabaseRoles,
    installSupabaseStubs,
    replayMigrations,
    startDisposableCluster,
} from '../../scripts/test-db/cluster.mjs'

export type WeavlyTestDatabase = {
    host: string
    port: number
    template: string
    migrations: { total: number; applied: number; skipped: string[] }
}

declare module 'vitest' {
    export interface ProvidedContext {
        weavlyDb: WeavlyTestDatabase
    }
}

const TEMPLATE = 'weavly_template'

// Build one fully migrated template database; each test file clones it.
export default async function setup(project: TestProject) {
    const cluster = await startDisposableCluster()
    try {
        const admin = connect(cluster)
        await admin.connect()
        await createSupabaseRoles(admin)
        await admin.query(`CREATE DATABASE ${TEMPLATE}`)
        await admin.end()

        const template = connect({ ...cluster, database: TEMPLATE })
        await template.connect()
        await installSupabaseStubs(template)
        const migrations = await replayMigrations(template, path.resolve(__dirname, '../../supabase/migrations'))
        await template.end()

        project.provide('weavlyDb', { host: cluster.host, port: cluster.port, template: TEMPLATE, migrations })
    } catch (error) {
        cluster.stop()
        throw error
    }
    return () => cluster.stop()
}
