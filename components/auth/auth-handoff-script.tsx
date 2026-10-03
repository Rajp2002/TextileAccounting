import { buildAuthHandoffScript } from './auth-handoff'

const SCRIPT = buildAuthHandoffScript()

/** Must be the first thing in `<body>`: it rebuilds the auth overlay before first paint. */
export function AuthHandoffScript() {
    return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
