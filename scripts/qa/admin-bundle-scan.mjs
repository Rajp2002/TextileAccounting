// Inspect generated public assets only. Report paths/rule names, never values.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.next/static')
const rules = [
    ['server credential variable', /SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|UPSTASH_REDIS_REST_TOKEN|SENTRY_AUTH_TOKEN/],
    ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
]
let assets = 0
const findings = []
async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) { await inspect(file); continue }
        if (!/\.(?:js|map)$/.test(entry.name)) continue
        assets++
        const contents = await readFile(file, 'utf8')
        for (const [rule, pattern] of rules) if (pattern.test(contents)) findings.push({ file: path.relative(root, file), rule })
        for (const token of contents.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
            try {
                const claims = JSON.parse(Buffer.from(token[1], 'base64url').toString())
                if (claims.role === 'service_role') findings.push({ file: path.relative(root, file), rule: 'embedded service-role JWT' })
            } catch { /* A non-JWT source substring is not a credential claim. */ }
        }
    }
}
await inspect(root)
console.info(JSON.stringify({ scope: 'generated public JavaScript/source maps; pattern scan, not proof of all possible secrets', assets, findings }, null, 2))
if (findings.length) process.exitCode = 1
