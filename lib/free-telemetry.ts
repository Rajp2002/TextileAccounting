/** Never export Free form values, request bodies, responses, or DOM snapshots. */
export function isFreeTelemetryPath(value:unknown):boolean {
  if(typeof value!=='string') return false
  try { const path=new URL(value,'https://weavly.invalid').pathname; return path==='/free'||path.startsWith('/free/')||path==='/api/free'||path.startsWith('/api/free/') }
  catch { return false }
}
export function isFreeTelemetryEvent(event:{request?:{url?:string};transaction?:string}):boolean {
  return isFreeTelemetryPath(event.request?.url)||isFreeTelemetryPath(event.transaction)
}
