import { NextResponse } from 'next/server'
import { adminErrorResponse } from './errors'

export async function reportResponse(load: () => Promise<unknown>) {
    try { return NextResponse.json(await load(), { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } }) }
    catch (error) { return adminErrorResponse(error) }
}

export function queryObject(request: Request): Record<string, string> {
    const params = new URL(request.url).searchParams
    const query: Record<string, string> = {}
    for (const [key, value] of params) {
        if (key in query) query[key] = '\u0000' // duplicate/ambiguous inputs fail schema validation
        else query[key] = value
    }
    return query
}
