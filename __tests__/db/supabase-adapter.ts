import { asServiceRole, asUser, type Db } from './helpers'

// A deliberately small stand-in for the Supabase JS client, backed by the
// disposable database. It covers only the calls the tested server actions
// make: `.rpc()` and simple `.from().select().eq()…` reads. Every call runs
// with the caller's identity, so RLS, grants and RPC checks apply as in
// production. Unsupported calls throw instead of guessing.

export type Identity = { kind: 'user'; userId: string; orgId: string } | { kind: 'service' }
type Result = { data: unknown; error: { message: string; code?: string } | null }
export type RpcCall = { fn: string; args: Record<string, unknown>; identity: Identity['kind'] }

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/
const SELECT_LIST = /^[a-z_][a-z0-9_]*(\s*,\s*[a-z_][a-z0-9_]*)*$/

function assertIdentifier(value: string) {
    if (!IDENTIFIER.test(value)) throw new Error(`Unsupported identifier in test adapter: ${value}`)
    return value
}

function toParam(value: unknown) {
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : value
}

function failure(error: unknown): Result {
    const { message, code } = error as { message: string; code?: string }
    return { data: null, error: { message, code } }
}

export function createTestSupabase(db: Db, identity: Identity, calls: RpcCall[] = []) {
    const become = () => (identity.kind === 'service'
        ? asServiceRole(db)
        : asUser(db, identity.userId, identity.orgId))

    return {
        async rpc(fn: string, args: Record<string, unknown> = {}): Promise<Result> {
            calls.push({ fn, args, identity: identity.kind })
            const names = Object.keys(args).map(assertIdentifier)
            const sql = `SELECT public.${assertIdentifier(fn)}(${names.map((name, index) => `${name} => $${index + 1}`).join(', ')}) AS result`
            try {
                await become()
                const { rows } = await db.query(sql, names.map(name => toParam(args[name])))
                return { data: rows[0]?.result ?? null, error: null }
            } catch (error) {
                return failure(error)
            }
        },
        from(table: string) {
            return new ReadQuery(db, assertIdentifier(table), become)
        },
    }
}

class ReadQuery implements PromiseLike<Result> {
    private columns = '*'
    private readonly filters: string[] = []
    private readonly values: unknown[] = []
    private readonly ordering: string[] = []
    private rowLimit: number | null = null

    constructor(private readonly db: Db, private readonly table: string, private readonly become: () => Promise<void>) {}

    select(columns = '*') {
        if (columns !== '*' && !SELECT_LIST.test(columns.trim())) throw new Error(`Unsupported select list in test adapter: ${columns}`)
        this.columns = columns.trim()
        return this
    }

    eq(column: string, value: unknown) {
        this.values.push(value)
        this.filters.push(`${assertIdentifier(column)} = $${this.values.length}`)
        return this
    }

    in(column: string, values: unknown[]) {
        this.values.push(values)
        this.filters.push(`${assertIdentifier(column)} = ANY($${this.values.length})`)
        return this
    }

    is(column: string, value: null) {
        if (value !== null) throw new Error('Test adapter only supports .is(column, null)')
        this.filters.push(`${assertIdentifier(column)} IS NULL`)
        return this
    }

    order(column: string, options: { ascending?: boolean } = {}) {
        this.ordering.push(`${assertIdentifier(column)} ${options.ascending === false ? 'DESC' : 'ASC'}`)
        return this
    }

    limit(count: number) {
        this.rowLimit = count
        return this
    }

    private async rows() {
        const where = this.filters.length ? ` WHERE ${this.filters.join(' AND ')}` : ''
        const order = this.ordering.length ? ` ORDER BY ${this.ordering.join(', ')}` : ''
        const limit = this.rowLimit == null ? '' : ` LIMIT ${Number(this.rowLimit)}`
        await this.become()
        const { rows } = await this.db.query(`SELECT ${this.columns} FROM public.${this.table}${where}${order}${limit}`, this.values)
        return rows
    }

    async maybeSingle(): Promise<Result> {
        try {
            const rows = await this.rows()
            if (rows.length > 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
            return { data: rows[0] ?? null, error: null }
        } catch (error) {
            return failure(error)
        }
    }

    async single(): Promise<Result> {
        const result = await this.maybeSingle()
        if (!result.error && result.data == null) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
        return result
    }

    then<T1 = Result, T2 = never>(resolve?: ((value: Result) => T1 | PromiseLike<T1>) | null, reject?: ((reason: unknown) => T2 | PromiseLike<T2>) | null) {
        return this.rows().then(rows => ({ data: rows, error: null }), failure).then(resolve, reject)
    }
}
