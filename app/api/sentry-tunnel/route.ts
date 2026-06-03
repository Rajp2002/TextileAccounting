import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.text()
        const parts = body.split('\n')
        if (parts.length < 1) {
            return NextResponse.json({ error: 'Empty envelope' }, { status: 400 })
        }
        
        const header = JSON.parse(parts[0])
        const dsnString = header.dsn
        if (!dsnString) {
            return NextResponse.json({ error: 'No DSN in envelope header' }, { status: 400 })
        }

        const dsn = new URL(dsnString)
        const projectId = dsn.pathname.replace('/', '')
        
        // Validate project ID and host to prevent open relay
        const allowedDsnString = process.env.NEXT_PUBLIC_SENTRY_DSN
        if (!allowedDsnString) {
            return NextResponse.json({ error: 'Sentry DSN not configured on server' }, { status: 500 })
        }
        
        const allowedDsn = new URL(allowedDsnString)
        const allowedProjectId = allowedDsn.pathname.replace('/', '')
        const allowedHost = allowedDsn.host

        if (projectId !== allowedProjectId || dsn.host !== allowedHost) {
            return NextResponse.json({ error: 'Invalid DSN' }, { status: 400 })
        }

        const ingestUrl = `https://${dsn.host}/api/${projectId}/envelope/`
        
        const response = await fetch(ingestUrl, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': 'text/plain',
            },
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error('Sentry tunnel forward failed:', response.status, errText)
            return new Response(errText, { status: response.status })
        }

        return new Response(null, { status: 200 })
    } catch (error) {
        console.error('Sentry tunnel error:', error)
        return NextResponse.json({ error: 'Internal tunnel error' }, { status: 500 })
    }
}
